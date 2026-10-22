import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import type { Incident } from '@/api/types'
import { tokenStorage } from '@/features/auth/token-storage'
import { makeIncident, makeList } from '@/test/factories'
import { renderApp } from '@/test/render'
import { apiUrl, server } from '@/test/server'

type User = ReturnType<typeof renderApp>['user']

beforeEach(() => tokenStorage.set('token-valido'))

async function openCreateForm() {
  const view = renderApp('/')
  await view.user.click(await screen.findByRole('button', { name: 'Novo incidente' }))
  const form = await screen.findByRole('dialog', { name: 'Novo incidente' })
  return { ...view, form }
}

async function fillValidForm(user: User, form: HTMLElement) {
  await user.type(within(form).getByLabelText('Título'), 'Capotamento na serra')
  await user.selectOptions(within(form).getByLabelText('Categoria'), 'ACCIDENT_WITH_VICTIMS')
  await user.type(within(form).getByLabelText('Placa'), 'xyz-9a87')
  await user.type(within(form).getByLabelText('Rodovia'), 'br-040')
  await user.type(within(form).getByLabelText('Km'), '84.5')
  await user.type(within(form).getByLabelText('Cidade'), 'Petrópolis')
  await user.selectOptions(within(form).getByLabelText('UF'), 'RJ')
}

