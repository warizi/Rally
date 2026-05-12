import { useCallback, useEffect, useRef, type JSX } from 'react'
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react'

interface Props {
  open: boolean
  query: string
  matchCount: number
  activeIndex: number
  onQueryChange: (q: string) => void
  onNext: () => void
  onPrev: () => void
  onClose: () => void
}

/**
 * 파일 탐색기 검색 바.
 *
 * - 250ms 디바운스는 호출 측 (useFolderSearch) 에서 처리
 * - Enter / Shift+Enter / Escape 단축키
 * - 매치 카운터 (n/total) 표시
 * - open 시 자동 focus
 */
export function FolderTreeSearchBar({
  open,
  query,
  matchCount,
  activeIndex,
  onQueryChange,
  onNext,
  onPrev,
  onClose
}: Props): JSX.Element | null {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      const handle = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(handle)
    }
    return undefined
  }, [open])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (e.shiftKey) onPrev()
        else onNext()
      }
    },
    [onClose, onNext, onPrev]
  )

  if (!open) return null

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 mt-1 mb-2 mx-2 rounded-md border border-border bg-background/95 backdrop-blur-sm">
      <Search className="size-3.5 text-muted-foreground shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="검색..."
        className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      {query && (
        <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
          {matchCount > 0 ? `${activeIndex + 1}/${matchCount}` : '결과 없음'}
        </span>
      )}
      <button
        type="button"
        onClick={onPrev}
        disabled={matchCount === 0}
        aria-label="이전 매치"
        className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
      >
        <ChevronUp className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={matchCount === 0}
        aria-label="다음 매치"
        className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
      >
        <ChevronDown className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label="검색 닫기"
        className="p-0.5 rounded hover:bg-muted"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}
