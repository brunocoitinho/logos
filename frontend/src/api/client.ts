import axios from 'axios'

import { tokenStorage } from '@/features/auth/token-storage'
import { API_URL } from '@/lib/env'

import { toApiError } from './errors'

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  // Sem timeout, uma rede ruim deixaria a tela "carregando" para sempre.
  timeout: 10_000,
})

api.interceptors.request.use((config) => {
  const token = tokenStorage.get()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Quem reage ao 401 (limpar sessão e ir para o login) é o AuthProvider, que registra
// o handler aqui. Assim o cliente HTTP não depende do React Router.
let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiError = toApiError(error)
    // No login, 401 significa "senha errada": quem trata é a própria tela de login.
    const isLoginRequest = error?.config?.url?.endsWith('/auth/login')
    if (apiError.status === 401 && !isLoginRequest) {
      onUnauthorized?.()
    }
    return Promise.reject(apiError)
  },
)
