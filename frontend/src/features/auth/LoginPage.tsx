import { useAuth } from './auth-context'

// Versão mínima: o formulário de login entra na Etapa 10.
export function LoginPage() {
  const { logoutReason } = useAuth()

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-3 p-6">
      <h1 className="text-2xl font-semibold">Entrar no Logos</h1>
      {logoutReason === 'expired' && (
        <p role="alert" className="text-sm text-muted-foreground">
          Sua sessão expirou. Entre novamente para continuar.
        </p>
      )}
    </main>
  )
}
