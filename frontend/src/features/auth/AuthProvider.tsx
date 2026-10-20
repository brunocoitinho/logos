import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'

import { getMe, login as loginRequest } from '@/api/auth'
import { setUnauthorizedHandler } from '@/api/client'
import type { ApiError } from '@/api/errors'
import type { User } from '@/api/types'

import { AuthContext, ME_QUERY_KEY } from './auth-context'
import type { AuthContextValue, LogoutReason } from './auth-context'
import { tokenStorage } from './token-storage'

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [token, setToken] = useState<string | null>(tokenStorage.get)
  // Guardado aqui, e não no estado da navegação: ao limpar o token, a ProtectedRoute também
  // redireciona para o login e sobrescreveria esse estado (o aviso de sessão expirada sumia).
  const [logoutReason, setLogoutReason] = useState<LogoutReason | null>(null)

  const logout = useCallback(
    (reason: LogoutReason = 'manual') => {
      tokenStorage.clear()
      setToken(null)
      setLogoutReason(reason)
      // Nada do analista anterior pode ficar no cache para o próximo login.
      queryClient.clear()
      navigate('/login', { replace: true })
    },
    [navigate, queryClient],
  )

  // Qualquer 401 da API (token expirado ou inválido) encerra a sessão.
  useEffect(() => {
    setUnauthorizedHandler(() => logout('expired'))
    return () => setUnauthorizedHandler(null)
  }, [logout])

  // Com token salvo (ex.: depois de um F5), confirma quem é o usuário e se o token vale.
  const me = useQuery<User, ApiError>({
    queryKey: ME_QUERY_KEY,
    queryFn: getMe,
    enabled: token !== null,
    staleTime: Infinity,
  })

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await loginRequest(email, password)
      tokenStorage.set(response.access_token)
      queryClient.setQueryData(ME_QUERY_KEY, response.user)
      setLogoutReason(null)
      setToken(response.access_token)
    },
    [queryClient],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: token !== null,
      logoutReason,
      user: me.data,
      isLoadingUser: token !== null && me.isPending,
      userError: me.error,
      retryLoadUser: () => void me.refetch(),
      login,
      logout,
    }),
    [token, logoutReason, me, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
