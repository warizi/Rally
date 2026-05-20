import { useEffect, useRef, type JSX } from 'react'
import type { NodeRendererProps } from '../lib/tree'
import { useDuplicateNote } from '@entities/note'
import { useDuplicateCsvFile } from '@entities/csv-file'
import { useDuplicatePdfFile } from '@entities/pdf-file'
import { useDuplicateImageFile } from '@entities/image-file'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import { cn } from '@shared/lib/utils'
import { FolderContextMenu } from './FolderContextMenu'
import { FileContextMenu } from './FileContextMenu'
import { FolderNodeRenderer } from './FolderNodeRenderer'
import { NoteNodeRenderer } from './NoteNodeRenderer'
import { CsvNodeRenderer } from './CsvNodeRenderer'
import { PdfNodeRenderer } from './PdfNodeRenderer'
import { ImageNodeRenderer } from './ImageNodeRenderer'
import type {
  WorkspaceTreeNode,
  FolderTreeNode,
  NoteTreeNode,
  CsvTreeNode,
  PdfTreeNode,
  ImageTreeNode
} from '../model/types'
import type { FolderCreateHandlers } from '../model/use-folder-create-handlers'
import type { FolderDialogState } from '../model/use-folder-dialog-state'

/**
 * react-arborist `<Tree>` 의 NodeRenderer dispatcher.
 *
 * node.data.kind 별로 적절한 ContextMenu + NodeRenderer 조합을 렌더.
 *   - folder: FolderContextMenu + FolderNodeRenderer
 *   - note / csv / pdf / image: FileContextMenu + 각 NodeRenderer
 *
 * P1-3 Phase 3: FolderTree.tsx 에 인라인되어 있던 NodeRenderer (~225L useCallback) 를
 * 별도 컴포넌트로 추출. useCallback 의존성 폭증 해소 + dispatcher 본문은 props 만
 * 받는 순수 함수 → 향후 React.memo 적용 가능 (Phase 4).
 */

interface Props {
  arboristProps: NodeRendererProps<WorkspaceTreeNode>
  workspaceId: string
  sourcePaneId: string
  activePathname: string
  createHandlers: FolderCreateHandlers
  dialogState: FolderDialogState
  /** 검색 매치된 노드 id 집합 (Phase 2). */
  matchedIds?: Set<string>
  /** 현재 ↑↓ 활성 매치 노드 id (Phase 2). */
  activeMatchId?: string | null
}

