import { WifiOff } from 'lucide-react'

import { useOnline } from '@/lib/use-online'

export function OfflineBanner() {
  const online = useOnline()
  if (online) return null

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border-b border-critical-medium/30 bg-critical-medium/10 px-4 py-2 text-sm text-foreground"
    >
      <WifiOff className="size-4 text-critical-medium" aria-hidden />
      Sem conexão. Exibindo os últimos dados recebidos; as ações voltam quando a conexão retornar.
    </div>
  )
}
