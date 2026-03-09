import { JSX, useCallback, useEffect, useRef, useState } from 'react'
import { useInstance } from '@milkdown/react'
import { editorViewCtx } from '@milkdown/core'
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react'
import { searchPluginKey } from '../model/note-search-plugin'

interface NoteSearchBarProps {
  open: boolean
  onClose: () => void
}

export function NoteSearchBar({ open, onClose }: NoteSearchBarProps): JSX.Element | null {
  const [term, setTerm] = useState('')
  const [matchCount, setMatchCount] = useState(0)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const [, getEditor] = useInstance()

  const updateSearch = useCallback(
    (searchTerm: string, index: number) => {
      const editor = getEditor()
      if (!editor) return
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        // 검색어 + 활성 인덱스 업데이트
        const tr = view.state.tr.setMeta(searchPluginKey, {
          term: searchTerm,
          activeIndex: index
        })
        view.dispatch(tr)

        // dispatch 후 새 상태에서 매치 정보 읽기
        const pluginState = searchPluginKey.getState(view.state)
        const matches = pluginState?.matches ?? []
        setMatchCount(matches.length)

        // 활성 하이라이트 DOM 요소로 스크롤
        if (matches.length > 0 && index >= 0 && index < matches.length) {
          requestAnimationFrame(() => {
            const el = view.dom.querySelector('.search-highlight-active')
            if (el) {
              el.scrollIntoView({ block: 'center', behavior: 'smooth' })
            }
          })
        }
      })
    },
    [getEditor]
  )

  const handleChange = useCallback(
    (value: string) => {
      setTerm(value)
      setActiveIndex(-1)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const idx = value ? 0 : -1
        setActiveIndex(idx)
        updateSearch(value, idx)
      }, 200)
    },
    [updateSearch]
  )

  const goNext = useCallback(() => {
    if (matchCount === 0) return
    const next = (activeIndex + 1) % matchCount
    setActiveIndex(next)
    updateSearch(term, next)
  }, [activeIndex, matchCount, term, updateSearch])

  const goPrev = useCallback(() => {
    if (matchCount === 0) return
    const prev = (activeIndex - 1 + matchCount) % matchCount
    setActiveIndex(prev)
    updateSearch(term, prev)
  }, [activeIndex, matchCount, term, updateSearch])

  const handleClose = useCallback(() => {
    setTerm('')
    setMatchCount(0)
    setActiveIndex(-1)
    updateSearch('', -1)
    onClose()
  }, [onClose, updateSearch])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      } else if (e.key === 'Enter') {
        if (e.shiftKey) {
          goPrev()
        } else {
          goNext()
        }
        e.preventDefault()
      }
    },
    [handleClose, goNext, goPrev]
  )

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  if (!open) return null

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border bg-background/95 backdrop-blur-sm">
      <Search className="size-3.5 text-muted-foreground shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={term}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="검색..."
        className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      {term && (
        <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
          {matchCount > 0 ? `${activeIndex + 1}/${matchCount}` : '결과 없음'}
        </span>
      )}
      <button
        onClick={goPrev}
        disabled={matchCount === 0}
        className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
      >
        <ChevronUp className="size-3.5" />
      </button>
      <button
        onClick={goNext}
        disabled={matchCount === 0}
        className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
      >
        <ChevronDown className="size-3.5" />
      </button>
      <button onClick={handleClose} className="p-0.5 rounded hover:bg-muted">
        <X className="size-3.5" />
      </button>
    </div>
  )
}
