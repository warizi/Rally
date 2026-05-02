import { useState, useEffect, useRef } from 'react'
import { Plus, Network, MoreHorizontal, Search } from 'lucide-react'
import { TabContainer } from '@shared/ui/tab-container'
import TabHeader from '@shared/ui/tab-header'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@shared/ui/dropdown-menu'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { OnboardingTipIcon } from '@shared/ui/onboarding-tip'
import { ROUTES } from '@shared/constants/tab-url'
import { useTabStore, selectPaneByTabId } from '@features/tap-system/manage-tab-system'
import { PanePickerSubmenu } from '@features/entity-link/manage-link'
import { CreateCanvasDialog } from '@features/canvas/create-canvas/ui/CreateCanvasDialog'
import { DeleteCanvasDialog } from '@features/canvas/delete-canvas/ui/DeleteCanvasDialog'
import { useCanvasesByWorkspace, useCreateCanvas, type CanvasItem } from '@entities/canvas'

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

interface Props {
  tabId?: string
}

export function CanvasListPage({ tabId }: Props): React.JSX.Element {
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId)
  const tabSearchParams = useTabStore((s) => (tabId ? s.tabs[tabId]?.searchParams : undefined))
  const navigateTab = useTabStore((s) => s.navigateTab)

  const [search, setSearch] = useState(tabSearchParams?.search ?? '')
  const debouncedSearch = useDebouncedValue(search, 300)

  useEffect(() => {
    if (!tabId) return
    const current = useTabStore.getState().tabs[tabId]?.searchParams
    navigateTab(tabId, { searchParams: { ...current, search: debouncedSearch } })
  }, [tabId, debouncedSearch, navigateTab])

  const { data: canvases = [], isLoading } = useCanvasesByWorkspace(
    workspaceId,
    debouncedSearch || undefined
  )
  const { mutate: createCanvas, isPending } = useCreateCanvas()

  const openTab = useTabStore((s) => s.openTab)
  const closeTabByPathname = useTabStore((s) => s.closeTabByPathname)
  const pane = useTabStore(selectPaneByTabId(tabId ?? ''))

  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CanvasItem | null>(null)

  const handleCreate = (data: { title: string; description?: string }): void => {
    if (!workspaceId) return
    createCanvas(
      { workspaceId, data },
      {
        onSuccess: (canvas) => {
          setDialogOpen(false)
          openTab(
            {
              type: 'canvas-detail',
              pathname: ROUTES.CANVAS_DETAIL.replace(':canvasId', canvas.id),
              title: canvas.title
            },
            pane?.id
          )
        }
      }
    )
  }

  const handleOpen = (canvas: CanvasItem): void => {
    openTab(
      {
        type: 'canvas-detail',
        pathname: ROUTES.CANVAS_DETAIL.replace(':canvasId', canvas.id),
        title: canvas.title
      },
      pane?.id
    )
  }

  const handleOpenInPane = (canvas: CanvasItem, paneId: string): void => {
    const pathname = ROUTES.CANVAS_DETAIL.replace(':canvasId', canvas.id)
    closeTabByPathname(pathname)
    openTab(
      {
        type: 'canvas-detail',
        pathname,
        title: canvas.title
      },
      paneId
    )
  }

  const handleRemove = (canvas: CanvasItem): void => {
    setDeleteTarget(canvas)
  }

  return (
    <TabContainer
      header={
        <TabHeader
          title="캔버스"
          description="아이디어를 시각적으로 연결하고 정리하세요"
          icon={Network}
          isLoading={isLoading}
          buttons={
            <div className="flex items-center gap-1">
              <OnboardingTipIcon
                tipId="canvas_drag"
                title="노드 끌어다 놓기"
                description="캔버스 내에서 텍스트 노드를 끌어다 놓고, 노드 가장자리끼리 연결하세요."
              />
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="size-4 mr-1" />새 캔버스
              </Button>
            </div>
          }
        />
      }
    >
      <div className="py-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="캔버스 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8"
          />
        </div>
        {canvases.length === 0 && !isLoading && (
          <div className="text-center py-12 text-muted-foreground">
            <Network className="size-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">캔버스가 없습니다</p>
            <p className="text-xs mt-1">새 캔버스를 만들어 아이디어를 연결해보세요</p>
          </div>
        )}

        <div className="grid grid-cols-1 @[400px]:grid-cols-2 @[800px]:grid-cols-3 gap-3">
          {canvases.map((canvas) => (
            <div
              key={canvas.id}
              role="button"
              tabIndex={0}
              onClick={() => handleOpen(canvas)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleOpen(canvas)
              }}
              className="group text-left p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Network className="size-4 shrink-0 text-muted-foreground" />
                  <span className="font-medium text-sm truncate">{canvas.title}</span>
                </div>
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-accent rounded transition-opacity"
                    >
                      <MoreHorizontal className="size-3.5 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <PanePickerSubmenu onPaneSelect={(paneId) => handleOpenInPane(canvas, paneId)}>
                      {({ onClick }) => (
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={onClick}>
                          상세 보기
                        </DropdownMenuItem>
                      )}
                    </PanePickerSubmenu>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={(e) => e.preventDefault()}
                      onClick={() => handleRemove(canvas)}
                    >
                      삭제
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {canvas.description && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                  {canvas.description}
                </p>
              )}
              <p className="text-xs text-muted-foreground/60 mt-2">
                {new Date(canvas.updatedAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      </div>

      <CreateCanvasDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        isPending={isPending}
        onSubmit={handleCreate}
      />

      {workspaceId && (
        <DeleteCanvasDialog
          canvasId={deleteTarget?.id ?? ''}
          canvasTitle={deleteTarget?.title ?? ''}
          workspaceId={workspaceId}
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null)
          }}
          onDeleted={() => {
            if (deleteTarget) {
              closeTabByPathname(ROUTES.CANVAS_DETAIL.replace(':canvasId', deleteTarget.id))
            }
            setDeleteTarget(null)
          }}
        />
      )}
    </TabContainer>
  )
}
