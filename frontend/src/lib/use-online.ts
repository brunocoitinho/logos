import { onlineManager } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'

/**
 * Se o navegador está conectado, pela mesma fonte que o TanStack Query usa para pausar
 * requisições sem rede: a tela e o cache nunca discordam sobre estar offline.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
  )
}
