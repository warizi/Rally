import { MutableRefObject, useState, useCallback, useRef, useEffect } from 'react'
import Papa from 'papaparse'
import { useWriteCsvContent } from '@entities/csv-file'

type Snapshot = { headers: string[]; data: string[][] }

const MAX_HISTORY = 50

export interface UseCsvEditorReturn {
  data: string[][]
  headers: string[]
  updateCell: (rowIndex: number, colIndex: number, value: string) => void
  updateCells: (changes: { row: number; col: number; value: string }[]) => void
  addRow: () => void
  addRowAt: (index: number) => void
  removeRow: (rowIndex: number) => void
  addColumn: (name?: string) => void
  addColumnAt: (index: number, name?: string) => void
  removeColumn: (colIndex: number) => void
  renameColumn: (colIndex: number, name: string) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  isDirty: boolean
  reset: (content: string) => void
  lastWrittenRef: MutableRefObject<string | null>
}

function parseCsv(content: string): { headers: string[]; data: string[][] } {
  if (!content.trim()) {
    return { headers: [], data: [] }
  }
  const result = Papa.parse<string[]>(content, {
    header: false,
    skipEmptyLines: true
  })
  const rows = result.data
  if (rows.length === 0) return { headers: [], data: [] }
  return {
    headers: rows[0],
    data: rows.slice(1)
  }
}

function serializeCsv(headers: string[], data: string[][]): string {
  return Papa.unparse([headers, ...data])
}

