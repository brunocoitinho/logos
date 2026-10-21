import { Toaster } from 'sonner'

import { useTheme } from '@/features/theme/theme-context'

export function AppToaster() {
  const { resolvedTheme } = useTheme()
  // Topo central: no canto direito, os avisos cobririam o cabeçalho da gaveta de detalhe.
  return <Toaster theme={resolvedTheme} position="top-center" richColors closeButton />
}
