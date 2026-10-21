import { RotateCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useNow } from '@/lib/use-now'

interface FreshnessIndicatorProps {
  updatedAt: number
  isFetching: boolean
  onRefresh: () => void
}

/** Mostra que a tela está viva: quando foi a última atualização e se há uma em andamento. */
export function FreshnessIndicator({ updatedAt, isFetching, onRefresh }: FreshnessIndicatorProps) {
  const now = useNow(1_000)
  const seconds = Math.max(0, Math.round((now - updatedAt) / 1000))

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground" aria-live="polite">
      <span className="tabular-nums">
        {isFetching ? 'Atualizando...' : updatedAt ? `Atualizado há ${seconds} s` : ''}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={onRefresh}
        disabled={isFetching}
        aria-label="Atualizar agora"
        title="Atualizar agora"
      >
        <RotateCw className={cn('size-3.5', isFetching && 'animate-spin')} aria-hidden />
      </Button>
    </div>
  )
}