export function FolderTreeNodeDispatcher(props: Props): JSX.Element {
  const {
    arboristProps,
    workspaceId,
    sourcePaneId,
    activePathname,
    createHandlers,
    dialogState,
    matchedIds,
    activeMatchId
  } = props

  const node = arboristProps.node
  const isMatch = matchedIds?.has(node.data.id) ?? false
  const isActiveMatch = activeMatchId === node.data.id

  const openRightTab = useTabStore((s) => s.openRightTab)
  const { mutate: duplicateNote } = useDuplicateNote()
  const { mutate: duplicateCsvFile } = useDuplicateCsvFile()
  const { mutate: duplicatePdfFile } = useDuplicatePdfFile()
  const { mutate: duplicateImageFile } = useDuplicateImageFile()

  const kind = node.data.kind

  // 검색 하이라이트 (Phase 2). active 매치는 더 진한 색 + inner ring
  // (좌우가 컨테이너에 잘리지 않도록 ring-inset 사용).
  const highlightClass = cn(
    isMatch && 'bg-yellow-200/40',
    isActiveMatch && 'bg-yellow-300/60 ring-2 ring-inset ring-yellow-500'
  )

  // 활성 매치 wrap div 에 ref + scrollIntoView (외부 탭 스크롤 컨테이너 대응).
  const activeMatchRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (isActiveMatch) {
      activeMatchRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [isActiveMatch])

  if (kind === 'note') {
    return (
      <FileContextMenu
        name={node.data.name}
        kind="note"
        onDuplicate={() =>
          duplicateNote(
            { workspaceId, noteId: node.data.id },
            {
              onSuccess: (note) => {
                if (!note) return
                openRightTab(
                  {
                    type: 'note',
                    title: note.title,
                    pathname: `/folder/note/${note.id}`
                  },
                  sourcePaneId
                )
              }
            }
          )
        }
        onDelete={() => dialogState.setNoteDeleteTarget({ id: node.data.id, name: node.data.name })}
      >
        <div
          ref={activeMatchRef}
          className={cn(
            'rounded data-[state=open]:bg-accent data-[state=open]:ring-1 data-[state=open]:ring-inset data-[state=open]:ring-ring',
            highlightClass
          )}
        >
          <NoteNodeRenderer
            {...(arboristProps as unknown as NodeRendererProps<NoteTreeNode>)}
            workspaceId={workspaceId}
            sourcePaneId={sourcePaneId}
            isActive={activePathname === `/folder/note/${node.data.id}`}
            onOpen={() =>
              openRightTab(
                {
                  type: 'note',
                  title: node.data.name,
                  pathname: `/folder/note/${node.data.id}`
                },
                sourcePaneId
              )
            }
          />
        </div>
      </FileContextMenu>
    )
  }

  if (kind === 'csv') {
    return (
      <FileContextMenu
        name={node.data.name}
        kind="csv"
        onDuplicate={() =>
          duplicateCsvFile(
            { workspaceId, csvId: node.data.id },
            {
              onSuccess: (csv) => {
                if (!csv) return
                openRightTab(
                  {
                    type: 'csv',
                    title: csv.title,
                    pathname: `/folder/csv/${csv.id}`
                  },
                  sourcePaneId
                )
              }
            }
          )
        }
        onDelete={() => dialogState.setCsvDeleteTarget({ id: node.data.id, name: node.data.name })}
      >
        <div
          ref={activeMatchRef}
          className={cn(
            'rounded data-[state=open]:bg-accent data-[state=open]:ring-1 data-[state=open]:ring-inset data-[state=open]:ring-ring',
            highlightClass
          )}
        >
          <CsvNodeRenderer
            {...(arboristProps as unknown as NodeRendererProps<CsvTreeNode>)}
            workspaceId={workspaceId}
            sourcePaneId={sourcePaneId}
            isActive={activePathname === `/folder/csv/${node.data.id}`}
            onOpen={() =>
              openRightTab(
                {
                  type: 'csv',
                  title: node.data.name,
                  pathname: `/folder/csv/${node.data.id}`
                },
                sourcePaneId
              )
            }
          />
        </div>
      </FileContextMenu>
    )
  }

  if (kind === 'pdf') {
    return (
      <FileContextMenu
        name={node.data.name}
        kind="pdf"
        onDuplicate={() =>
          duplicatePdfFile(
            { workspaceId, pdfId: node.data.id },
            {
              onSuccess: (pdf) => {
                if (!pdf) return
                openRightTab(
                  {
                    type: 'pdf',
                    title: pdf.title,
                    pathname: `/folder/pdf/${pdf.id}`
                  },
                  sourcePaneId
                )
              }
            }
          )
        }
        onDelete={() => dialogState.setPdfDeleteTarget({ id: node.data.id, name: node.data.name })}
      >
        <div
          ref={activeMatchRef}
          className={cn(
            'rounded data-[state=open]:bg-accent data-[state=open]:ring-1 data-[state=open]:ring-inset data-[state=open]:ring-ring',
            highlightClass
          )}
        >
          <PdfNodeRenderer
            {...(arboristProps as unknown as NodeRendererProps<PdfTreeNode>)}
            workspaceId={workspaceId}
            sourcePaneId={sourcePaneId}
            isActive={activePathname === `/folder/pdf/${node.data.id}`}
            onOpen={() =>
              openRightTab(
                {
                  type: 'pdf',
                  title: node.data.name,
                  pathname: `/folder/pdf/${node.data.id}`
                },
                sourcePaneId
              )
            }
          />
        </div>
      </FileContextMenu>
    )
  }

  if (kind === 'image') {
    return (
      <FileContextMenu
        name={node.data.name}
        kind="image"
        onDuplicate={() =>
          duplicateImageFile(
            { workspaceId, imageId: node.data.id },
            {
              onSuccess: (image) => {
                if (!image) return
                openRightTab(
                  {
                    type: 'image',
                    title: image.title,
                    pathname: `/folder/image/${image.id}`
                  },
                  sourcePaneId
                )
              }
            }
          )
        }
        onDelete={() =>
          dialogState.setImageDeleteTarget({ id: node.data.id, name: node.data.name })
        }
      >
        <div
          ref={activeMatchRef}
          className={cn(
            'rounded data-[state=open]:bg-accent data-[state=open]:ring-1 data-[state=open]:ring-inset data-[state=open]:ring-ring',
            highlightClass
          )}
        >
          <ImageNodeRenderer
            {...(arboristProps as unknown as NodeRendererProps<ImageTreeNode>)}
            workspaceId={workspaceId}
            sourcePaneId={sourcePaneId}
            isActive={activePathname === `/folder/image/${node.data.id}`}
            onOpen={() =>
              openRightTab(
                {
                  type: 'image',
                  title: node.data.name,
                  pathname: `/folder/image/${node.data.id}`
                },
                sourcePaneId
              )
            }
          />
        </div>
      </FileContextMenu>
    )
  }

  // kind === 'folder'
  const folderColor = (node.data as FolderTreeNode).color
  return (
    <FolderContextMenu
      name={node.data.name}
      color={folderColor}
      onCreateChild={() => dialogState.setCreateTarget({ parentFolderId: node.id })}
      onCreateNote={() => createHandlers.handleCreateNote(node.id)}
      onImportNote={() => createHandlers.handleImportNote(node.id)}
      onCreateCsv={() => createHandlers.handleCreateCsv(node.id)}
      onImportCsv={() => createHandlers.handleImportCsv(node.id)}
      onImportPdf={() => createHandlers.handleImportPdf(node.id)}
      onImportImage={() => createHandlers.handleImportImage(node.id)}
      onRename={() => dialogState.setRenameTarget({ id: node.id, name: node.data.name })}
      onEditColor={() => dialogState.setColorTarget({ id: node.id, color: folderColor })}
      onDelete={() => dialogState.setDeleteTarget({ id: node.id, name: node.data.name })}
    >
      <div
        ref={activeMatchRef}
        className={cn(
          'rounded data-[state=open]:bg-accent data-[state=open]:ring-1 data-[state=open]:ring-inset data-[state=open]:ring-ring',
          highlightClass
        )}
      >
        <FolderNodeRenderer
          {...(arboristProps as unknown as NodeRendererProps<FolderTreeNode>)}
          workspaceId={workspaceId}
          sourcePaneId={sourcePaneId}
        />
      </div>
    </FolderContextMenu>
  )
}
