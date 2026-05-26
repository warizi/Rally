import fs from 'fs'
import path from 'path'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../../db'
import {
  trashBatches,
  todos,
  schedules,
  recurringRules,
  canvases,
  canvasNodes,
  canvasEdges,
  canvasGroups,
  entityLinks,
  notes,
  csvFiles,
  pdfFiles,
  imageFiles,
  folders,
  templates,
  customSkills
} from '../../db/schema'
import { NotFoundError } from '../../lib/errors'
import { workspaceRepository } from '../../repositories/workspace'
import { folderRepository } from '../../repositories/folder'
import { noteRepository } from '../../repositories/note'
import { csvFileRepository } from '../../repositories/csv-file'
import { pdfFileRepository } from '../../repositories/pdf-file'
import { imageFileRepository } from '../../repositories/image-file'
import { withTransaction } from '../../lib/transaction'
import { resolveNameConflict } from '../../lib/fs-utils'

import { type TrashEntityKind } from './types'
import { type TrashMetadata, broadcastTrashChanged, moveFromTrash } from './helpers'
import { USER_ACTOR } from '../_shared/actor'

/**
 * 휴지통 복원기 — `trashService.restore` 의 본문 책임.
 *
 * 1. trash_batch row 조회 (없으면 throw)
 * 2. FS 복구 (folder 는 통째 한 번, 파일 도메인은 단건씩 + 부모 폴더 활성 검증)
 * 3. 각 entity 테이블의 deletedAt = NULL, trashBatchId = NULL 일괄 업데이트
 * 4. folder rename 충돌 시 자식 row 의 relativePath prefix 갱신
 * 5. entity-link snapshot 재생성 (onConflictDoNothing — orphan 회피)
 * 6. trash_batch row 삭제
 * 7. restored 배열 구성 (root + todo cascade 자식)
 * 8. broadcast (트랜잭션 외부)
 */
