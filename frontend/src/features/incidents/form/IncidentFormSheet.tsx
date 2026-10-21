import { yupResolver } from '@hookform/resolvers/yup'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import type { FieldPath } from 'react-hook-form'
import { toast } from 'sonner'

import type { IncidentInput } from '@/api/incidents'
import type { ApiError } from '@/api/errors'
import type { Criticality, Incident, IncidentCategory } from '@/api/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { useOnline } from '@/lib/use-online'
import { cn } from '@/lib/utils'

import { CATEGORY, CATEGORY_ORDER, CRITICALITY, CRITICALITY_ORDER } from '../constants'
import { BRAZILIAN_STATES, incidentSchema, SUGGESTED_CRITICALITY } from './incident-schema'
import type { IncidentFormValues } from './incident-schema'
import { useCreateIncident, useUpdateIncident } from './use-incident-mutations'

type FormProps =
  | { mode: 'create'; incident?: undefined; onDone: (incident: Incident) => void }
  | { mode: 'edit'; incident: Incident; onDone: (incident: Incident) => void }

interface IncidentFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: FormProps
}

/** Gaveta com o formulário. A `key` do conteúdo recria o formulário a cada abertura. */
export function IncidentFormSheet({ open, onOpenChange, form }: IncidentFormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        {open && <IncidentForm {...form} onCancel={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  )
}

const EMPTY_VALUES = {
  title: '',
  category: '' as IncidentCategory,
  criticality: '' as Criticality,
  vehicle_plate: '',
  highway: '',
  km: undefined as unknown as number,
  city: '',
  state: '',
  description: '',
}

function toFormValues(incident: Incident): IncidentFormValues {
  return {
    title: incident.title,
    category: incident.category,
    criticality: incident.criticality,
    vehicle_plate: incident.vehicle_plate,
    highway: incident.highway,
    km: incident.km,
    city: incident.city,
    state: incident.state,
    description: incident.description ?? '',
  }
}

function toInput(values: IncidentFormValues): IncidentInput {
  return { ...values, description: values.description || null }
}

/** Só os campos que mudaram: a edição não sobrescreve o que outra pessoa alterou em outro campo. */
function changedFields(incident: Incident, values: IncidentFormValues): Partial<IncidentInput> {
  const next = toInput(values)
  const original = toInput(toFormValues(incident))
  return Object.fromEntries(
    Object.entries(next).filter(([key, value]) => original[key as keyof IncidentInput] !== value),
  ) as Partial<IncidentInput>
}

function IncidentForm({ mode, incident, onDone, onCancel }: FormProps & { onCancel: () => void }) {
  const online = useOnline()
  const create = useCreateIncident()
  const update = useUpdateIncident(incident as Incident)
  // Uma chave por formulário aberto: reenviar o mesmo formulário (ex.: após falha de rede)
  // não duplica o incidente.
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  // Na edição, a criticidade já foi escolhida: a sugestão por categoria não interfere.
  const [criticalityChosen, setCriticalityChosen] = useState(mode === 'edit')

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<IncidentFormValues>({
    resolver: yupResolver(incidentSchema),
    defaultValues: incident ? toFormValues(incident) : EMPTY_VALUES,
  })

  const criticality = useWatch({ control, name: 'criticality' })

  const showApiError = (error: ApiError) => {
    // Campo recusado pela API (raro: o formulário valida as mesmas regras antes).
    const fields = (error.details?.fields as { field: string }[] | undefined) ?? []
    fields
      .filter((item) => item.field in EMPTY_VALUES)
      .forEach((item) =>
        setError(item.field as FieldPath<IncidentFormValues>, { message: 'Valor recusado pela API.' }),
      )
    setError('root', { message: error.message })
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (mode === 'create') {
        const created = await create.mutateAsync({ input: toInput(values), idempotencyKey })
        onDone(created)
        return
      }
      const changes = changedFields(incident, values)
      if (Object.keys(changes).length === 0) {
        toast.info('Nenhuma alteração para salvar.')
        onCancel()
        return
      }
      onDone(await update.mutateAsync(changes))
    } catch (error) {
      const apiError = error as ApiError
      // Conflito na edição: a tela já foi atualizada com o estado atual; fecha o formulário.
      if (apiError.isConflict) onCancel()
      else showApiError(apiError)
    }
  })

  const fieldProps = (name: keyof typeof EMPTY_VALUES) => ({
    id: `incident-${name}`,
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `incident-${name}-error` : undefined,
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-full flex-col">
      <SheetHeader className="border-b">
        <SheetTitle>{mode === 'create' ? 'Novo incidente' : 'Editar incidente'}</SheetTitle>
        <SheetDescription>
          {mode === 'create'
            ? 'Registre um incidente informado por telefone ou rádio.'
            : 'Status e responsável mudam pelas ações do incidente, não por aqui.'}
        </SheetDescription>
      </SheetHeader>

      <div className="grid flex-1 grid-cols-6 content-start gap-4 p-4">
        {errors.root && (
          <Alert variant="destructive" className="col-span-6">
            <AlertCircle aria-hidden />
            <AlertDescription>{errors.root.message}</AlertDescription>
          </Alert>
        )}

        <Field name="title" label="Título" error={errors.title?.message} className="col-span-6">
          <Input {...fieldProps('title')} maxLength={120} {...register('title')} />
        </Field>

        <Field name="category" label="Categoria" error={errors.category?.message} className="col-span-6">
          <NativeSelect
            {...fieldProps('category')}
            {...register('category', {
              onChange: (event) => {
                const suggested = SUGGESTED_CRITICALITY[event.target.value as IncidentCategory]
                if (!criticalityChosen && suggested) {
                  setValue('criticality', suggested, { shouldValidate: true })
                }
              },
            })}
          >
            <option value="" disabled>
              Selecione...
            </option>
            {CATEGORY_ORDER.map((value) => (
              <option key={value} value={value}>
                {CATEGORY[value].label}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <fieldset className="col-span-6 space-y-1.5">
          <legend className="mb-1.5 text-sm font-medium">Criticidade</legend>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-invalid={errors.criticality ? true : undefined}>
            {CRITICALITY_ORDER.map((value) => {
              const style = CRITICALITY[value]
              const Icon = style.icon
              const selected = criticality === value
              return (
                <label
                  key={value}
                  className={cn(
                    'flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-sm font-medium transition-colors',
                    'has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
                    selected ? style.badge : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  <input
                    type="radio"
                    value={value}
                    className="sr-only"
                    {...register('criticality', { onChange: () => setCriticalityChosen(true) })}
                  />
                  <Icon className="size-4" aria-hidden />
                  {style.label}
                </label>
              )
            })}
          </div>
          {errors.criticality ? (
            <p className="text-sm text-destructive">{errors.criticality.message}</p>
          ) : (
            !criticalityChosen &&
            criticality && <p className="text-xs text-muted-foreground">Sugerida pela categoria. Você pode mudar.</p>
          )}
        </fieldset>

        <Field name="vehicle_plate" label="Placa" error={errors.vehicle_plate?.message} className="col-span-3 sm:col-span-2">
          <Input {...fieldProps('vehicle_plate')} placeholder="ABC1D23" className="uppercase" {...register('vehicle_plate')} />
        </Field>

        <Field name="highway" label="Rodovia" error={errors.highway?.message} className="col-span-3 sm:col-span-2">
          <Input {...fieldProps('highway')} placeholder="BR-116" className="uppercase" {...register('highway')} />
        </Field>

        <Field name="km" label="Km" error={errors.km?.message} className="col-span-3 sm:col-span-2">
          <Input {...fieldProps('km')} type="number" inputMode="decimal" step="0.1" min="0" {...register('km')} />
        </Field>

        <Field name="city" label="Cidade" error={errors.city?.message} className="col-span-3 sm:col-span-4">
          <Input {...fieldProps('city')} maxLength={100} {...register('city')} />
        </Field>

        <Field name="state" label="UF" error={errors.state?.message} className="col-span-6 sm:col-span-2">
          <NativeSelect {...fieldProps('state')} {...register('state')}>
            <option value="" disabled>
              UF
            </option>
            {BRAZILIAN_STATES.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field name="description" label="Descrição (opcional)" error={errors.description?.message} className="col-span-6">
          <Textarea {...fieldProps('description')} rows={3} maxLength={2000} {...register('description')} />
        </Field>
      </div>

      <SheetFooter className="border-t sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting || !online}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
          {mode === 'create' ? 'Registrar incidente' : 'Salvar alterações'}
        </Button>
      </SheetFooter>
    </form>
  )
}

interface FieldProps {
  name: string
  label: string
  error: string | undefined
  className?: string
  children: ReactNode
}

function Field({ name, label, error, className, children }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={`incident-${name}`}>{label}</Label>
      {children}
      {error && (
        <p id={`incident-${name}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
