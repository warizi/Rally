import { JSX, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Tree } from 'react-arborist'
import type { NodeRendererProps, TreeApi } from 'react-arborist'

// 트리 DnD는 @dnd-kit으로 통일 (MainLayout의 DndContext에서 처리).
// react-arborist 내장 react-dnd 드래그/드롭은 disableDrag/disableDrop으로 비활성화한다.
import { useTabStore } from '@features/tap-system/manage-tab-system'
import { useWorkspaceTree } from '../model/use-workspace-tree'
import { useTreeOpenState } from '../model/use-tree-open-state'
import { useTreeMoveListener } from '../model/use-tree-move-listener'
import { useFolderDialogState } from '../model/use-folder-dialog-state'
import { useFolderCreateHandlers } from '../model/use-folder-create-handlers'
import { useFolderMutations } from '../model/use-folder-mutations'
import { useFolderTreeHandlers } from '../model/use-folder-tree-handlers'
import { useFolderSearch } from '../model/use-folder-search'
import { countVisibleNodes } from '../model/folder-tree-helpers'
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

const ROW_HEIGHT = 36

export function FolderTree({ workspaceId, tabId }: Props): JSX.Element {
  const { tree } = useWorkspaceTree(workspaceId)
  const treeRef = useRef<TreeApi<WorkspaceTreeNode>>(null)
  const { openState, toggle, collapseAll, expandToItem } = useTreeOpenState(tabId)

  // 트리 내 DnD 이동을 @dnd-kit 기반으로 처리
  useTreeMoveListener(workspaceId)

  const visibleCount = useMemo(() => countVisibleNodes(tree, openState), [tree, openState])
  const treeHeight = visibleCount * ROW_HEIGHT

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
  const treeHandlers = useFolderTreeHandlers({
    workspaceId,
    rename: mutations.rename,
    dialogState
  })

  // 검색 (Phase 2)
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

  return (
    <div data-testid="folder-tree-root" className="flex flex-col relative px-6 pt-6 pb-2">
      <FolderTreeToolbar
        createHandlers={createHandlers}
        onCollapseAll={() => {
          treeRef.current?.closeAll()
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

      {tree.length === 0 ? (
        <FolderTreeEmpty
          onCreateNote={() => handleCreateNote(null)}
          onCreateCsv={() => handleCreateCsv(null)}
          onCreateFolder={() => dialogState.setCreateTarget({ parentFolderId: null })}
        />
      ) : (
        <div>
          <Tree<WorkspaceTreeNode>
            key={workspaceId}
            ref={treeRef}
            data={tree}
            idAccessor="id"
            initialOpenState={openState}
            openByDefault={false}
            childrenAccessor={(n) => (n.kind === 'folder' ? n.children : null)}
            disableDrag
            disableDrop
            disableEdit={(n) =>
              n.kind === 'note' || n.kind === 'csv' || n.kind === 'pdf' || n.kind === 'image'
            }
            onToggle={(id) => toggle(id, treeRef.current?.isOpen(id) ?? false)}
            onCreate={treeHandlers.onCreate}
            onRename={treeHandlers.onRename}
            onDelete={treeHandlers.onDelete}
            height={treeHeight}
            width="100%"
            className="px-2"
          >
            {NodeRenderer}
          </Tree>
        </div>
      )}

      <FolderTreeDialogs
        workspaceId={workspaceId}
        tree={tree}
        dialogState={dialogState}
        mutations={mutations}
      />
    </div>
  )
}
