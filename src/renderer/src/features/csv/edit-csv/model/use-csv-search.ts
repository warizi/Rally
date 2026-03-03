import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import type { CellPos } from './types'

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    timerRef.current = setTimeout(() => setDebounced(value), delay)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [value, delay])

  return debounced
}

export function useCsvSearch(data: string[][], headers: string[]) {
  const [query, setQuery] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const debouncedQuery = useDebouncedValue(query, 200)

  const matches = useMemo(() => {
    if (!debouncedQuery) return []
    const q = debouncedQuery.toLowerCase()
    const result: CellPos[] = []

    // search headers
    for (let col = 0; col < headers.length; col++) {
      if (headers[col].toLowerCase().includes(q)) {
        result.push({ row: -1, col })
      }
    }

    // search data
    for (let row = 0; row < data.length; row++) {
      for (let col = 0; col < data[row].length; col++) {
        if (data[row][col].toLowerCase().includes(q)) {
          result.push({ row, col })
        }
      }
    }

    return result
  }, [debouncedQuery, data, headers])

  // clamp currentIndex when matches change
  const clampedIndex = matches.length === 0 ? 0 : currentIndex % matches.length

  const currentMatch = matches.length > 0 ? (matches[clampedIndex] ?? null) : null

  const next = useCallback(() => {
    setCurrentIndex((i) => (matches.length === 0 ? 0 : (i + 1) % matches.length))
  }, [matches.length])

  const prev = useCallback(() => {
    setCurrentIndex((i) => (matches.length === 0 ? 0 : (i - 1 + matches.length) % matches.length))
  }, [matches.length])

  const handleSetQuery = useCallback((q: string) => {
    setQuery(q)
    setCurrentIndex(0)
  }, [])

  const matchedCells = useMemo(() => {
    const set = new Set<string>()
    for (const m of matches) {
      set.add(`${m.row}_${m.col}`)
    }
    return set
  }, [matches])

  return {
    query,
    setQuery: handleSetQuery,
    matches,
    currentIndex: clampedIndex,
    currentMatch,
    matchedCells,
    next,
    prev
  }
}
