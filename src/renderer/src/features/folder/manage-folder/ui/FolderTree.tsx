import { JSX, useCallback, useEffect, useRef, useState } from 'react'
import { ScrollArea } from '@shared/ui/scroll-area'
import { useTabStore } from '@features/tap-system/manage-tab-system'
// 자체 Tree 구현 (react-arborist 대체). 트리 DnD 는 @dnd-kit 으로 통일되고,
// 가상화는 @tanstack/react-virtual 로 처리한다.
import { Tree } from '../lib/tree'
import type { NodeRendererProps, TreeApi } from '../lib/tree'
import { useWorkspaceTree } from '../model/use-workspace-tree'
import { useTreeOpenState } from '../model/use-tree-open-state'
import { useTreeMoveListener } from '../model/use-tree-move-listener'
import { useFolderDialogState } from '../model/use-folder-dialog-state'
import { useFolderCreateHandlers } from '../model/use-folder-create-handlers'
import { useFolderMutations } from '../model/use-folder-mutations'
import { useFolderSearch } from '../model/use-folder-search'
import type { WorkspaceTreeNode } from '../model/types'
import { FolderTreeNodeDispatcher } from './FolderTreeNodeDispatcher'
import { FolderTreeToolbar } from './FolderTreeToolbar'
import { FolderTreeSearchBar } from './FolderTreeSearchBar'
import { FolderTreeEmpty } from './FolderTreeEmpty'
import { FolderTreeDialogs } from './FolderTreeDialogs'

interface Props {
  workspaceId: string
  tabId?: string // sourcePaneId 계산용 (FolderPage에서 전달)
}

// react-arborist v3 의 기본 rowHeight 와 동일 (기존 시각적 row 높이 유지).
// 기존 FolderTree 의 `ROW_HEIGHT = 36` 은 react-arborist 외곽 height prop 계산용으로만
// 사용했고 실제 row 높이는 react-arborist 의 기본값(24px)이었음.
const ROW_HEIGHT = 24

const idAccessor = (n: WorkspaceTreeNode): string => n.id
const childrenAccessor = (n: WorkspaceTreeNode): WorkspaceTreeNode[] | null =>
  n.kind === 'folder' ? n.children : null

export function FolderTree({ workspaceId, tabId }: Props): JSX.Element {
  const { tree } = useWorkspaceTree(workspaceId)
  const treeRef = useRef<TreeApi<WorkspaceTreeNode>>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { openState, toggle, collapseAll, expandToItem, expandIds } = useTreeOpenState(tabId)
  const [ready, setReady] = useState(false)

  // 트리 내 DnD 이동을 @dnd-kit 기반으로 처리
  useTreeMoveListener(workspaceId)

  const mutations = useFolderMutations()
  const dialogState = useFolderDialogState()

  const findPaneByTabId = useTabStore((s) => s.findPaneByTabId)
  const activeTab = useTabStore((s) => s.getActiveTab())
  const sourcePaneId = tabId ? (findPaneByTabId(tabId)?.id ?? '') : ''
  const activePathname = activeTab?.pathname ?? ''

  // 활성 탭 아이템이 폴더 내부에 있으면 상위 폴더를 자동 펼침
  useEffect(() => {
    const match = activePathname.match(/^\/folder\/(?:note|csv|pdf|image)\/(.+)$/)
    if (!match) return
    const itemId = match[1]
    expandToItem(tree, itemId, treeRef.current)
  }, [activePathname, tree, expandToItem])

  const createHandlers = useFolderCreateHandlers({ workspaceId, sourcePaneId })
  const { handleCreateNote, handleCreateCsv } = createHandlers

  // 검색 (Phase 2 + Phase 3)
  const [searchOpen, setSearchOpen] = useState(false)
  const search = useFolderSearch(tree)

  const handleToggleSearch = useCallback(() => {
    setSearchOpen((open) => {
      if (open) search.clear()
      return !open
    })
  }, [search])

  const handleCloseSearch = useCallback(() => {
    setSearchOpen(false)
    search.clear()
  }, [search])

  // 매치 결과의 ancestor 폴더 일괄 자동 펼침
  const ancestorIds = search.result.ancestorIds
  useEffect(() => {
    if (ancestorIds.size === 0) return
    expandIds(ancestorIds, treeRef.current)
  }, [ancestorIds, expandIds])

  // 활성 매치로 스크롤
  const activeId = search.activeId
  useEffect(() => {
    if (!activeId) return
    treeRef.current?.scrollTo(activeId, 'center')
  }, [activeId])

  const NodeRenderer = useCallback(
    (props: NodeRendererProps<WorkspaceTreeNode>) => (
      <FolderTreeNodeDispatcher
        arboristProps={props}
        workspaceId={workspaceId}
        sourcePaneId={sourcePaneId}
        activePathname={activePathname}
        createHandlers={createHandlers}
        dialogState={dialogState}
        matchedIds={search.result.matchedIds}
        activeMatchId={search.activeId}
      />
    ),
    [
      workspaceId,
      sourcePaneId,
      activePathname,
      createHandlers,
      dialogState,
      search.result.matchedIds,
      search.activeId
    ]
  )
  useEffect(() => {
    if (!scrollRef.current) return

    requestAnimationFrame(() => {
      setReady(true)
    })
  }, [])

  return (
    <ScrollArea viewportRef={scrollRef} className="h-full">
      <div data-testid="folder-tree-root" className="flex flex-col relative px-6 pt-6 pb-2">
        {/* sticky 상단 그룹: 툴바 + 검색바 — viewport 스크롤 시에도 고정 */}
        <div className="sticky top-0 z-10 bg-background pb-2">
          <FolderTreeToolbar
            createHandlers={createHandlers}
            onCollapseAll={() => {
              collapseAll()
            }}
            onCreateFolder={() => dialogState.setCreateTarget({ parentFolderId: null })}
            onToggleSearch={handleToggleSearch}
          />

          <FolderTreeSearchBar
            open={searchOpen}
            query={search.query}
            matchCount={search.result.orderedMatches.length}
            activeIndex={search.activeIndex}
            onQueryChange={search.setQuery}
            onNext={search.goNext}
            onPrev={search.goPrev}
            onClose={handleCloseSearch}
          />
        </div>

        {ready && tree.length === 0 && (
          <FolderTreeEmpty
            onCreateNote={() => handleCreateNote(null)}
            onCreateCsv={() => handleCreateCsv(null)}
            onCreateFolder={() => dialogState.setCreateTarget({ parentFolderId: null })}
          />
        )}

        {ready && tree.length > 0 && (
          <Tree<WorkspaceTreeNode>
            key={workspaceId}
            ref={treeRef}
            data={tree}
            idAccessor={idAccessor}
            childrenAccessor={childrenAccessor}
            openState={openState}
            onToggle={toggle}
            scrollElementRef={scrollRef}
            rowHeight={ROW_HEIGHT}
            className="px-2"
          >
            {NodeRenderer}
          </Tree>
        )}

        <FolderTreeDialogs
          workspaceId={workspaceId}
          tree={tree}
          dialogState={dialogState}
          mutations={mutations}
        />
      </div>
    </ScrollArea>
  )
}