export const trashRestorer = {
  restore(batchId: string): {
    restored: { type: TrashEntityKind; id: string; title: string }[]
    conflicts?: { id: string; reason: string }[]
  } {
    let restoredWorkspaceId: string | null = null
    const result = withTransaction(() => {
      const batch = db.select().from(trashBatches).where(eq(trashBatches.id, batchId)).get()
      if (!batch) throw new NotFoundError(`Trash batch not found: ${batchId}`)
      restoredWorkspaceId = batch.workspaceId

      const setActive = { deletedAt: null, trashBatchId: null }

      const workspace = workspaceRepository.findById(batch.workspaceId)
      if (!workspace) {
        throw new NotFoundError(`Workspace not found: ${batch.workspaceId}`)
      }

      // 1. FS 복구 — folder 는 통째 한 번, 파일 도메인은 단건씩
      const isFolderBatch = batch.rootEntityType === 'folder'
      let folderRenameOldPrefix: string | null = null
      let folderRenameNewPrefix: string | null = null

      if (isFolderBatch && batch.fsTrashPath) {
        // root 폴더 row 조회 (휴지통 상태)
        const rootFolder = db
          .select({ id: folders.id, relativePath: folders.relativePath })
          .from(folders)
          .where(eq(folders.id, batch.rootEntityId))
          .get()
        if (rootFolder) {
          const parentRel = rootFolder.relativePath.includes('/')
            ? rootFolder.relativePath.split('/').slice(0, -1).join('/')
            : ''
          const parentAbs = parentRel ? path.join(workspace.path, parentRel) : workspace.path
          fs.mkdirSync(parentAbs, { recursive: true })
          const desiredName = rootFolder.relativePath.split('/').pop()!
          const finalName = resolveNameConflict(parentAbs, desiredName, { treatAsFolder: true })
          const finalRel = parentRel ? `${parentRel}/${finalName}` : finalName
          const dst = path.join(workspace.path, finalRel)
          const src = path.join(batch.fsTrashPath, rootFolder.relativePath)
          if (fs.existsSync(src)) {
            try {
              fs.renameSync(src, dst)
            } catch (e) {
              if ((e as NodeJS.ErrnoException).code === 'EXDEV') {
                // cross-device fallback: cpSync + rmSync (드물지만 안전)
                fs.cpSync(src, dst, { recursive: true })
                fs.rmSync(src, { recursive: true, force: true })
              } else {
                throw e
              }
            }
          }
          if (finalRel !== rootFolder.relativePath) {
            folderRenameOldPrefix = rootFolder.relativePath
            folderRenameNewPrefix = finalRel
          }
        }
      } else if (batch.fsTrashPath) {
        // 파일 도메인 — 단건 fs 이동 + relativePath 충돌 시 자동 rename.
        //
        // 부모 폴더가 trash/deleted 상태인 경우 (예: 노트만 따로 delete → 그 후 부모 폴더 delete →
        // 노트 단독 restore) folderId 가 dangling 이 되므로 root 로 복구해 정합성 유지.
        const isFolderActive = (folderId: string | null): boolean => {
          if (!folderId) return true // 이미 root
          const f = folderRepository.findByIdIncludingDeleted(folderId)
          return !!f && f.deletedAt === null
        }

        const fsRestore = (
          rows: { id: string; folderId: string | null; relativePath: string }[],
          updateRow: (id: string, patch: { relativePath: string; folderId?: string | null }) => void
        ): void => {
          for (const row of rows) {
            // 부모 trash/deleted 시 root 로 강등 — relativePath 는 파일명만 남김
            const parentSafe = isFolderActive(row.folderId)
            const relativePathForMove = parentSafe
              ? row.relativePath
              : (row.relativePath.split('/').pop() ?? row.relativePath)

            const src = path.join(batch.fsTrashPath!, row.relativePath)
            const finalRel = moveFromTrash(src, workspace.path, relativePathForMove)

            const relPathChanged = finalRel !== row.relativePath
            if (relPathChanged || !parentSafe) {
              const patch: { relativePath: string; folderId?: string | null } = {
                relativePath: finalRel
              }
              if (!parentSafe) patch.folderId = null
              updateRow(row.id, patch)
            }
          }
        }

        const noteRows = db
          .select({ id: notes.id, folderId: notes.folderId, relativePath: notes.relativePath })
          .from(notes)
          .where(eq(notes.trashBatchId, batchId))
          .all()
        fsRestore(noteRows, (id, patch) => {
          db.update(notes).set(patch).where(eq(notes.id, id)).run()
        })

        const csvRows = db
          .select({
            id: csvFiles.id,
            folderId: csvFiles.folderId,
            relativePath: csvFiles.relativePath
          })
          .from(csvFiles)
          .where(eq(csvFiles.trashBatchId, batchId))
          .all()
        fsRestore(csvRows, (id, patch) => {
          db.update(csvFiles).set(patch).where(eq(csvFiles.id, id)).run()
        })

        const pdfRows = db
          .select({
            id: pdfFiles.id,
            folderId: pdfFiles.folderId,
            relativePath: pdfFiles.relativePath
          })
          .from(pdfFiles)
          .where(eq(pdfFiles.trashBatchId, batchId))
          .all()
        fsRestore(pdfRows, (id, patch) => {
          db.update(pdfFiles).set(patch).where(eq(pdfFiles.id, id)).run()
        })

        const imageRows = db
          .select({
            id: imageFiles.id,
            folderId: imageFiles.folderId,
            relativePath: imageFiles.relativePath
          })
          .from(imageFiles)
          .where(eq(imageFiles.trashBatchId, batchId))
          .all()
        fsRestore(imageRows, (id, patch) => {
          db.update(imageFiles).set(patch).where(eq(imageFiles.id, id)).run()
        })
      }

      // 2. 같은 batch 의 모든 row deletedAt = NULL
      db.update(todos).set(setActive).where(eq(todos.trashBatchId, batchId)).run()
      db.update(schedules).set(setActive).where(eq(schedules.trashBatchId, batchId)).run()
      db.update(recurringRules).set(setActive).where(eq(recurringRules.trashBatchId, batchId)).run()
      db.update(canvases).set(setActive).where(eq(canvases.trashBatchId, batchId)).run()
      db.update(canvasNodes).set(setActive).where(eq(canvasNodes.trashBatchId, batchId)).run()
      db.update(canvasEdges).set(setActive).where(eq(canvasEdges.trashBatchId, batchId)).run()
      db.update(canvasGroups).set(setActive).where(eq(canvasGroups.trashBatchId, batchId)).run()
      db.update(notes).set(setActive).where(eq(notes.trashBatchId, batchId)).run()
      db.update(csvFiles).set(setActive).where(eq(csvFiles.trashBatchId, batchId)).run()
      db.update(pdfFiles).set(setActive).where(eq(pdfFiles.trashBatchId, batchId)).run()
      db.update(imageFiles).set(setActive).where(eq(imageFiles.trashBatchId, batchId)).run()
      db.update(folders).set(setActive).where(eq(folders.trashBatchId, batchId)).run()
      db.update(templates).set(setActive).where(eq(templates.trashBatchId, batchId)).run()
      db.update(customSkills).set(setActive).where(eq(customSkills.trashBatchId, batchId)).run()

      // 3. folder rename 충돌 발생 시 모든 자식 row 의 relativePath prefix 갱신
      //    — 위에서 deletedAt 해제 후 호출 (bulkUpdatePathPrefix 는 활성 row 만 대상)
      if (folderRenameOldPrefix !== null && folderRenameNewPrefix !== null) {
        const oldPrefix = folderRenameOldPrefix
        const newPrefix = folderRenameNewPrefix
        folderRepository.bulkUpdatePathPrefix(batch.workspaceId, oldPrefix, newPrefix, USER_ACTOR)
        noteRepository.bulkUpdatePathPrefix(batch.workspaceId, oldPrefix, newPrefix, USER_ACTOR)
        csvFileRepository.bulkUpdatePathPrefix(batch.workspaceId, oldPrefix, newPrefix, USER_ACTOR)
        pdfFileRepository.bulkUpdatePathPrefix(batch.workspaceId, oldPrefix, newPrefix, USER_ACTOR)
        imageFileRepository.bulkUpdatePathPrefix(
          batch.workspaceId,
          oldPrefix,
          newPrefix,
          USER_ACTOR
        )
      }

      // 4. entity-link / reminder snapshot 복원 (양쪽 entity 가 모두 활성일 때만 — orphan 회피)
      const conflicts: { id: string; reason: string }[] = []
      if (batch.metadata) {
        const meta = JSON.parse(batch.metadata) as TrashMetadata
        if (meta.links) {
          for (const link of meta.links) {
            // 양쪽 활성 여부 검증은 service 레이어가 못 해서 raw insert 에 onConflictDoNothing
            try {
              db.insert(entityLinks)
                .values({
                  sourceType: link.sourceType,
                  sourceId: link.sourceId,
                  targetType: link.targetType,
                  targetId: link.targetId,
                  workspaceId: link.workspaceId,
                  createdAt: new Date(link.createdAt)
                })
                .onConflictDoNothing()
                .run()
            } catch (e) {
              conflicts.push({ id: `${link.sourceType}:${link.sourceId}`, reason: String(e) })
            }
          }
        }
        // reminders 는 복원 안 함 — 시간 지난 알림은 의미 없음 (사용자가 다시 설정)
      }

      // 5. trash_batches row 삭제
      // restored 배열에는 root + cascade 자식 todos 를 함께 포함.
      // todo 의 경우 부모-자식 관계가 사용자에게 가시적이므로 응답에 명시.
      const restored: { type: TrashEntityKind; id: string; title: string }[] = [
        {
          type: batch.rootEntityType as TrashEntityKind,
          id: batch.rootEntityId,
          title: batch.rootTitle
        }
      ]
      if (batch.rootEntityType === 'todo') {
        // setActive 후 trashBatchId=null 이라 trashBatchId 기준으로 못 잡음 → root id 로부터 활성 후손 재수집.
        const queue = [batch.rootEntityId]
        const collectedIds = new Set<string>()
        while (queue.length > 0) {
          const cur = queue.shift()!
          const children = db
            .select({ id: todos.id, title: todos.title })
            .from(todos)
            .where(and(eq(todos.parentId, cur), isNull(todos.deletedAt)))
            .all()
          for (const c of children) {
            if (!collectedIds.has(c.id)) {
              collectedIds.add(c.id)
              queue.push(c.id)
              restored.push({ type: 'todo', id: c.id, title: c.title })
            }
          }
        }
      }
      db.delete(trashBatches).where(eq(trashBatches.id, batchId)).run()

      return { restored, conflicts: conflicts.length > 0 ? conflicts : undefined }
    })

    if (restoredWorkspaceId) broadcastTrashChanged(restoredWorkspaceId)
    return result
  }
}
