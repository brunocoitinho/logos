import { AlertTriangle, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function FullPageLoader({ label = 'Carregando...' }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-svh items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <span>{label}</span>
    </div>
  )
}

export function FullPageError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <AlertTriangle className="size-8 text-destructive" aria-hidden />
      <p className="max-w-sm text-muted-foreground">{message}</p>
      <Button onClick={onRetry}>Tentar novamente</Button>
    </div>
  )
}
