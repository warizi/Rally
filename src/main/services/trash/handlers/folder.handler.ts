import path from 'path'
import { NotFoundError } from '../../../lib/errors'
import { workspaceRepository } from '../../../repositories/workspace'
import { folderRepository } from '../../../repositories/folder'
import { noteRepository } from '../../../repositories/note'
import { csvFileRepository } from '../../../repositories/csv-file'
import { pdfFileRepository } from '../../../repositories/pdf-file'
import { imageFileRepository } from '../../../repositories/image-file'
import { getTrashRoot } from '../helpers'
import { emptyCollected, type CollectedRows } from '../cascade-collector'
import type { SoftDeleteHandler, HandlerContext } from './handler.interface'

/**
 * folder cascade — relativePath prefix 로 모든 후손(폴더 + 노트/csv/pdf/image) 수집.
 *
 * fs 이동은 폴더 통째로 한 번 (fs.renameSync) — DB 자식 row 의 relativePath 는
 * 그대로 보존(복구 시 prefix 갱신만 처리).
 *
 * 다른 entity 의 row 들도 수집하므로 핸들러 중 가장 복잡한 케이스.
 */
export const folderHandler: SoftDeleteHandler<'folder'> = {
  entityType: 'folder',

  collectCascade(rootId: string, ctx: HandlerContext): CollectedRows {
    const { workspaceId, batchId } = ctx
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const root = folderRepository.findByIdIncludingDeleted(rootId)
    if (!root) throw new NotFoundError(`Folder not found: ${rootId}`)

    const prefix = root.relativePath
    const prefixSlash = `${prefix}/`

    // 활성 + 휴지통 모두 — softRemove 자체는 활성 row 만 다루지만 idempotent 를 위해 raw 쿼리.
    // 실제로는 활성 자식만 trash 로 보내야 하니 active 만 수집.
    const allFolders = folderRepository.findByWorkspaceId(workspaceId)
    const folderIds: string[] = [rootId]
    for (const f of allFolders) {
      if (f.id !== rootId && f.relativePath.startsWith(prefixSlash)) folderIds.push(f.id)
    }

    // 각 도메인 활성 row 중 relativePath 가 root 나 root/ prefix 로 시작하는 것
    const noteRows = noteRepository.findByWorkspaceId(workspaceId)
    const noteIds = noteRows
      .filter((n) => n.relativePath === prefix || n.relativePath.startsWith(prefixSlash))
      .map((n) => n.id)
    const csvRows = csvFileRepository.findByWorkspaceId(workspaceId)
    const csvIds = csvRows
      .filter((c) => c.relativePath === prefix || c.relativePath.startsWith(prefixSlash))
      .map((c) => c.id)
    const pdfRows = pdfFileRepository.findByWorkspaceId(workspaceId)
    const pdfIds = pdfRows
      .filter((p) => p.relativePath === prefix || p.relativePath.startsWith(prefixSlash))
      .map((p) => p.id)
    const imageRows = imageFileRepository.findByWorkspaceId(workspaceId)
    const imageIds = imageRows
      .filter((i) => i.relativePath === prefix || i.relativePath.startsWith(prefixSlash))
      .map((i) => i.id)

    // 폴더 자체를 통째로 trash 디렉토리로 이동 — fs.renameSync 한 번
    const trashRoot = path.join(getTrashRoot(workspaceId), batchId)
    const src = path.join(workspace.path, prefix)
    const dst = path.join(trashRoot, prefix)

    return {
      ...emptyCollected(),
      folderIds,
      noteIds,
      csvIds,
      pdfIds,
      imageIds,
      rootTitle: prefix,
      fsMoves: [{ src, dst, relativePath: prefix }]
    }
  }
}
