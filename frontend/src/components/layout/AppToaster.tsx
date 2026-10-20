import { Toaster } from 'sonner'

import { useTheme } from '@/features/theme/theme-context'

export function AppToaster() {
  const { resolvedTheme } = useTheme()
  return <Toaster theme={resolvedTheme} position="top-right" richColors closeButton />
}
