import { useEffect, useState } from 'react'

/** Momento atual que se atualiza sozinho: faz tempos relativos ("há 5 min") andarem na tela. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])

  return now
}
