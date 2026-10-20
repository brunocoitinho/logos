import { Navigate, Outlet, useLocation } from 'react-router'

import { FullPageError, FullPageLoader } from '@/components/layout/FullPageStatus'

import { useAuth } from './auth-context'
import type { LoginLocationState } from './auth-context'

export function ProtectedRoute() {
  const { isAuthenticated, isLoadingUser, userError, retryLoadUser } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    const state: LoginLocationState = { from: location.pathname + location.search }
    return <Navigate to="/login" replace state={state} />
  }

  if (isLoadingUser) return <FullPageLoader label="Verificando sua sessão..." />

  // 401 já levou ao login; aqui sobram falhas de rede ou do servidor.
  if (userError) return <FullPageError message={userError.message} onRetry={retryLoadUser} />

  return <Outlet />
}
