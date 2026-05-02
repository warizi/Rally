import { JSX, useEffect, useRef, useState } from 'react'
import { Trash2, RotateCcw, Trash, Search, X } from 'lucide-react'
import { TabContainer } from '@shared/ui/tab-container'
import TabHeader from '@shared/ui/tab-header'
import { Input } from '@shared/ui/input'
import { Button } from '@shared/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@shared/ui/alert-dialog'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { useOnboardingStore } from '@shared/store/onboarding'
import { OnboardingTipIcon } from '@shared/ui/onboarding-tip'
import { TAB_ICON, type TabType as TabIconKey } from '@/shared/constants/tab-url'
import { useTrashList, trashKindLabel, type TrashEntityKind } from '@entities/trash'
import { useRestoreTrash, usePurgeTrash, useEmptyTrash } from '@features/trash'

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

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return '방금 전'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}일 전`
  const month = Math.floor(day / 30)
  if (month < 12) return `${month}달 전`
  return `${Math.floor(month / 12)}년 전`
}

const KIND_TO_ICON: Record<TrashEntityKind, TabIconKey> = {
  folder: 'folder',
  note: 'note',
  csv: 'csv',
  pdf: 'pdf',
  image: 'image',
  canvas: 'canvas',
  todo: 'todo',
  schedule: 'calendar',
  recurring_rule: 'todo',
  template: 'note'
}

export function TrashPage(): JSX.Element {
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId) ?? ''
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)

  useEffect(() => {
    useOnboardingStore.getState().markChecklistStep('view_trash').catch(console.error)
  }, [])

  const trashed = useTrashList(workspaceId, {
    search: debouncedSearch.trim() || undefined,
    limit: 200
  })
  const restoreM = useRestoreTrash()
  const purgeM = usePurgeTrash()
  const emptyM = useEmptyTrash()

  if (!workspaceId) {
    return (
      <TabContainer header={<TabHeader title="휴지통" icon={Trash2} />}>
        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
          워크스페이스를 선택해주세요
        </div>
      </TabContainer>
    )
  }

  const batches = trashed.data?.batches ?? []
  const isEmpty = batches.length === 0

  return (
    <TabContainer
      maxWidth={1200}
      scrollable
      header={
        <div className="flex flex-col gap-3 pb-3">
          <TabHeader
            title="휴지통"
            description="삭제한 항목을 복구하거나 영구 삭제합니다. 자동 비우기 주기는 설정에서 변경 가능합니다."
            icon={Trash2}
            buttons={
              <OnboardingTipIcon
                tipId="trash_retention"
                title="자동 비우기 주기"
                description="휴지통 항목은 기본 30일 후 자동으로 비워져요. 설정 > 휴지통에서 1일/1주/30일/90일/1년 또는 '안 함'으로 변경할 수 있어요."
              />
            }
          />
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-56">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="제목 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
              {search && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => setSearch('')}
                >
                  <X className="size-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{batches.length}개 항목</span>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={isEmpty || emptyM.isPending}
                  >
                    <Trash className="size-3.5 mr-1" />
                    전체 비우기
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>휴지통 전체 비우기</AlertDialogTitle>
                    <AlertDialogDescription>
                      모든 항목이 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => emptyM.mutate({ workspaceId })}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      모두 삭제
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      }
    >
      {trashed.isLoading ? (
        <div className="text-sm text-muted-foreground py-12 text-center">불러오는 중…</div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Trash2 className="size-10 mb-3 opacity-40" />
          <div className="text-sm">휴지통이 비어있습니다</div>
        </div>
      ) : (
        <ul className="divide-y border rounded-md bg-card">
          {batches.map((b) => {
            const Icon = TAB_ICON[KIND_TO_ICON[b.rootEntityType]]
            return (
              <li
                key={b.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">
                    <span className="text-muted-foreground mr-2">
                      [{trashKindLabel(b.rootEntityType)}]
                    </span>
                    {b.rootTitle || '(제목 없음)'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex gap-2">
                    <span>삭제됨: {relativeTime(b.deletedAt)}</span>
                    {b.childCount > 0 && (
                      <>
                        <span>·</span>
                        <span>하위 항목 {b.childCount}개</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => restoreM.mutate({ workspaceId, batchId: b.id })}
                    disabled={restoreM.isPending}
                  >
                    <RotateCcw className="size-3.5 mr-1" />
                    복구
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:text-destructive"
                        disabled={purgeM.isPending}
                      >
                        <Trash className="size-3.5 mr-1" />
                        영구 삭제
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>영구 삭제</AlertDialogTitle>
                        <AlertDialogDescription>
                          &ldquo;{b.rootTitle}&rdquo; 항목이 영구 삭제됩니다. 이 작업은 되돌릴 수
                          없습니다.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>취소</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => purgeM.mutate({ workspaceId, batchId: b.id })}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          영구 삭제
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </TabContainer>
  )
}
