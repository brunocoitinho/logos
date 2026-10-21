import { screen, waitFor } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import type { TokenResponse } from '@/api/types'
import { renderApp } from '@/test/render'
import { apiError, apiUrl, server, testUser } from '@/test/server'

import { tokenStorage } from './token-storage'

const tokenResponse: TokenResponse = {
  access_token: 'token-novo',
  token_type: 'bearer',
  expires_in: 28_800,
  user: testUser,
}

function mockLogin(resolver: Parameters<typeof http.post>[1]) {
  server.use(http.post(apiUrl('/auth/login'), resolver))
}

async function fillAndSubmit(
  user: ReturnType<typeof renderApp>['user'],
  email = 'ana@logos.demo',
  password = 'logos2026',
) {
  await user.type(screen.getByLabelText('E-mail'), email)
  await user.type(screen.getByLabelText('Senha'), password)
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
}

describe('tela de login', () => {
  it('entra, guarda o token e abre o painel com o nome do analista', async () => {
    let sentBody: unknown
    mockLogin(async ({ request }) => {
      sentBody = await request.json()
      return HttpResponse.json(tokenResponse)
    })
    const { user } = renderApp('/login')

    await fillAndSubmit(user)

    expect(await screen.findByRole('heading', { name: 'Painel de incidentes' })).toBeInTheDocument()
    expect(screen.getByText('Ana Souza')).toBeInTheDocument()
    expect(tokenStorage.get()).toBe('token-novo')
    expect(sentBody).toEqual({ email: 'ana@logos.demo', password: 'logos2026' })
  })

  it('valida os campos antes de chamar a API', async () => {
    const { user } = renderApp('/login')

    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('Informe o e-mail.')).toBeInTheDocument()
    expect(screen.getByText('Informe a senha.')).toBeInTheDocument()
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true')

    await user.type(screen.getByLabelText('E-mail'), 'nao-e-um-email')
    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument()
    // Nenhum handler de login foi definido: se a API fosse chamada, o MSW falharia o teste.
  })

  it('mostra a mensagem da API quando a senha está errada', async () => {
    mockLogin(() => apiError(401, 'UNAUTHORIZED', 'E-mail ou senha inválidos.'))
    const { user } = renderApp('/login')

    await fillAndSubmit(user, 'ana@logos.demo', 'errada')

    expect(await screen.findByText('E-mail ou senha inválidos.')).toBeInTheDocument()
    expect(tokenStorage.get()).toBeNull()
  })

  it('explica o bloqueio por excesso de tentativas', async () => {
    mockLogin(() =>
      apiError(429, 'TOO_MANY_REQUESTS', 'Muitas tentativas de login. Tente novamente em 298 segundos.'),
    )
    const { user } = renderApp('/login')

    await fillAndSubmit(user)

    expect(await screen.findByText(/tente novamente em 298 segundos/i)).toBeInTheDocument()
  })

  it('avisa quando não há conexão com o servidor', async () => {
    mockLogin(() => HttpResponse.error())
    const { user } = renderApp('/login')

    await fillAndSubmit(user)

    expect(await screen.findByText(/sem conexão com o servidor/i)).toBeInTheDocument()
  })

  it('desabilita o botão e mostra progresso enquanto envia (evita duplo envio)', async () => {
    let calls = 0
    mockLogin(async () => {
      calls += 1
      await delay(200)
      return HttpResponse.json(tokenResponse)
    })
    const { user } = renderApp('/login')

    await user.type(screen.getByLabelText('E-mail'), 'ana@logos.demo')
    await user.type(screen.getByLabelText('Senha'), 'logos2026')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    const sending = await screen.findByRole('button', { name: 'Entrando...' })
    expect(sending).toBeDisabled()
    await user.click(sending)

    await screen.findByRole('heading', { name: 'Painel de incidentes' })
    expect(calls).toBe(1)
  })

  it('conta de demonstração preenche e-mail e senha com um clique', async () => {
    const { user } = renderApp('/login')

    await user.click(screen.getByRole('button', { name: 'Preencher com Bruno Costa' }))

    expect(screen.getByLabelText('E-mail')).toHaveValue('bruno@logos.demo')
    expect(screen.getByLabelText('Senha')).toHaveValue('logos2026')
  })

  it('mostra e oculta a senha', async () => {
    const { user } = renderApp('/login')
    const password = screen.getByLabelText('Senha')

    expect(password).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(password).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: 'Ocultar senha' }))
    expect(password).toHaveAttribute('type', 'password')
  })

  it('depois do login, volta para a página que o analista tentou abrir', async () => {
    mockLogin(() => HttpResponse.json(tokenResponse))
    const { user } = renderApp('/pagina-protegida-inexistente')

    // Rota desconhecida cai no painel; sem login, o painel manda para o login.
    await screen.findByRole('heading', { name: 'Entrar no Logos' })
    await fillAndSubmit(user)

    expect(await screen.findByRole('heading', { name: 'Painel de incidentes' })).toBeInTheDocument()
  })

  it('analista já logado que abre /login vai direto para o painel', async () => {
    tokenStorage.set('token-valido')

    renderApp('/login')

    expect(await screen.findByRole('heading', { name: 'Painel de incidentes' })).toBeInTheDocument()
  })

  it('o aviso de sessão expirada some depois de um novo login', async () => {
    tokenStorage.set('token-expirado')
    server.use(http.get(apiUrl('/auth/me'), () => apiError(401, 'UNAUTHORIZED', 'x')))
    const { user } = renderApp('/')
    expect(await screen.findByText(/sua sessão expirou/i)).toBeInTheDocument()

    server.resetHandlers()
    mockLogin(() => HttpResponse.json(tokenResponse))
    await fillAndSubmit(user)
    await screen.findByRole('heading', { name: 'Painel de incidentes' })

    await user.click(screen.getByRole('button', { name: 'Sair' }))
    await screen.findByRole('heading', { name: 'Entrar no Logos' })
    await waitFor(() => expect(screen.queryByText(/sua sessão expirou/i)).not.toBeInTheDocument())
  })
})
