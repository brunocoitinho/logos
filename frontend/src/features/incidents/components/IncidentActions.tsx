import { Hand, Loader2, RotateCcw, Undo2, WifiOff } from 'lucide-react'
import { useState } from 'react'

import type { Incident } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth/auth-context'
import { useOnline } from '@/lib/use-online'

import { useIncidentAction } from '../use-incident-action'
import type { IncidentAction } from '../use-incident-action'

/** Mesmo mínimo exigido pela API para nota de resolução e motivo de reabertura. */
const MIN_NOTE_LENGTH = 5

export function IncidentActions({ incident }: { incident: Incident }) {
  const { user } = useAuth()
  const online = useOnline()
  const action = useIncidentAction(incident)
  const [note, setNote] = useState('')

  const isMine = incident.assigned_to?.id === user?.id
  const noteIsValid = note.trim().length >= MIN_NOTE_LENGTH
  // Enquanto uma ação está em andamento, nenhuma outra pode ser disparada (evita duplo envio).
  const busy = action.isPending
  const disabled = busy || !online

  const run = (next: IncidentAction) => action.mutate(next, { onSuccess: () => setNote('') })

  /** Spinner só no botão clicado. */
  const isRunning = (check: (pending: IncidentAction) => boolean) =>
    busy && action.variables !== undefined && check(action.variables)

  const offlineHint = !online && (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <WifiOff className="size-3.5" aria-hidden />
      Sem conexão: as ações voltam quando a rede retornar.
    </p>
  )

  if (incident.status === 'OPEN') {
    return (
      <div className="space-y-2">
        <Button className="w-full" disabled={disabled} onClick={() => run({ type: 'claim' })}>
          {isRunning((pending) => pending.type === 'claim') ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Hand aria-hidden />
          )}
          Assumir incidente
        </Button>
        <p className="text-xs text-muted-foreground">
          Ao assumir, você vira o único responsável: nenhum outro analista consegue encerrá-lo.
        </p>
        {offlineHint}
      </div>
    )
  }

  if (incident.status === 'INVESTIGATING' && !isMine) {
    return (
      <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
        Em investigação por <strong className="text-foreground">{incident.assigned_to?.name}</strong>.
        Só o responsável pode encerrar ou devolver este incidente à fila.
      </p>
    )
  }

  const isReopen = incident.status === 'CLOSED' || incident.status === 'INCONCLUSIVE'
  const noteLabel = isReopen ? 'Motivo da reabertura' : 'Nota de resolução'
  const noteHint = isReopen
    ? 'Explique por que o incidente precisa voltar para a fila.'
    : 'O que foi feito? A nota fica no histórico do incidente.'

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="incident-note">{noteLabel}</Label>
        <Textarea
          id="incident-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={2000}
          rows={3}
          aria-describedby="incident-note-hint"
        />
        <p id="incident-note-hint" className="text-xs text-muted-foreground">
          {noteHint} Mínimo de {MIN_NOTE_LENGTH} caracteres.
        </p>
      </div>

      {isReopen ? (
        <Button
          className="w-full"
          disabled={disabled || !noteIsValid}
          onClick={() => run({ type: 'transition', toStatus: 'OPEN', note: note.trim() })}
        >
          {isRunning(() => true) ? <Loader2 className="animate-spin" aria-hidden /> : <RotateCcw aria-hidden />}
          Reabrir incidente
        </Button>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            disabled={disabled || !noteIsValid}
            onClick={() => run({ type: 'transition', toStatus: 'CLOSED', note: note.trim() })}
          >
            {isRunning((pending) => pending.type === 'transition' && pending.toStatus === 'CLOSED') && (
              <Loader2 className="animate-spin" aria-hidden />
            )}
            Fechar
          </Button>
          <Button
            variant="outline"
            disabled={disabled || !noteIsValid}
            onClick={() => run({ type: 'transition', toStatus: 'INCONCLUSIVE', note: note.trim() })}
          >
            {isRunning(
              (pending) => pending.type === 'transition' && pending.toStatus === 'INCONCLUSIVE',
            ) && <Loader2 className="animate-spin" aria-hidden />}
            Marcar inconclusivo
          </Button>
          <Button
            variant="ghost"
            className="sm:col-span-2"
            disabled={disabled}
            onClick={() => run({ type: 'release', note: note.trim() || undefined })}
          >
            {isRunning((pending) => pending.type === 'release') ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Undo2 aria-hidden />
            )}
            Devolver à fila
          </Button>
        </div>
      )}
      {offlineHint}
    </div>
  )
}
