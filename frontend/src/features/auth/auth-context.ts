import { createContext, useContext } from 'react'

import type { ApiError } from '@/api/errors'
import type { User } from '@/api/types'

export type LogoutReason = 'expired' | 'manual'

export interface LoginLocationState {
  from?: string
}

export interface AuthContextValue {
  isAuthenticated: boolean
  /** Por que a última sessão terminou; o login mostra o aviso de sessão expirada. */
  logoutReason: LogoutReason | null
  user: User | undefined
  isLoadingUser: boolean
  userError: ApiError | null
  retryLoadUser: () => void
  login: (email: string, password: string) => Promise<void>
  logout: (reason?: LogoutReason) => void
}

export const ME_QUERY_KEY = ['auth', 'me'] as const

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return context
}
