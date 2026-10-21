import { screen, waitFor, within } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import type { IncidentSummary } from '@/api/types'
import { tokenStorage } from '@/features/auth/token-storage'
import { makeIncident, makeList, minutesAgo } from '@/test/factories'
import { renderApp } from '@/test/render'
import { apiError, apiUrl, emptySummary, server } from '@/test/server'

/** Registra os parâmetros de cada chamada a GET /incidents. */
function captureListRequests(respond: () => Response | Promise<Response>) {
  const requests: URLSearchParams[] = []
  server.use(
    http.get(apiUrl('/incidents'), ({ request }) => {
      requests.push(new URL(request.url).searchParams)
      return respond()
    }),
  )
  return requests
}

function incidentRows() {
  return within(screen.getByRole('list', { name: /incidentes/i })).getAllByRole('listitem')
}

beforeEach(() => tokenStorage.set('token-valido'))

describe('painel de incidentes', () => {
  // FE1 — carregamento
  it('mostra o esqueleto enquanto carrega e depois a lista', async () => {
    captureListRequests(async () => {
      await delay(150)
      return HttpResponse.json(makeList([makeIncident({ title: 'Pneu furado' })]))
    })

    renderApp('/')

    expect(await screen.findByRole('status', { name: 'Carregando incidentes' })).toBeInTheDocument()
    expect(await screen.findByText('Pneu furado')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Carregando incidentes' })).not.toBeInTheDocument()
  })

  // FE2 — erro sem dados
  it('erro ao carregar mostra a mensagem e "Tentar novamente" funciona', async () => {
    let attempt = 0
    captureListRequests(() =>
      ++attempt === 1
        ? apiError(503, 'SERVICE_UNAVAILABLE', 'Banco de dados temporariamente indisponível.')
        : HttpResponse.json(makeList([makeIncident({ title: 'Voltou' })])),
    )
    const { user } = renderApp('/')

    expect(await screen.findByText('Não foi possível carregar os incidentes.')).toBeInTheDocument()
    expect(screen.getByText('Banco de dados temporariamente indisponível.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    expect(await screen.findByText('Voltou')).toBeInTheDocument()
  })

  it('falha ao atualizar mantém a lista na tela com um aviso', async () => {
    let attempt = 0
    captureListRequests(() =>
      ++attempt === 1
        ? HttpResponse.json(makeList([makeIncident({ title: 'Dado anterior' })]))
        : HttpResponse.error(),
    )
    const { user } = renderApp('/')
    await screen.findByText('Dado anterior')

    await user.click(screen.getByRole('button', { name: 'Atualizar agora' }))

    expect(await screen.findByText(/não foi possível atualizar/i)).toBeInTheDocument()
    expect(screen.getByText('Dado anterior')).toBeInTheDocument()
  })

  // FE3 — vazio
  it('sem incidentes na fila padrão, informa que está tudo em dia', async () => {
    renderApp('/')

    expect(await screen.findByText('Nenhum incidente aguardando ação.')).toBeInTheDocument()
  })

  it('sem resultado para os filtros, oferece limpar os filtros', async () => {
    const requests = captureListRequests(() => HttpResponse.json(makeList([])))
    const { user } = renderApp('/?criticality=HIGH&category=ROAD_BLOCKED')

    expect(await screen.findByText('Nenhum incidente com esses filtros.')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: /limpar filtros/i })[0])

    await waitFor(() => expect(requests.at(-1)?.getAll('criticality')).toEqual([]))
    expect(requests.at(-1)?.getAll('status')).toEqual(['OPEN', 'INVESTIGATING'])
  })

  // FE4 — prioridade visível
  it('renderiza 100 incidentes na ordem da API, com criticidade em texto e não só cor', async () => {
    const items = [
      makeIncident({
        title: 'Engavetamento com vítimas',
        criticality: 'HIGH',
        category: 'ACCIDENT_WITH_VICTIMS',
      }),
      ...Array.from({ length: 99 }, (_, index) => makeIncident({ title: `Pneu ${index}` })),
    ]
    captureListRequests(() => HttpResponse.json(makeList(items)))

    renderApp('/')

    await screen.findByText('Engavetamento com vítimas')
    const rows = incidentRows()
    expect(rows).toHaveLength(100)
    expect(within(rows[0]).getByText('Alta')).toBeInTheDocument()
    expect(within(rows[0]).getByText('Urgente')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Baixa')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('destaca o incidente aberto acima do SLA da sua criticidade', async () => {
    captureListRequests(() =>
      HttpResponse.json(
        makeList([
          makeIncident({ title: 'Alta atrasada', criticality: 'HIGH', reported_at: minutesAgo(30) }),
          makeIncident({ title: 'Média no prazo', criticality: 'MEDIUM', reported_at: minutesAgo(30) }),
          makeIncident({
            title: 'Alta já assumida',
            criticality: 'HIGH',
            status: 'INVESTIGATING',
            assigned_to: { id: 2, name: 'Bruno Costa' },
            reported_at: minutesAgo(90),
          }),
        ]),
      ),
    )

    renderApp('/')

    await screen.findByText('Alta atrasada')
    const [late, onTime, claimed] = incidentRows()
    expect(within(late).getByText(/acima do SLA/)).toBeInTheDocument()
    expect(within(onTime).queryByText(/acima do SLA/)).not.toBeInTheDocument()
    expect(within(claimed).queryByText(/acima do SLA/)).not.toBeInTheDocument()
    expect(within(claimed).getByText('Bruno Costa')).toBeInTheDocument()
  })

  // FE5 — filtros
  it('chip de filtro envia o parâmetro certo para a API e fica marcado', async () => {
    const requests = captureListRequests(() => HttpResponse.json(makeList([makeIncident()])))
    const { user } = renderApp('/')
    await screen.findByRole('list', { name: /incidentes/i })

    const highChip = screen.getByRole('button', { name: 'Alta' })
    await user.click(highChip)

    await waitFor(() => expect(requests.at(-1)?.getAll('criticality')).toEqual(['HIGH']))
    expect(requests.at(-1)?.getAll('status')).toEqual(['OPEN', 'INVESTIGATING'])
    expect(highChip).toHaveAttribute('aria-pressed', 'true')
  })

  it('filtros vindos da URL são aplicados ao abrir (link compartilhável)', async () => {
    const requests = captureListRequests(() => HttpResponse.json(makeList([])))

    renderApp('/?status=CLOSED&category=ACCIDENT_WITH_VICTIMS&q=pneu&criticality=INVALIDO')

    await waitFor(() => expect(requests).toHaveLength(1))
    expect(requests[0].getAll('status')).toEqual(['CLOSED'])
    expect(requests[0].getAll('category')).toEqual(['ACCIDENT_WITH_VICTIMS'])
    expect(requests[0].get('q')).toBe('pneu')
    expect(requests[0].getAll('criticality')).toEqual([])
    expect(await screen.findByLabelText('Buscar incidentes')).toHaveValue('pneu')
  })

  it('busca espera a digitação parar antes de chamar a API', async () => {
    const requests = captureListRequests(() => HttpResponse.json(makeList([])))
    const { user } = renderApp('/')
    await waitFor(() => expect(requests).toHaveLength(1))

    await user.type(screen.getByLabelText('Buscar incidentes'), 'neblina')

    await waitFor(() => expect(requests.at(-1)?.get('q')).toBe('neblina'))
    const searches = requests.filter((params) => params.get('q'))
    expect(searches).toHaveLength(1)
  })

  it('cards de resumo mostram os contadores e aplicam o filtro ao clicar', async () => {
    const summary: IncidentSummary = {
      ...emptySummary,
      by_status: { OPEN: 60, INVESTIGATING: 19, CLOSED: 15, INCONCLUSIVE: 6 },
      open_by_criticality: { HIGH: 13, MEDIUM: 25, LOW: 22 },
    }
    server.use(http.get(apiUrl('/incidents/summary'), () => HttpResponse.json(summary)))
    const requests = captureListRequests(() => HttpResponse.json(makeList([])))
    const { user } = renderApp('/')

    const highCard = await screen.findByRole('button', { name: /alta, sem responsável/i })
    // O card aparece antes do número (esqueleto enquanto o resumo carrega).
    expect(await within(highCard).findByText('13')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /encerrados/i })).toHaveTextContent('21')

    await user.click(highCard)

    await waitFor(() => expect(requests.at(-1)?.getAll('criticality')).toEqual(['HIGH']))
    expect(requests.at(-1)?.getAll('status')).toEqual(['OPEN'])
    expect(highCard).toHaveAttribute('aria-pressed', 'true')
  })

  it('pagina quando há mais de 100 resultados', async () => {
    const requests = captureListRequests(() =>
      HttpResponse.json(makeList([makeIncident()], { total: 150 })),
    )
    const { user } = renderApp('/')

    expect(await screen.findByText('1–1 de 150')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Próxima' }))

    await waitFor(() => expect(requests.at(-1)?.get('offset')).toBe('100'))
  })
})
