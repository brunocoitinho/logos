import { LogOut, Radar } from 'lucide-react'
import { Outlet } from 'react-router'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { ThemeToggle } from '@/features/theme/ThemeToggle'

import { OfflineBanner } from './OfflineBanner'

export function AppLayout() {
  const { user, logout } = useAuth()

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <Radar className="size-5 text-primary" aria-hidden />
          <div className="leading-tight">
            <p className="font-semibold tracking-tight">Logos</p>
            <p className="hidden text-xs text-muted-foreground sm:block">
              Central de Resposta a Incidentes
            </p>
          </div>

          <div className="ml-auto flex items-center gap-1">
            {user && (
              <span className="mr-2 hidden text-sm text-muted-foreground sm:inline">
                {user.name}
              </span>
            )}
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={() => logout()} aria-label="Sair" title="Sair">
              <LogOut aria-hidden />
            </Button>
          </div>
        </div>
      </header>
      <OfflineBanner />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
