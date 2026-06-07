import { useState, useCallback, useRef, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@shared/ui/dialog'
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty
} from '@shared/ui/command'
import { ScrollArea } from '@shared/ui/scroll-area'
import { useGlobalSearch, type SearchHit } from '@entities/search'
import { useTabStore } from '@/entities/tab-system'
import { ENTITY_TYPE_ICON } from '@shared/lib/entity-link'
import { useCurrentWorkspaceStore } from '@/shared/store/current-workspace'
import { useDebouncedValue } from '@shared/hooks/use-debounced-value'
import { useGlobalSearchStore } from '../model/store'
import { SEARCH_TO_LINKABLE, hitToTabOptions } from '../lib/hit-to-tab'

function ResultItem({
  hit,
  onSelect
}: {
  hit: SearchHit
  onSelect: (hit: SearchHit) => void
}): React.JSX.Element {
  const Icon = ENTITY_TYPE_ICON[SEARCH_TO_LINKABLE[hit.type]]
  return (
    <CommandItem
      value={`${hit.type}:${hit.id}`}
      onSelect={() => onSelect(hit)}
      className="flex items-center gap-2"
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm">{hit.title}</span>
        {hit.excerpt && (
          <span className="truncate text-xs text-muted-foreground">{hit.excerpt}</span>
        )}
      </div>
    </CommandItem>
  )
}

/**
 * 전체 검색 다이얼로그. open 상태는 useGlobalSearchStore(전역 단축키/사이드바에서 토글).
 * 일치(키워드) / 유사(벡터) 두 그룹으로 결과 표시, 항목 클릭 시 해당 도메인 탭 open.
 */
export function GlobalSearchDialog(): React.JSX.Element {
  const open = useGlobalSearchStore((s) => s.open)
  const setOpen = useGlobalSearchStore((s) => s.setOpen)
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId)
  const openTab = useTabStore((s) => s.openTab)
  const [query, setQuery] = useState('')
  // 매 keystroke IPC 호출 방지 — 입력은 즉시 반영, 검색은 200ms 디바운스.
  const debounced = useDebouncedValue(query, 200)

  const { data, isFetching } = useGlobalSearch(workspaceId, debounced)
  const exact = data?.exact ?? []
  const similar = data?.similar ?? []

  // 닫기 + query 초기화 (다음 오픈 시 새로 시작). effect 내 setState 회피 위해 명시 호출.
  const close = useCallback((): void => {
    setOpen(false)
    setQuery('')
  }, [setOpen])

  const handleSelect = useCallback(
    (hit: SearchHit): void => {
      openTab(hitToTabOptions(hit.type, hit.id, hit.title))
      close()
    },
    [openTab, close]
  )

  // 디바운스된 검색어 기준 — 타이핑 중간에 "결과 없음" 깜빡임 방지
  const showEmpty = !!debounced.trim() && !isFetching && exact.length === 0 && similar.length === 0

  // 결과 영역의 자연 높이를 측정 → 컨테이너 height 만 애니메이션(콘텐츠는 자연 크기 유지,
  // 위→아래로 펼쳐짐). framer layout(scale 투영)은 콘텐츠가 중앙에서 퍼지는 왜곡이 있어 사용 안 함.
  const contentRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState<number | 'auto'>('auto')
  // open 의존 — 다이얼로그는 닫히면 콘텐츠가 unmount(Radix)되므로, 열릴 때마다 RO 를 (재)부착.
  // mount 시 1회만 부착하면 닫힌 상태라 contentRef.current 가 null → RO 미부착 → 높이 고정 버그.
  useEffect(() => {
    if (!open) return
    const el = contentRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setContentHeight(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [open])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close()
      }}
    >
      <DialogContent className="overflow-hidden p-0" showCloseButton={false}>
        <DialogTitle className="sr-only">전체 검색</DialogTitle>
        <Command
          shouldFilter={false}
          className="flex flex-col [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium"
        >
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="전체 검색 (노트 · 표 · PDF · 이미지 · 캔버스 · 할일)"
          />
          {/* cmdk 자체 스크롤 제거 → 내부 ScrollArea(viewport max-h)가 스크롤.
              바깥 div 는 측정된 px 높이로 CSS height 트랜지션(콘텐츠는 자연 크기로 위→아래 펼쳐짐, 왜곡 없음). */}
          <CommandList className="max-h-none overflow-visible">
            <div
              style={{
                height: contentHeight === 'auto' ? undefined : contentHeight,
                transition: 'height 300ms ease-out'
              }}
              className="overflow-hidden"
            >
              <div ref={contentRef}>
                {showEmpty && <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>}
                <ScrollArea viewportClassName="max-h-[calc(70vh-3rem)]">
                  {exact.length > 0 && (
                    <CommandGroup heading="일치">
                      {exact.map((hit) => (
                        <ResultItem
                          key={`e:${hit.type}:${hit.id}`}
                          hit={hit}
                          onSelect={handleSelect}
                        />
                      ))}
                    </CommandGroup>
                  )}
                  {similar.length > 0 && (
                    <CommandGroup heading="유사">
                      {similar.map((hit) => (
                        <ResultItem
                          key={`s:${hit.type}:${hit.id}`}
                          hit={hit}
                          onSelect={handleSelect}
                        />
                      ))}
                    </CommandGroup>
                  )}
                </ScrollArea>
              </div>
            </div>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
