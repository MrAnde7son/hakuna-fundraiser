import { useSearchParams } from 'react-router-dom'
import { useCallback } from 'react'

/**
 * Sync a flat object of filter values with URL search params.
 * - Empty strings / null / undefined are omitted from the URL.
 * - `defaults` specifies the value to return when a param is missing.
 */
export default function useSearchParamsState(defaults) {
  const [searchParams, setSearchParams] = useSearchParams()

  const state = {}
  for (const [key, defaultValue] of Object.entries(defaults)) {
    const raw = searchParams.get(key)
    if (raw === null || raw === '') {
      state[key] = defaultValue
    } else if (typeof defaultValue === 'number') {
      const n = Number(raw)
      state[key] = Number.isNaN(n) ? defaultValue : n
    } else {
      state[key] = raw
    }
  }

  const setState = useCallback(
    (patch) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        const updates = typeof patch === 'function' ? patch(state) : patch
        for (const [key, value] of Object.entries(updates)) {
          if (value === null || value === undefined || value === '' || value === defaults[key]) {
            next.delete(key)
          } else {
            next.set(key, String(value))
          }
        }
        return next
      }, { replace: true })
    },
    [setSearchParams, state, defaults],
  )

  return [state, setState]
}
