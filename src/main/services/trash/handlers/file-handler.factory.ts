import path from 'path'
import { NotFoundError } from '../../../lib/errors'
import { workspaceRepository } from '../../../repositories/workspace'
import { getTrashRoot } from '../helpers'
import { emptyCollected, type CollectedRows } from '../cascade-collector'
import type { SoftDeleteHandler, HandlerContext } from './handler.interface'
import type { TrashEntityKind } from '../types'

/**
 * 단일 파일 도메인(note/csv/pdf/image) 공통 패턴:
 *   1. workspace 조회
 *   2. row 조회 (rootTitle, relativePath 획득)
 *   3. workspace/path/relativePath → trash/batchId/relativePath 이동 매핑
 *   4. CollectedRows 에 자신의 id 배열 + fsMove 기록
 *
 * 4개 entity 가 동일 로직 → factory 로 추출.
 */
type FileEntityKind = Extract<TrashEntityKind, 'note' | 'csv' | 'pdf' | 'image'>

interface FileRepo {
  findByIdIncludingDeleted(
    id: string
  ): { id: string; title: string; relativePath: string } | null | undefined
}

export function createFileHandler<T extends FileEntityKind>(
  entityType: T,
  repo: FileRepo
): SoftDeleteHandler<T> {
  return {
    entityType,
    collectCascade(rootId: string, ctx: HandlerContext): CollectedRows {
      const workspace = workspaceRepository.findById(ctx.workspaceId)
      if (!workspace) throw new NotFoundError(`Workspace not found: ${ctx.workspaceId}`)
      const row = repo.findByIdIncludingDeleted(rootId)
      if (!row) throw new NotFoundError(`${entityType} not found: ${rootId}`)

      const trashRoot = path.join(getTrashRoot(ctx.workspaceId), ctx.batchId)
      const src = path.join(workspace.path, row.relativePath)
      const dst = path.join(trashRoot, row.relativePath)

      const collected: CollectedRows = {
        ...emptyCollected(),
        rootTitle: row.title,
        fsMoves: [{ src, dst, relativePath: row.relativePath }]
      }
      // entityType 별 id 배열 키에 [rootId] 할당
      if (entityType === 'note') collected.noteIds = [rootId]
      else if (entityType === 'csv') collected.csvIds = [rootId]
      else if (entityType === 'pdf') collected.pdfIds = [rootId]
      else if (entityType === 'image') collected.imageIds = [rootId]
      return collected
    }
  }
}
