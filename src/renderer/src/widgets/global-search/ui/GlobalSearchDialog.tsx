import { useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@shared/ui/dialog'
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty
} from '@shared/ui/command'
import { useGlobalSearch, type SearchHit } from '@entities/search'
import { useTabStore } from '@/entities/tab-system'
import { ENTITY_TYPE_ICON } from '@shared/lib/entity-link'
import { useCurrentWorkspaceStore } from '@/shared/store/current-workspace'
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

  const { data, isFetching } = useGlobalSearch(workspaceId, query)
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

  const trimmed = query.trim()
  const showEmpty = !!trimmed && !isFetching && exact.length === 0 && similar.length === 0

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
          className="[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium"
        >
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="전체 검색 (노트 · 표 · PDF · 이미지 · 캔버스 · 할일)"
          />
          <CommandList className="max-h-[60vh]">
            {showEmpty && <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>}
            {exact.length > 0 && (
              <CommandGroup heading="일치">
                {exact.map((hit) => (
                  <ResultItem key={`e:${hit.type}:${hit.id}`} hit={hit} onSelect={handleSelect} />
                ))}
              </CommandGroup>
            )}
            {similar.length > 0 && (
              <CommandGroup heading="유사">
                {similar.map((hit) => (
                  <ResultItem key={`s:${hit.type}:${hit.id}`} hit={hit} onSelect={handleSelect} />
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
