import path from 'path'
import { and, eq, inArray } from 'drizzle-orm'
import { nanoid } from 'nanoid'
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
  reminders,
  notes,
  csvFiles,
  pdfFiles,
  imageFiles,
  folders,
  templates
} from '../../db/schema'
import { NotFoundError, ValidationError } from '../../lib/errors'
import { workspaceRepository } from '../../repositories/workspace'
import { entityLinkRepository } from '../../repositories/entity-link'
import { withTransaction } from '../../lib/transaction'

import { type TrashEntityKind, type SoftRemoveOptions, SUPPORTED_KINDS } from './types'
import {
  type LinkSnapshot,
  type ReminderSnapshot,
  type TrashMetadata,
  getTrashRoot,
  broadcastTrashChanged,
  captureLinks,
  captureReminders,
  moveToTrash
} from './helpers'
import { collectCascade, totalChildCount } from './cascade-collector'

/**
 * 휴지통 수집기 — `trashService.softRemove` 의 본문 책임.
 *
 * 1. cascade 수집 (handler registry 우회)
 * 2. trash_batch row 생성
 * 3. entity-link / reminder snapshot 캡처 후 hard delete
 * 4. 각 entity 테이블의 deletedAt + trashBatchId 일괄 업데이트
 * 5. FS 이동 (워크스페이스 → trash 디렉토리)
 * 6. broadcast (트랜잭션 외부)
 *
 * 모든 DB 쓰기는 단일 withTransaction 내. FS 이동은 트랜잭션 내 실행(롤백
 * 시 fs 원복은 별도 cleanup 책임).
 */
