import { onlineManager } from '@tanstack/react-query'
import { act, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Incident, IncidentEvent } from '@/api/types'
import { tokenStorage } from '@/features/auth/token-storage'
import { makeIncident, makeList } from '@/test/factories'
import { renderApp } from '@/test/render'
import { apiUrl, server, testUser } from '@/test/server'

const ANA = { id: testUser.id, name: testUser.name }
const BRUNO = { id: 2, name: 'Bruno Costa' }

/** Resposta que só sai quando o teste mandar: permite olhar a tela "durante" a requisição. */
function deferred() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => (release = resolve))
  return { promise, release }
}

/**
 * API simulada com um único incidente e com estado: depois de uma ação, as consultas
 * passam a devolver o incidente atualizado, como o servidor real faria.
 */
function serveIncident(incident: Incident, events: IncidentEvent[] = []) {
  const state = { incident }
  server.use(
    http.get(apiUrl('/incidents'), () => HttpResponse.json(makeList([state.incident]))),
    http.get(apiUrl(`/incidents/${incident.id}`), () => HttpResponse.json(state.incident)),
    http.get(apiUrl(`/incidents/${incident.id}/events`), () => HttpResponse.json(events)),
  )

  /** Registra a ação e devolve as chamadas recebidas. Resposta de sucesso atualiza o estado. */
  function onAction(
    action: 'claim' | 'release' | 'transition',
    respond: () => Incident | Response | Promise<Incident | Response>,
  ) {
    const calls: unknown[] = []
    server.use(
      http.post(apiUrl(`/incidents/${incident.id}/${action}`), async ({ request }) => {
        const isJson = request.headers.get('content-type')?.includes('json')
        calls.push(isJson ? await request.json() : null)
        const result = await respond()
        if (result instanceof Response) return result
        state.incident = result
        return HttpResponse.json(result)
      }),
    )
    return calls
  }

  return { state, onAction }
}

async function openDrawer(incident: Incident) {
  const view = renderApp(`/?incident=${incident.id}`)
  const drawer = await screen.findByRole('dialog')
  await within(drawer).findByRole('heading', { name: incident.title })
  return { ...view, drawer }
}

beforeEach(() => tokenStorage.set('token-valido'))
afterEach(() => onlineManager.setOnline(true))

