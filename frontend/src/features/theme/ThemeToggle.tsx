import { Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { useTheme } from './theme-context'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const label = isDark ? 'Ativar tema claro' : 'Ativar tema escuro'

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={label}
      title={label}
    >
      {isDark ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </Button>
  )
}
