import { useCallback } from 'react'
import { useSearchParams } from 'react-router'

/**
 * Incidente aberto na gaveta, guardado na URL (?incident=42): F5 mantém a gaveta aberta,
 * "voltar" fecha e o link de um incidente específico pode ser compartilhado.
 */
export function useSelectedIncident() {
  const [searchParams, setSearchParams] = useSearchParams()
  const raw = Number(searchParams.get('incident'))
  const selectedId = Number.isInteger(raw) && raw > 0 ? raw : null

  const open = useCallback(
    (id: number) =>
      setSearchParams((current) => {
        const next = new URLSearchParams(current)
        next.set('incident', String(id))
        return next
      }),
    [setSearchParams],
  )

  const close = useCallback(
    () =>
      setSearchParams((current) => {
        const next = new URLSearchParams(current)
        next.delete('incident')
        return next
      }),
    [setSearchParams],
  )

  return { selectedId, open, close }
}