export const trashCollector = {
  /**
   * entity 를 휴지통으로 이동. cascade 자식은 같은 batch_id 로 묶임.
   * @returns 생성된 trash_batch_id
   */
  collect(
    workspaceId: string,
    entityType: TrashEntityKind,
    entityId: string,
    options: SoftRemoveOptions = {}
  ): string {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)
    if (!SUPPORTED_KINDS.has(entityType)) {
      throw new ValidationError(
        `Soft delete for ${entityType} is not yet implemented (folder cascade pending).`
      )
    }

    const batchId = nanoid()
    const collected = collectCascade(workspaceId, entityType, entityId, batchId)
    const now = new Date()
    const trashBatchPath =
      collected.fsMoves.length > 0 ? path.join(getTrashRoot(workspaceId), batchId) : null

    const result = withTransaction(() => {
      // 1. entity-link / reminder snapshot — hard delete 전 캡처
      const allTodoIds = collected.todoIds
      const allScheduleIds = collected.scheduleIds
      const allCanvasIds = collected.canvasIds
      const allCanvasNodeIds = collected.canvasNodeIds
      const allNoteIds = collected.noteIds
      const allCsvIds = collected.csvIds
      const allPdfIds = collected.pdfIds
      const allImageIds = collected.imageIds

      const linkSnapshots: LinkSnapshot[] = [
        ...captureLinks('todo', allTodoIds),
        ...captureLinks('schedule', allScheduleIds),
        ...captureLinks('canvas', allCanvasIds),
        ...captureLinks('note', allNoteIds),
        ...captureLinks('csv', allCsvIds),
        ...captureLinks('pdf', allPdfIds),
        ...captureLinks('image', allImageIds)
      ]
      const reminderSnapshots: ReminderSnapshot[] = [
        ...captureReminders('todo', allTodoIds),
        ...captureReminders('schedule', allScheduleIds)
      ]

      const metadata: TrashMetadata = {
        links: linkSnapshots.length > 0 ? linkSnapshots : undefined,
        reminders: reminderSnapshots.length > 0 ? reminderSnapshots : undefined
      }

      // 2. trash_batches row 생성
      db.insert(trashBatches)
        .values({
          id: batchId,
          workspaceId,
          rootEntityType: entityType,
          rootEntityId: entityId,
          rootTitle: collected.rootTitle,
          childCount: totalChildCount(collected),
          fsTrashPath: trashBatchPath,
          metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
          deletedAt: now,
          reason: options.reason ?? 'user_action'
        })
        .run()

      // 3. entity-link / reminder hard delete (snapshot 은 metadata 에 있음)
      // canvas-node refId 로 연결된 노드는 손대지 않음 — orphan 표시는 UI 책임
      // 모든 도메인에 대해 양방향 link 정리 — 누락 시 trash 상태 entity 가리키는
      // dangling link 가 남음. snapshot 은 captureLinks 가 이미 모두 잡았으므로 안전.
      for (const id of allTodoIds) entityLinkRepository.removeAllByEntity('todo', id)
      for (const id of allScheduleIds) entityLinkRepository.removeAllByEntity('schedule', id)
      for (const id of allCanvasIds) entityLinkRepository.removeAllByEntity('canvas', id)
      for (const id of allNoteIds) entityLinkRepository.removeAllByEntity('note', id)
      for (const id of allCsvIds) entityLinkRepository.removeAllByEntity('csv', id)
      for (const id of allPdfIds) entityLinkRepository.removeAllByEntity('pdf', id)
      for (const id of allImageIds) entityLinkRepository.removeAllByEntity('image', id)
      if (allTodoIds.length > 0) {
        db.delete(reminders)
          .where(and(eq(reminders.entityType, 'todo'), inArray(reminders.entityId, allTodoIds)))
          .run()
      }
      if (allScheduleIds.length > 0) {
        db.delete(reminders)
          .where(
            and(eq(reminders.entityType, 'schedule'), inArray(reminders.entityId, allScheduleIds))
          )
          .run()
      }

      // 4. 해당 row 들의 deletedAt + trashBatchId 일괄 업데이트
      const setTrash = { deletedAt: now, trashBatchId: batchId }

      if (allTodoIds.length > 0) {
        db.update(todos).set(setTrash).where(inArray(todos.id, allTodoIds)).run()
      }
      if (allScheduleIds.length > 0) {
        db.update(schedules).set(setTrash).where(inArray(schedules.id, allScheduleIds)).run()
      }
      if (collected.recurringRuleIds.length > 0) {
        db.update(recurringRules)
          .set(setTrash)
          .where(inArray(recurringRules.id, collected.recurringRuleIds))
          .run()
      }
      if (allCanvasIds.length > 0) {
        db.update(canvases).set(setTrash).where(inArray(canvases.id, allCanvasIds)).run()
      }
      if (allCanvasNodeIds.length > 0) {
        db.update(canvasNodes).set(setTrash).where(inArray(canvasNodes.id, allCanvasNodeIds)).run()
      }
      if (collected.canvasEdgeIds.length > 0) {
        db.update(canvasEdges)
          .set(setTrash)
          .where(inArray(canvasEdges.id, collected.canvasEdgeIds))
          .run()
      }
      if (collected.canvasGroupIds.length > 0) {
        db.update(canvasGroups)
          .set(setTrash)
          .where(inArray(canvasGroups.id, collected.canvasGroupIds))
          .run()
      }
      if (allNoteIds.length > 0) {
        db.update(notes).set(setTrash).where(inArray(notes.id, allNoteIds)).run()
      }
      if (allCsvIds.length > 0) {
        db.update(csvFiles).set(setTrash).where(inArray(csvFiles.id, allCsvIds)).run()
      }
      if (allPdfIds.length > 0) {
        db.update(pdfFiles).set(setTrash).where(inArray(pdfFiles.id, allPdfIds)).run()
      }
      if (allImageIds.length > 0) {
        db.update(imageFiles).set(setTrash).where(inArray(imageFiles.id, allImageIds)).run()
      }
      if (collected.folderIds.length > 0) {
        db.update(folders).set(setTrash).where(inArray(folders.id, collected.folderIds)).run()
      }
      if (collected.templateIds.length > 0) {
        db.update(templates).set(setTrash).where(inArray(templates.id, collected.templateIds)).run()
      }

      // 5. FS 이동 — 트랜잭션 안에서 실행 (DB 롤백 시 fs 도 원복은 별도 cleanup 필요).
      //    파일이 src 에 없는 경우 skip (이전 외부 삭제 흔적). DB 는 trash 로 보냄.
      for (const move of collected.fsMoves) {
        moveToTrash(move.src, move.dst)
      }

      return batchId
    })

    broadcastTrashChanged(workspaceId)
    return result
  }
}
