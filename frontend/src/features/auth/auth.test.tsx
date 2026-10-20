import { screen } from '@testing-library/react'
import { http } from 'msw'
import { describe, expect, it } from 'vitest'

import { apiError, apiUrl, server } from '@/test/server'
import { renderApp } from '@/test/render'

import { tokenStorage } from './token-storage'

describe('rotas protegidas e sessão', () => {
  it('sem token, manda para o login', async () => {
    renderApp('/')

    expect(await screen.findByRole('heading', { name: 'Entrar no Logos' })).toBeInTheDocument()
  })

  it('com token válido, mostra o painel e o nome do analista', async () => {
    tokenStorage.set('token-valido')

    renderApp('/')

    expect(await screen.findByRole('heading', { name: 'Painel de incidentes' })).toBeInTheDocument()
    expect(screen.getByText('Ana Souza')).toBeInTheDocument()
  })

  // FE9 — resposta 401 volta para o login
  it('token expirado (401) limpa a sessão e volta ao login com aviso', async () => {
    tokenStorage.set('token-expirado')
    server.use(
      http.get(apiUrl('/auth/me'), () => apiError(401, 'UNAUTHORIZED', 'Sessão inválida')),
    )

    renderApp('/')

    expect(await screen.findByText(/sua sessão expirou/i)).toBeInTheDocument()
    expect(tokenStorage.get()).toBeNull()
  })

  it('falha de rede ao verificar a sessão mostra erro com "Tentar novamente"', async () => {
    tokenStorage.set('token-valido')
    server.use(http.get(apiUrl('/auth/me'), () => Response.error()))

    const { user } = renderApp('/')

    expect(await screen.findByText(/sem conexão com o servidor/i)).toBeInTheDocument()

    server.resetHandlers()
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    expect(await screen.findByRole('heading', { name: 'Painel de incidentes' })).toBeInTheDocument()
  })

  it('sair limpa o token e volta ao login', async () => {
    tokenStorage.set('token-valido')
    const { user } = renderApp('/')

    await user.click(await screen.findByRole('button', { name: 'Sair' }))

    expect(await screen.findByRole('heading', { name: 'Entrar no Logos' })).toBeInTheDocument()
    expect(tokenStorage.get()).toBeNull()
  })
})
