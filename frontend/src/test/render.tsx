import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'

import { AppToaster } from '@/components/layout/AppToaster'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { ThemeProvider } from '@/features/theme/ThemeProvider'
import { createQueryClient } from '@/lib/query-client'
import { AppRoutes } from '@/routes'

interface RenderOptions {
  route?: string
}

/** Renderiza com os mesmos providers do app, mas com roteador em memória e cache novo. */
export function renderWithProviders(ui: ReactElement, { route = '/' }: RenderOptions = {}) {
  const queryClient = createQueryClient()
  // Nos testes, falhas aparecem na hora: sem esperar as tentativas automáticas.
  queryClient.setDefaultOptions({
    ...queryClient.getDefaultOptions(),
    queries: { ...queryClient.getDefaultOptions().queries, retry: false },
  })

  const result = render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          <AuthProvider>{ui}</AuthProvider>
        </MemoryRouter>
        <AppToaster />
      </QueryClientProvider>
    </ThemeProvider>,
  )

  return { ...result, user: userEvent.setup(), queryClient }
}

/** Atalho: o app inteiro (rotas reais) a partir de uma URL. */
export function renderApp(route = '/') {
  return renderWithProviders(<AppRoutes />, { route })
}