describe('criar incidente', () => {
  it('registra com dados normalizados e chave de idempotência, e abre o incidente criado', async () => {
    let body: unknown
    let idempotencyKey: string | null = null
    const created = makeIncident({ id: 500, title: 'Capotamento na serra', criticality: 'HIGH' })
    server.use(
      http.post(apiUrl('/incidents'), async ({ request }) => {
        body = await request.json()
        idempotencyKey = request.headers.get('Idempotency-Key')
        return HttpResponse.json(created, { status: 201 })
      }),
      http.get(apiUrl('/incidents/500'), () => HttpResponse.json(created)),
      http.get(apiUrl('/incidents/500/events'), () => HttpResponse.json([])),
    )
    const { user, form } = await openCreateForm()

    await fillValidForm(user, form)
    await user.click(within(form).getByRole('button', { name: 'Registrar incidente' }))

    expect(await screen.findByText('Incidente registrado.')).toBeInTheDocument()
    expect(body).toEqual({
      title: 'Capotamento na serra',
      category: 'ACCIDENT_WITH_VICTIMS',
      criticality: 'HIGH',
      vehicle_plate: 'XYZ9A87',
      highway: 'BR-040',
      km: 84.5,
      city: 'Petrópolis',
      state: 'RJ',
      description: null,
    })
    expect(idempotencyKey).toMatch(/^[0-9a-f-]{36}$/)
    const drawer = await screen.findByRole('dialog', { name: 'Capotamento na serra' })
    expect(drawer).toBeInTheDocument()
  })

  it('valida os campos antes de chamar a API', async () => {
    const { user, form } = await openCreateForm()

    await user.click(within(form).getByRole('button', { name: 'Registrar incidente' }))

    for (const message of [
      'Informe um título.',
      'Escolha a categoria.',
      'Escolha a criticidade.',
      'Informe a placa.',
      'Informe a rodovia.',
      'Informe o km.',
      'Informe a cidade.',
      'Escolha a UF.',
    ]) {
      expect(await within(form).findByText(message)).toBeInTheDocument()
    }
    // Nenhum handler de POST foi definido: se a API fosse chamada, o MSW falharia o teste.
  })

  it.each([
    ['Placa', '1234ABC', 'Placa inválida. Ex.: ABC1D23 ou ABC1234.'],
    ['Rodovia', 'Rodovia 116', 'Use o formato BR-116.'],
    ['Km', '12.34', 'Use no máximo uma casa decimal.'],
  ])('rejeita %s inválida', async (label, value, message) => {
    const { user, form } = await openCreateForm()

    await user.type(within(form).getByLabelText(label), value)
    await user.click(within(form).getByRole('button', { name: 'Registrar incidente' }))

    expect(await within(form).findByText(message)).toBeInTheDocument()
  })

  it('sugere a criticidade pela categoria até o analista escolher outra', async () => {
    const { user, form } = await openCreateForm()
    const category = within(form).getByLabelText('Categoria')
    const radio = (name: RegExp) => within(form).getByRole('radio', { name })

    await user.selectOptions(category, 'ACCIDENT_WITH_VICTIMS')
    expect(radio(/alta/i)).toBeChecked()
    expect(within(form).getByText(/sugerida pela categoria/i)).toBeInTheDocument()

    await user.selectOptions(category, 'MECHANICAL_FAILURE')
    expect(radio(/baixa/i)).toBeChecked()

    // Depois de uma escolha manual, trocar a categoria não muda mais a criticidade.
    await user.click(radio(/média/i))
    await user.selectOptions(category, 'ACCIDENT_WITH_VICTIMS')
    expect(radio(/média/i)).toBeChecked()
  })

  it('mostra o erro da API quando ela recusa o envio', async () => {
    server.use(
      http.post(apiUrl('/incidents'), () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Dados inválidos.',
              details: { fields: [{ field: 'city', message: 'x', type: 'string_too_short' }] },
            },
          },
          { status: 422 },
        ),
      ),
    )
    const { user, form } = await openCreateForm()

    await fillValidForm(user, form)
    await user.click(within(form).getByRole('button', { name: 'Registrar incidente' }))

    expect(await within(form).findByText('Dados inválidos.')).toBeInTheDocument()
    expect(within(form).getByText('Valor recusado pela API.')).toBeInTheDocument()
    expect(within(form).getByLabelText('Cidade')).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('editar e excluir incidente', () => {
  function serve(incident: Incident) {
    server.use(
      http.get(apiUrl('/incidents'), () => HttpResponse.json(makeList([incident]))),
      http.get(apiUrl(`/incidents/${incident.id}`), () => HttpResponse.json(incident)),
      http.get(apiUrl(`/incidents/${incident.id}/events`), () => HttpResponse.json([])),
    )
  }

  async function openDrawer(incident: Incident) {
    const view = renderApp(`/?incident=${incident.id}`)
    const drawer = await screen.findByRole('dialog', { name: incident.title })
    return { ...view, drawer }
  }

  it('salva só os campos alterados, com a versão lida', async () => {
    const incident = makeIncident({ title: 'Pneu furado', version: 3 })
    serve(incident)
    let body: unknown
    server.use(
      http.patch(apiUrl(`/incidents/${incident.id}`), async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ ...incident, title: 'Pneu furado - socorro a caminho', version: 4 })
      }),
    )
    const { user, drawer } = await openDrawer(incident)

    await user.click(within(drawer).getByRole('button', { name: 'Editar' }))
    const form = await screen.findByRole('dialog', { name: 'Editar incidente' })
    await user.clear(within(form).getByLabelText('Título'))
    await user.type(within(form).getByLabelText('Título'), 'Pneu furado - socorro a caminho')
    await user.click(within(form).getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByText('Alterações salvas.')).toBeInTheDocument()
    expect(body).toEqual({ title: 'Pneu furado - socorro a caminho', version: 3 })
  })

  it('edição em conflito (409) fecha o formulário e mostra os dados atuais', async () => {
    const incident = makeIncident({ title: 'Original', version: 1 })
    serve(incident)
    const current = { ...incident, title: 'Alterado por outra pessoa', version: 2 }
    server.use(
      http.patch(apiUrl(`/incidents/${incident.id}`), () => {
        serve(current)
        return HttpResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message: 'Este incidente foi alterado por outra pessoa. Os dados foram atualizados.',
              details: { current },
            },
          },
          { status: 409 },
        )
      }),
    )
    const { user, drawer } = await openDrawer(incident)

    await user.click(within(drawer).getByRole('button', { name: 'Editar' }))
    const form = await screen.findByRole('dialog', { name: 'Editar incidente' })
    await user.type(within(form).getByLabelText('Título'), ' editado')
    await user.click(within(form).getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByText('Outro analista alterou este incidente')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Editar incidente' })).not.toBeInTheDocument(),
    )
    expect(await screen.findByRole('dialog', { name: 'Alterado por outra pessoa' })).toBeInTheDocument()
  })

  it('exclui após confirmação, enviando a versão, e fecha a gaveta', async () => {
    const incident = makeIncident({ title: 'Duplicado por engano', version: 5 })
    serve(incident)
    let version: string | null = null
    server.use(
      http.delete(apiUrl(`/incidents/${incident.id}`), ({ request }) => {
        version = new URL(request.url).searchParams.get('version')
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user, drawer } = await openDrawer(incident)

    await user.click(within(drawer).getByRole('button', { name: 'Excluir' }))
    const confirm = await screen.findByRole('alertdialog')
    await user.click(within(confirm).getByRole('button', { name: 'Excluir incidente' }))

    expect(await screen.findByText('Incidente excluído.')).toBeInTheDocument()
    expect(version).toBe('5')
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Duplicado por engano' })).not.toBeInTheDocument(),
    )
  })

  it('cancelar a confirmação não exclui', async () => {
    const incident = makeIncident({ title: 'Fica' })
    serve(incident)
    const { user, drawer } = await openDrawer(incident)

    await user.click(within(drawer).getByRole('button', { name: 'Excluir' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }))

    expect(screen.getByRole('dialog', { name: 'Fica' })).toBeInTheDocument()
    // Nenhum handler de DELETE foi definido: se a API fosse chamada, o MSW falharia o teste.
  })
})