export function useCsvEditor(
  workspaceId: string,
  csvId: string,
  initialContent: string
): UseCsvEditorReturn {
  const parsed = parseCsv(initialContent)
  const [headers, setHeaders] = useState<string[]>(parsed.headers)
  const [data, setData] = useState<string[][]>(parsed.data)
  const [isDirty, setIsDirty] = useState(false)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastWrittenRef = useRef<string | null>(null)
  const { mutate: writeCsv } = useWriteCsvContent()

  // --- 최신 state ref (closure 대신 사용) ---
  const headersRef = useRef(headers)
  const dataRef = useRef(data)
  // eslint-disable-next-line react-hooks/refs
  headersRef.current = headers
  // eslint-disable-next-line react-hooks/refs
  dataRef.current = data

  // --- History ---
  const historyRef = useRef<Snapshot[]>([{ headers: parsed.headers, data: parsed.data }])
  const historyIndexRef = useRef(0)

  const pushHistory = useCallback((h: string[], d: string[][]) => {
    const stack = historyRef.current.slice(0, historyIndexRef.current + 1)
    stack.push({ headers: h, data: d })
    if (stack.length > MAX_HISTORY) stack.shift()
    historyRef.current = stack
    historyIndexRef.current = stack.length - 1
    setCanUndo(historyIndexRef.current > 0)
    setCanRedo(false)
  }, [])

  // 자동 저장 (800ms debounce)
  const scheduleSave = useCallback(
    (newHeaders: string[], newData: string[][]) => {
      setIsDirty(true)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const content = serializeCsv(newHeaders, newData)
        lastWrittenRef.current = content
        writeCsv({ workspaceId, csvId, content })
        setIsDirty(false)
      }, 800)
    },
    [workspaceId, csvId, writeCsv]
  )

  // 언마운트 시 debounce 정리
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // --- 공통 적용 ---
  const applyMutation = useCallback(
    (newHeaders: string[], newData: string[][]) => {
      pushHistory(newHeaders, newData)
      setHeaders(newHeaders)
      setData(newData)
      scheduleSave(newHeaders, newData)
    },
    [pushHistory, scheduleSave]
  )

  // --- Undo / Redo ---
  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return
    historyIndexRef.current -= 1
    const snap = historyRef.current[historyIndexRef.current]
    setHeaders(snap.headers)
    setData(snap.data)
    setCanUndo(historyIndexRef.current > 0)
    setCanRedo(true)
    scheduleSave(snap.headers, snap.data)
  }, [scheduleSave])

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return
    historyIndexRef.current += 1
    const snap = historyRef.current[historyIndexRef.current]
    setHeaders(snap.headers)
    setData(snap.data)
    setCanUndo(true)
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1)
    scheduleSave(snap.headers, snap.data)
  }, [scheduleSave])

  // --- Mutations (ref 기반 — deps에 data/headers 없음) ---
  const updateCell = useCallback(
    (rowIndex: number, colIndex: number, value: string) => {
      const h = headersRef.current
      const d = dataRef.current
      const next = d.map((row) => [...row])
      if (next[rowIndex]) {
        next[rowIndex][colIndex] = value
      }
      applyMutation(h, next)
    },
    [applyMutation]
  )

  const updateCells = useCallback(
    (changes: { row: number; col: number; value: string }[]) => {
      const h = headersRef.current
      const d = dataRef.current
      const next = d.map((row) => [...row])
      for (const { row, col, value } of changes) {
        if (next[row]) {
          next[row][col] = value
        }
      }
      applyMutation(h, next)
    },
    [applyMutation]
  )

  const addRow = useCallback(() => {
    const h = headersRef.current
    const d = dataRef.current
    const newRow = new Array(h.length).fill('')
    const next = [...d, newRow]
    applyMutation(h, next)
  }, [applyMutation])

  const addRowAt = useCallback(
    (index: number) => {
      const h = headersRef.current
      const d = dataRef.current
      const newRow = new Array(h.length).fill('')
      const next = [...d]
      next.splice(index, 0, newRow)
      applyMutation(h, next)
    },
    [applyMutation]
  )

  const removeRow = useCallback(
    (rowIndex: number) => {
      const h = headersRef.current
      const d = dataRef.current
      const next = d.filter((_, i) => i !== rowIndex)
      applyMutation(h, next)
    },
    [applyMutation]
  )

  const addColumn = useCallback(
    (name?: string) => {
      const h = headersRef.current
      const d = dataRef.current
      const colName = name || `열${h.length + 1}`
      const newHeaders = [...h, colName]
      const newData = d.map((row) => [...row, ''])
      applyMutation(newHeaders, newData)
    },
    [applyMutation]
  )

  const addColumnAt = useCallback(
    (index: number, name?: string) => {
      const h = headersRef.current
      const d = dataRef.current
      const colName = name || `열${h.length + 1}`
      const newHeaders = [...h]
      newHeaders.splice(index, 0, colName)
      const newData = d.map((row) => {
        const r = [...row]
        r.splice(index, 0, '')
        return r
      })
      applyMutation(newHeaders, newData)
    },
    [applyMutation]
  )

  const removeColumn = useCallback(
    (colIndex: number) => {
      const h = headersRef.current
      const d = dataRef.current
      const newHeaders = h.filter((_, i) => i !== colIndex)
      const newData = d.map((row) => row.filter((_, i) => i !== colIndex))
      applyMutation(newHeaders, newData)
    },
    [applyMutation]
  )

  const renameColumn = useCallback(
    (colIndex: number, name: string) => {
      const d = dataRef.current
      const newHeaders = [...headersRef.current]
      newHeaders[colIndex] = name
      applyMutation(newHeaders, d)
    },
    [applyMutation]
  )

  const reset = useCallback((content: string) => {
    const p = parseCsv(content)
    setHeaders(p.headers)
    setData(p.data)
    setIsDirty(false)
    setCanUndo(false)
    setCanRedo(false)
    headersRef.current = p.headers
    dataRef.current = p.data
    historyRef.current = [{ headers: p.headers, data: p.data }]
    historyIndexRef.current = 0
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }, [])

  return {
    data,
    headers,
    updateCell,
    updateCells,
    addRow,
    addRowAt,
    removeRow,
    addColumn,
    addColumnAt,
    removeColumn,
    renameColumn,
    undo,
    redo,
    canUndo,
    canRedo,
    isDirty,
    reset,
    lastWrittenRef
  }
}
