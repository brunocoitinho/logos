import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/test/render'

import { ThemeToggle } from './ThemeToggle'

// FE10 — tema claro/escuro
describe('tema', () => {
  it('alterna para o escuro, aplica a classe e lembra da escolha', async () => {
    const { user } = renderWithProviders(<ThemeToggle />)

    await user.click(screen.getByRole('button', { name: 'Ativar tema escuro' }))

    expect(document.documentElement).toHaveClass('dark')
    expect(localStorage.getItem('logos.theme')).toBe('dark')
    expect(screen.getByRole('button', { name: 'Ativar tema claro' })).toBeInTheDocument()
  })

  it('volta para o claro', async () => {
    localStorage.setItem('logos.theme', 'dark')
    const { user } = renderWithProviders(<ThemeToggle />)

    await user.click(screen.getByRole('button', { name: 'Ativar tema claro' }))

    expect(document.documentElement).not.toHaveClass('dark')
    expect(localStorage.getItem('logos.theme')).toBe('light')
  })

  it('respeita a escolha salva ao abrir o app', () => {
    localStorage.setItem('logos.theme', 'dark')

    renderWithProviders(<ThemeToggle />)

    expect(document.documentElement).toHaveClass('dark')
  })
})
