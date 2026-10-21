import { yupResolver } from '@hookform/resolvers/yup'
import { AlertCircle, Eye, EyeOff, Info, Loader2, Radar } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router'

import { toApiError } from '@/api/errors'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ThemeToggle } from '@/features/theme/ThemeToggle'

import { useAuth } from './auth-context'
import type { LoginLocationState } from './auth-context'
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from './demo-accounts'
import { loginSchema } from './login-schema'
import type { LoginFormValues } from './login-schema'

export function LoginPage() {
  const { isAuthenticated, login, logoutReason } = useAuth()
  const navigate = useNavigate()
  const from = (useLocation().state as LoginLocationState | null)?.from ?? '/'
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: yupResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  if (isAuthenticated) return <Navigate to={from} replace />

  const onSubmit = handleSubmit(async ({ email, password }) => {
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (error) {
      // A API já devolve a mensagem certa: senha errada, muitas tentativas, sem conexão...
      setError('root', { message: toApiError(error).message })
    }
  })

  const fillDemoAccount = (email: string) => {
    setValue('email', email, { shouldValidate: true })
    setValue('password', DEMO_PASSWORD, { shouldValidate: true })
    clearErrors('root')
  }

  return (
    <main className="relative grid min-h-svh lg:grid-cols-2">
      <div className="absolute top-3 right-3">
        <ThemeToggle />
      </div>

      {/* Painel de apresentação: diz para que serve o sistema antes do login.
          Fundo com grade de pontos: um radial-gradient de 1px repetido a cada 18px. */}
      <section className="hidden flex-col justify-between bg-muted/50 bg-[radial-gradient(var(--color-border)_1px,transparent_1px)] bg-size-[18px_18px] p-10 lg:flex">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <Radar className="size-5 text-primary" aria-hidden />
          Logos
        </div>
        <div className="max-w-md space-y-4">
          <h2 className="text-3xl font-semibold tracking-tight text-balance">
            Central de Resposta a Incidentes da frota
          </h2>
          <ul className="space-y-2 text-muted-foreground">
            <li>Incidentes priorizados por criticidade, gravidade e tempo de espera.</li>
            <li>Cada incidente tem um único responsável: nada é resolvido em dobro.</li>
            <li>Histórico completo de quem fez o quê e quando.</li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">MVP · case prático de desenvolvimento</p>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex items-center justify-center gap-2 font-semibold tracking-tight lg:hidden">
            <Radar className="size-5 text-primary" aria-hidden />
            Logos
          </div>

          {logoutReason === 'expired' && (
            <Alert>
              <Info aria-hidden />
              <AlertDescription>Sua sessão expirou. Entre novamente para continuar.</AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>
                <h1 className="text-xl font-semibold">Entrar no Logos</h1>
              </CardTitle>
              <CardDescription>Acesse com sua conta de analista.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} noValidate className="space-y-4">
                {errors.root && (
                  <Alert variant="destructive">
                    <AlertCircle aria-hidden />
                    <AlertDescription>{errors.root.message}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    autoFocus
                    aria-invalid={errors.email ? true : undefined}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                    {...register('email')}
                  />
                  {errors.email && (
                    <p id="email-error" className="text-sm text-destructive">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      className="pr-10"
                      aria-invalid={errors.password ? true : undefined}
                      aria-describedby={errors.password ? 'password-error' : undefined}
                      {...register('password')}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                    </Button>
                  </div>
                  {errors.password && (
                    <p id="password-error" className="text-sm text-destructive">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
                  {isSubmitting ? 'Entrando...' : 'Entrar'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <p className="text-sm font-medium">Contas de demonstração</p>
            <p className="text-xs text-muted-foreground">
              Clique para preencher. Senha de todas: <code className="font-mono">{DEMO_PASSWORD}</code>
            </p>
            <div className="grid gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <Button
                  key={account.email}
                  type="button"
                  variant="outline"
                  className="h-auto justify-between py-2"
                  onClick={() => fillDemoAccount(account.email)}
                  aria-label={`Preencher com ${account.name}`}
                >
                  <span className="font-medium">{account.name}</span>
                  <span className="text-xs text-muted-foreground">{account.email}</span>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