describe('ações sobre o incidente', () => {
  // FE6 — atualização otimista
  it('assumir muda a tela na hora, antes de o servidor responder, e confirma depois', async () => {
    const incident = makeIncident({ title: 'Pneu furado', status: 'OPEN' })
    const api = serveIncident(incident)
    const gate = deferred()
    api.onAction('claim', async () => {
      await gate.promise
      return { ...incident, status: 'INVESTIGATING', assigned_to: ANA, version: 2 }
    })
    const { user, drawer } = await openDrawer(incident)

    await user.click(within(drawer).getByRole('button', { name: 'Assumir incidente' }))

    // Servidor ainda não respondeu, e a tela já mostra o resultado esperado.
    expect(await within(drawer).findByText('Em investigação')).toBeInTheDocument()
    expect(within(drawer).getAllByText('Ana Souza').length).toBeGreaterThan(0)

    gate.release()
    expect(await screen.findByText('Incidente assumido. Você é o responsável.')).toBeInTheDocument()
  })

  it('conflito (409) desfaz a mudança e mostra quem assumiu antes', async () => {
    const incident = makeIncident({ title: 'Engavetamento', status: 'OPEN' })
    const api = serveIncident(incident)
    api.onAction('claim', () => {
      // No servidor, Bruno assumiu um instante antes.
      api.state.incident = { ...incident, status: 'INVESTIGATING', assigned_to: BRUNO, version: 2 }
      return HttpResponse.json(
        {
          error: {
            code: 'CONFLICT',
            message: 'Bruno Costa assumiu este incidente antes de você.',
            details: { current: api.state.incident },
          },
        },
        { status: 409 },
      )
    })
    const { user, drawer } = await openDrawer(incident)

    await user.click(within(drawer).getByRole('button', { name: 'Assumir incidente' }))

    expect(await screen.findByText('Outro analista agiu antes')).toBeInTheDocument()
    expect(screen.getByText('Bruno Costa assumiu este incidente antes de você.')).toBeInTheDocument()
    // O estado real (vindo no 409) entra na tela: Bruno é o responsável, Ana não tem ações.
    expect(await within(drawer).findByText(/em investigação por/i)).toHaveTextContent('Bruno Costa')
    expect(within(drawer).queryByRole('button', { name: 'Assumir incidente' })).not.toBeInTheDocument()
  })

  // FE7 — erro de rede e duplo clique
  it('queda de rede desfaz a mudança otimista e explica o motivo', async () => {
    const incident = makeIncident({ title: 'Neblina', status: 'OPEN' })
    const api = serveIncident(incident)
    api.onAction('claim', () => HttpResponse.error())
    const { user, drawer } = await openDrawer(incident)

    await user.click(within(drawer).getByRole('button', { name: 'Assumir incidente' }))

    expect(await screen.findByText('Não foi possível concluir a ação')).toBeInTheDocument()
    expect(screen.getByText(/sem conexão com o servidor/i)).toBeInTheDocument()
    expect(await within(drawer).findByRole('button', { name: 'Assumir incidente' })).toBeEnabled()
    expect(within(drawer).getByText('Ninguém ainda')).toBeInTheDocument()
  })

  it('botões ficam desabilitados durante a ação: duplo clique não envia duas vezes', async () => {
    const incident = makeIncident({ status: 'OPEN' })
    const api = serveIncident(incident)
    const gate = deferred()
    const calls = api.onAction('claim', async () => {
      await gate.promise
      return { ...incident, status: 'INVESTIGATING', assigned_to: ANA, version: 2 }
    })
    const { user, drawer } = await openDrawer(incident)

    const claim = within(drawer).getByRole('button', { name: 'Assumir incidente' })
    await user.click(claim)
    await user.click(claim)

    gate.release()
    await screen.findByText('Incidente assumido. Você é o responsável.')
    expect(calls).toHaveLength(1)
  })

  // FE8 — sem conexão
  it('sem conexão, mostra o aviso e bloqueia as ações com explicação', async () => {
    const incident = makeIncident({ status: 'OPEN' })
    serveIncident(incident)
    const { drawer } = await openDrawer(incident)

    act(() => onlineManager.setOnline(false))

    expect(await screen.findByText(/exibindo os últimos dados recebidos/i)).toBeInTheDocument()
    expect(within(drawer).getByRole('button', { name: 'Assumir incidente' })).toBeDisabled()
    expect(within(drawer).getByText(/as ações voltam quando a rede retornar/i)).toBeInTheDocument()

    act(() => onlineManager.setOnline(true))
    await waitFor(() =>
      expect(within(drawer).getByRole('button', { name: 'Assumir incidente' })).toBeEnabled(),
    )
  })

  // Ciclo de vida pela tela
  it('responsável fecha com nota obrigatória, enviando a versão que leu', async () => {
    const incident = makeIncident({ status: 'INVESTIGATING', assigned_to: ANA, version: 4 })
    const api = serveIncident(incident)
    const calls = api.onAction('transition', () => ({ ...incident, status: 'CLOSED', version: 5 }))
    const { user, drawer } = await openDrawer(incident)

    const close = within(drawer).getByRole('button', { name: 'Fechar' })
    expect(close).toBeDisabled()
    await user.type(within(drawer).getByLabelText('Nota de resolução'), 'ok')
    expect(close).toBeDisabled()
    await user.type(within(drawer).getByLabelText('Nota de resolução'), ' resolvido')
    await user.click(close)

    expect(await screen.findByText('Incidente fechado.')).toBeInTheDocument()
    expect(calls).toEqual([{ version: 4, to_status: 'CLOSED', note: 'ok resolvido' }])
  })

  it('responsável devolve o incidente à fila', async () => {
    const incident = makeIncident({ status: 'INVESTIGATING', assigned_to: ANA, version: 2 })
    const api = serveIncident(incident)
    const calls = api.onAction('release', () => ({
      ...incident,
      status: 'OPEN',
      assigned_to: null,
      version: 3,
    }))
    const { user, drawer } = await openDrawer(incident)

    await user.click(within(drawer).getByRole('button', { name: 'Devolver à fila' }))

    expect(await screen.findByText('Incidente devolvido à fila.')).toBeInTheDocument()
    expect(calls).toEqual([{ version: 2 }])
  })

  it('incidente de outro analista não oferece ações de encerramento', async () => {
    const incident = makeIncident({ status: 'INVESTIGATING', assigned_to: BRUNO })
    serveIncident(incident)
    const { drawer } = await openDrawer(incident)

    expect(within(drawer).getByText(/em investigação por/i)).toHaveTextContent('Bruno Costa')
    expect(within(drawer).queryByRole('button', { name: 'Fechar' })).not.toBeInTheDocument()
  })

  it('qualquer analista reabre um incidente fechado informando o motivo', async () => {
    const incident = makeIncident({ status: 'CLOSED', assigned_to: BRUNO, resolution_note: 'Resolvido' })
    const api = serveIncident(incident)
    const calls = api.onAction('transition', () => ({
      ...incident,
      status: 'OPEN',
      assigned_to: null,
      version: 2,
    }))
    const { user, drawer } = await openDrawer(incident)

    await user.type(within(drawer).getByLabelText('Motivo da reabertura'), 'Motorista ligou de novo')
    await user.click(within(drawer).getByRole('button', { name: 'Reabrir incidente' }))

    expect(await screen.findByText('Incidente reaberto.')).toBeInTheDocument()
    expect(calls).toEqual([{ version: 1, to_status: 'OPEN', note: 'Motorista ligou de novo' }])
  })
})

describe('gaveta de detalhe', () => {
  it('abre ao clicar no incidente da lista e mostra o histórico', async () => {
    const incident = makeIncident({ title: 'Queda de barreira', status: 'OPEN' })
    serveIncident(incident, [
      {
        id: 1,
        type: 'CREATED',
        from_status: null,
        to_status: 'OPEN',
        note: null,
        user: { id: 9, name: 'Telemetria da Frota' },
        created_at: new Date().toISOString(),
      },
    ])
    const { user } = renderApp('/')

    await user.click(await screen.findByRole('button', { name: /queda de barreira/i }))

    const drawer = await screen.findByRole('dialog')
    expect(within(drawer).getByRole('heading', { name: 'Queda de barreira' })).toBeInTheDocument()
    const history = await within(drawer).findByRole('list', { name: 'Histórico do incidente' })
    expect(history).toHaveTextContent('Telemetria da Frota registrou o incidente')
  })

  it('fecha com Esc', async () => {
    const incident = makeIncident({ status: 'OPEN' })
    serveIncident(incident)
    const { user } = await openDrawer(incident)

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
