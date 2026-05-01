import { app, BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'
import { and, eq, inArray, isNull, lt } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '../db'
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
  reminders,
  notes,
  csvFiles,
  pdfFiles,
  imageFiles,
  folders,
  templates
} from '../db/schema'
import { NotFoundError, ValidationError } from '../lib/errors'
import { workspaceRepository } from '../repositories/workspace'
import { todoRepository } from '../repositories/todo'
import { scheduleRepository } from '../repositories/schedule'
import { recurringRuleRepository } from '../repositories/recurring-rule'
import { canvasRepository } from '../repositories/canvas'
import { canvasNodeRepository } from '../repositories/canvas-node'
import { canvasEdgeRepository } from '../repositories/canvas-edge'
import { canvasGroupRepository } from '../repositories/canvas-group'
import { noteRepository } from '../repositories/note'
import { csvFileRepository } from '../repositories/csv-file'
import { pdfFileRepository } from '../repositories/pdf-file'
import { imageFileRepository } from '../repositories/image-file'
import { entityLinkRepository } from '../repositories/entity-link'
import { folderRepository } from '../repositories/folder'
import { templateRepository } from '../repositories/template'
import { appSettingsRepository } from '../repositories/app-settings'
import { withTransaction } from '../lib/transaction'
import { resolveNameConflict } from '../lib/fs-utils'

/**
 * 휴지통 시스템 — soft delete + 복구 + 자동 정리.
 *
 * **현재 범위 (M2): DB-only 도메인 — canvas/todo/schedule/recurring_rule.**
 * Tier 1 (FS) 도메인은 M3에서 추가 — fs.trash 디렉토리 이동 로직 필요.
 *
 * 설계: `기능/MCP/v2/휴지통 시스템 설계 (P4-1 상세).md`
 */

// ─── 도메인 타입 ──────────────────────────────────────────────

export type TrashEntityKind =
  | 'folder'
  | 'note'
  | 'csv'
  | 'pdf'
  | 'image'
  | 'canvas'
  | 'todo'
  | 'schedule'
  | 'recurring_rule'
  | 'template'

const SUPPORTED_KINDS: ReadonlySet<TrashEntityKind> = new Set([
  'canvas',
  'todo',
  'schedule',
  'recurring_rule',
  'note',
  'csv',
  'pdf',
  'image',
  'folder',
  'template'
])

// ─── 응답 타입 ────────────────────────────────────────────────

export interface TrashBatchSummary {
  id: string
  workspaceId: string
  rootEntityType: TrashEntityKind
  rootEntityId: string
  rootTitle: string
  childCount: number
  deletedAt: Date
  reason: string | null
}

export interface TrashListOptions {
  types?: TrashEntityKind[]
  search?: string
  offset?: number
  limit?: number
}

export interface TrashListResult {
  batches: TrashBatchSummary[]
  total: number
  hasMore: boolean
  nextOffset: number
}

export interface SoftRemoveOptions {
  reason?: 'user_action' | 'mcp' | 'auto_sweep_pending'
}

// ─── 자동 비우기 설정 ────────────────────────────────────────

export type TrashRetentionKey = '1' | '7' | '30' | '90' | '365' | 'never'

const RETENTION_DAYS: Record<TrashRetentionKey, number | null> = {
  '1': 1,
  '7': 7,
  '30': 30,
  '90': 90,
  '365': 365,
  never: null
}

const SETTINGS_KEY = 'trash.autoEmptyDays'
const DEFAULT_RETENTION: TrashRetentionKey = '30'

function isValidRetention(v: string): v is TrashRetentionKey {
  return v in RETENTION_DAYS
}

// ─── FS trash 루트 (M3에서 사용) ──────────────────────────────

export function getTrashRoot(workspaceId: string): string {
  let userData: string
  try {
    userData = app.getPath('userData')
  } catch {
    // 테스트 환경 fallback
    userData = path.join(process.cwd(), '.rally-test-userdata')
  }
  return path.join(userData, 'trash', workspaceId)
}

/**
 * 휴지통 변경 broadcast — renderer의 useTrashWatcher가 받아 모든 활성 도메인 list 캐시를 무효화.
 * service 어느 경로(직접 IPC, 또는 noteService.remove 같은 간접 호출)로 들어와도 일관 broadcast 보장.
 *
 * 트랜잭션 외부에서 호출돼야 함 — DB 커밋 완료 후 알림.
 */
function broadcastTrashChanged(workspaceId: string): void {
  try {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('trash:changed', workspaceId)
    })
  } catch {
    // 테스트 환경 (electron 모듈 없음) — 무시
  }
}

// ─── entity-link / reminder snapshot 헬퍼 ─────────────────────

interface LinkSnapshot {
  sourceType: string
  sourceId: string
  targetType: string
  targetId: string
  workspaceId: string
  createdAt: number
}

interface ReminderSnapshot {
  id: string
  entityType: 'todo' | 'schedule'
  entityId: string
  offsetMs: number
  remindAt: number
  isFired: boolean
  createdAt: number
  updatedAt: number
}

interface TrashMetadata {
  links?: LinkSnapshot[]
  reminders?: ReminderSnapshot[]
}

function captureLinks(entityType: string, entityIds: string[]): LinkSnapshot[] {
  if (entityIds.length === 0) return []
  const rows = entityLinkRepository.findByEntities(entityType, entityIds)
  return rows.map((r) => ({
    sourceType: r.sourceType,
    sourceId: r.sourceId,
    targetType: r.targetType,
    targetId: r.targetId,
    workspaceId: r.workspaceId,
    createdAt: r.createdAt instanceof Date ? r.createdAt.getTime() : Number(r.createdAt)
  }))
}

function captureReminders(
  entityType: 'todo' | 'schedule',
  entityIds: string[]
): ReminderSnapshot[] {
  if (entityIds.length === 0) return []
  const rows = db
    .select()
    .from(reminders)
    .where(and(eq(reminders.entityType, entityType), inArray(reminders.entityId, entityIds)))
    .all()
  return rows.map((r) => ({
    id: r.id,
    entityType: r.entityType as 'todo' | 'schedule',
    entityId: r.entityId,
    offsetMs: r.offsetMs,
    remindAt: r.remindAt instanceof Date ? r.remindAt.getTime() : Number(r.remindAt),
    isFired: r.isFired,
    createdAt: r.createdAt instanceof Date ? r.createdAt.getTime() : Number(r.createdAt),
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.getTime() : Number(r.updatedAt)
  }))
}

// ─── softRemove 도메인별 cascade 수집 ─────────────────────────

interface CollectedRows {
  todoIds: string[]
  scheduleIds: string[]
  recurringRuleIds: string[]
  canvasIds: string[]
  canvasNodeIds: string[]
  canvasEdgeIds: string[]
  canvasGroupIds: string[]
  noteIds: string[]
  csvIds: string[]
  pdfIds: string[]
  imageIds: string[]
  folderIds: string[]
  templateIds: string[]
  /** 사용자가 직접 삭제 액션한 root entity의 메타 (UI 표시용) */
  rootTitle: string
  /** FS 파일 도메인의 경우 워크스페이스 내 원본 절대 경로 → trash 절대 경로 매핑 */
  fsMoves: Array<{ src: string; dst: string; relativePath: string }>
}

function emptyCollected(): CollectedRows {
  return {
    todoIds: [],
    scheduleIds: [],
    recurringRuleIds: [],
    canvasIds: [],
    canvasNodeIds: [],
    canvasEdgeIds: [],
    canvasGroupIds: [],
    noteIds: [],
    csvIds: [],
    pdfIds: [],
    imageIds: [],
    folderIds: [],
    templateIds: [],
    rootTitle: '',
    fsMoves: []
  }
}

function collectTodoCascade(rootId: string): CollectedRows {
  const root = todoRepository.findByIdIncludingDeleted(rootId)
  if (!root) throw new NotFoundError(`Todo not found: ${rootId}`)
  const descendantIds = todoRepository.findAllDescendantIds(rootId, { includeDeleted: true })
  return {
    ...emptyCollected(),
    todoIds: [rootId, ...descendantIds],
    rootTitle: root.title
  }
}

function collectScheduleCascade(rootId: string): CollectedRows {
  const row = scheduleRepository.findByIdIncludingDeleted(rootId)
  if (!row) throw new NotFoundError(`Schedule not found: ${rootId}`)
  return { ...emptyCollected(), scheduleIds: [rootId], rootTitle: row.title }
}

function collectRecurringRuleCascade(rootId: string): CollectedRows {
  const row = recurringRuleRepository.findByIdIncludingDeleted(rootId)
  if (!row) throw new NotFoundError(`Recurring rule not found: ${rootId}`)
  return { ...emptyCollected(), recurringRuleIds: [rootId], rootTitle: row.title }
}

function collectTemplateCascade(rootId: string): CollectedRows {
  const row = templateRepository.findByIdIncludingDeleted(rootId)
  if (!row) throw new NotFoundError(`Template not found: ${rootId}`)
  return { ...emptyCollected(), templateIds: [rootId], rootTitle: row.title }
}

function collectCanvasCascade(rootId: string): CollectedRows {
  const root = canvasRepository.findByIdIncludingDeleted(rootId)
  if (!root) throw new NotFoundError(`Canvas not found: ${rootId}`)
  const nodes = canvasNodeRepository.findByCanvasIdIncludingDeleted(rootId)
  const edges = canvasEdgeRepository.findByCanvasIdIncludingDeleted(rootId)
  const groups = canvasGroupRepository.findByCanvasIdIncludingDeleted(rootId)
  return {
    ...emptyCollected(),
    canvasIds: [rootId],
    canvasNodeIds: nodes.map((n) => n.id),
    canvasEdgeIds: edges.map((e) => e.id),
    canvasGroupIds: groups.map((g) => g.id),
    rootTitle: root.title
  }
}

/**
 * 폴더 cascade — relativePath prefix로 모든 후손(폴더 + 안의 파일들) 수집.
 * fs 이동은 폴더 통째 한 번 — DB 자식 row의 relativePath는 그대로 보존(복구를 위해).
 */
function collectFolderCascade(workspaceId: string, rootId: string, batchId: string): CollectedRows {
  const workspace = workspaceRepository.findById(workspaceId)
  if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

  const root = folderRepository.findByIdIncludingDeleted(rootId)
  if (!root) throw new NotFoundError(`Folder not found: ${rootId}`)

  const prefix = root.relativePath
  const prefixSlash = `${prefix}/`

  // 활성 + 휴지통 모두 — softRemove 자체는 활성 row만 다루지만 idempotent를 위해 raw 쿼리.
  // 실제로는 활성 자식만 trash로 보내야 하니 active만 수집.
  const allFolders = folderRepository.findByWorkspaceId(workspaceId)
  const folderIds: string[] = [rootId]
  for (const f of allFolders) {
    if (f.id !== rootId && f.relativePath.startsWith(prefixSlash)) folderIds.push(f.id)
  }

  // 각 도메인 활성 row 중 relativePath 가 root나 root/ prefix로 시작하는 것
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

/** 단일 파일 도메인 (note/csv/pdf/image) cascade 수집 + fs 이동 경로 매핑 */
function collectFileCascade(
  workspaceId: string,
  kind: 'note' | 'csv' | 'pdf' | 'image',
  rootId: string,
  batchId: string
): CollectedRows {
  const workspace = workspaceRepository.findById(workspaceId)
  if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

  const repo =
    kind === 'note'
      ? noteRepository
      : kind === 'csv'
        ? csvFileRepository
        : kind === 'pdf'
          ? pdfFileRepository
          : imageFileRepository
  const row = repo.findByIdIncludingDeleted(rootId)
  if (!row) throw new NotFoundError(`${kind} not found: ${rootId}`)

  const trashRoot = path.join(getTrashRoot(workspaceId), batchId)
  const src = path.join(workspace.path, row.relativePath)
  const dst = path.join(trashRoot, row.relativePath)

  const collected: CollectedRows = {
    ...emptyCollected(),
    rootTitle: row.title,
    fsMoves: [{ src, dst, relativePath: row.relativePath }]
  }
  if (kind === 'note') collected.noteIds = [rootId]
  if (kind === 'csv') collected.csvIds = [rootId]
  if (kind === 'pdf') collected.pdfIds = [rootId]
  if (kind === 'image') collected.imageIds = [rootId]
  return collected
}

function collectCascade(
  workspaceId: string,
  entityType: TrashEntityKind,
  entityId: string,
  batchId: string
): CollectedRows {
  switch (entityType) {
    case 'todo':
      return collectTodoCascade(entityId)
    case 'schedule':
      return collectScheduleCascade(entityId)
    case 'recurring_rule':
      return collectRecurringRuleCascade(entityId)
    case 'template':
      return collectTemplateCascade(entityId)
    case 'canvas':
      return collectCanvasCascade(entityId)
    case 'note':
    case 'csv':
    case 'pdf':
    case 'image':
      return collectFileCascade(workspaceId, entityType, entityId, batchId)
    case 'folder':
      return collectFolderCascade(workspaceId, entityId, batchId)
  }
}

function totalChildCount(rows: CollectedRows): number {
  return (
    rows.todoIds.length +
    rows.scheduleIds.length +
    rows.recurringRuleIds.length +
    rows.canvasIds.length +
    rows.canvasNodeIds.length +
    rows.canvasEdgeIds.length +
    rows.canvasGroupIds.length +
    rows.noteIds.length +
    rows.csvIds.length +
    rows.pdfIds.length +
    rows.imageIds.length +
    rows.folderIds.length +
    rows.templateIds.length -
    1 // root entity 자신 제외
  )
}

// ─── FS 이동 헬퍼 ────────────────────────────────────────────

/**
 * 워크스페이스 내 파일을 trash 디렉토리로 이동.
 * 같은 디스크면 fs.renameSync (atomic), 크로스-디스크면 copy + unlink.
 * 부모 디렉토리는 자동 생성. 이미 dst가 존재하면 throw (보장: caller가 batchId 유니크).
 */
function moveToTrash(src: string, dst: string): void {
  fs.mkdirSync(path.dirname(dst), { recursive: true })
  try {
    fs.renameSync(src, dst)
  } catch (e) {
    // EXDEV (cross-device) 시 fallback
    if ((e as NodeJS.ErrnoException).code === 'EXDEV') {
      fs.copyFileSync(src, dst)
      fs.unlinkSync(src)
    } else if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      // 원본 파일이 이미 없음 — 이전 외부 삭제. DB row만 trash로 보내면 됨 (skip move)
      return
    } else {
      throw e
    }
  }
}

/** trash → 워크스페이스. 같은 위치에 다른 파일 있으면 자동 rename. */
function moveFromTrash(src: string, dstBase: string, relativePath: string): string {
  if (!fs.existsSync(src)) {
    // trash 파일이 사라짐 (외부 정리?) → DB row만 복구, fs 작업 skip
    return relativePath
  }
  const parentRel = relativePath.includes('/') ? relativePath.split('/').slice(0, -1).join('/') : ''
  const parentAbs = parentRel ? path.join(dstBase, parentRel) : dstBase
  fs.mkdirSync(parentAbs, { recursive: true })
  const desiredName = relativePath.split('/').pop()!
  const finalName = resolveNameConflict(parentAbs, desiredName)
  const finalRel = parentRel ? `${parentRel}/${finalName}` : finalName
  const dst = path.join(dstBase, finalRel)
  try {
    fs.renameSync(src, dst)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EXDEV') {
      fs.copyFileSync(src, dst)
      fs.unlinkSync(src)
    } else {
      throw e
    }
  }
  return finalRel
}

/** trash batch 디렉토리 영구 삭제 */
function purgeTrashDir(absPath: string | null): void {
  if (!absPath) return
  try {
    fs.rmSync(absPath, { recursive: true, force: true })
  } catch {
    // 이미 없음 등 — 무시
  }
}

// ─── service ──────────────────────────────────────────────────

export const trashService = {
  /**
   * entity를 휴지통으로 이동. cascade 자식은 같은 batch_id로 묶임.
   * @returns 생성된 trash_batch_id
   */
  softRemove(
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

      // 3. entity-link / reminder hard delete (snapshot은 metadata에 있음)
      // canvas-node refId로 연결된 노드는 손대지 않음 — orphan 표시는 UI 책임
      for (const id of allTodoIds) entityLinkRepository.removeAllByEntity('todo', id)
      for (const id of allScheduleIds) entityLinkRepository.removeAllByEntity('schedule', id)
      for (const id of allCanvasIds) entityLinkRepository.removeAllByEntity('canvas', id)
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

      // 4. 해당 row들의 deletedAt + trashBatchId 일괄 업데이트
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

      // 5. FS 이동 — 트랜잭션 안에서 실행 (DB 롤백 시 fs도 원복은 별도 cleanup 필요).
      //    파일이 src에 없는 경우 skip (이전 외부 삭제 흔적). DB는 trash로 보냄.
      for (const move of collected.fsMoves) {
        moveToTrash(move.src, move.dst)
      }

      return batchId
    })

    broadcastTrashChanged(workspaceId)
    return result
  },

  /**
   * batch 단위 복구. deletedAt = NULL로 되돌림.
   * entity-link snapshot은 활성 entity에 한해 재생성.
   */
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

      // 1. FS 복구 — folder는 통째 한 번, 파일 도메인은 단건씩
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
        // 노트 단독 restore) folderId가 dangling이 되므로 root로 복구해 정합성 유지.
        const isFolderActive = (folderId: string | null): boolean => {
          if (!folderId) return true // 이미 root
          const f = folderRepository.findByIdIncludingDeleted(folderId)
          return !!f && f.deletedAt === null
        }

        const fsRestore = (
          rows: { id: string; folderId: string | null; relativePath: string }[],
          updateRow: (
            id: string,
            patch: { relativePath: string; folderId?: string | null }
          ) => void
        ): void => {
          for (const row of rows) {
            // 부모 trash/deleted 시 root로 강등 — relativePath는 파일명만 남김
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

      // 2. 같은 batch의 모든 row deletedAt = NULL
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

      // 3. folder rename 충돌 발생 시 모든 자식 row의 relativePath prefix 갱신
      //    — 위에서 deletedAt 해제 후 호출 (bulkUpdatePathPrefix는 활성 row만 대상)
      if (folderRenameOldPrefix !== null && folderRenameNewPrefix !== null) {
        const oldPrefix = folderRenameOldPrefix
        const newPrefix = folderRenameNewPrefix
        folderRepository.bulkUpdatePathPrefix(batch.workspaceId, oldPrefix, newPrefix)
        noteRepository.bulkUpdatePathPrefix(batch.workspaceId, oldPrefix, newPrefix)
        csvFileRepository.bulkUpdatePathPrefix(batch.workspaceId, oldPrefix, newPrefix)
        pdfFileRepository.bulkUpdatePathPrefix(batch.workspaceId, oldPrefix, newPrefix)
        imageFileRepository.bulkUpdatePathPrefix(batch.workspaceId, oldPrefix, newPrefix)
      }

      // 2. entity-link / reminder snapshot 복원 (양쪽 entity가 모두 활성일 때만 — orphan 회피)
      const conflicts: { id: string; reason: string }[] = []
      if (batch.metadata) {
        const meta = JSON.parse(batch.metadata) as TrashMetadata
        if (meta.links) {
          for (const link of meta.links) {
            // 양쪽 활성 여부 검증은 service 레이어가 못 해서 raw insert에 onConflictDoNothing
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
        // reminders는 복원 안 함 — 시간 지난 알림은 의미 없음 (사용자가 다시 설정)
      }

      // 3. trash_batches row 삭제 (FK set null로 trashBatchId가 자동 NULL이 되긴 하지만
      //    이미 위에서 명시적으로 NULL 처리했으므로 그냥 삭제만)
      // restored 배열에는 root + cascade 자식 todos를 함께 포함 (다른 도메인은 추후 확장 가능).
      // todo의 경우 부모-자식 관계가 사용자에게 가시적이므로 응답에 명시.
      const restored: { type: TrashEntityKind; id: string; title: string }[] = [
        {
          type: batch.rootEntityType as TrashEntityKind,
          id: batch.rootEntityId,
          title: batch.rootTitle
        }
      ]
      if (batch.rootEntityType === 'todo') {
        // setActive 후 trashBatchId=null이라 trashBatchId 기준으로 못 잡음 → root id로부터 활성 후손 재수집.
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
  },

  /** batch 영구 삭제 — DB row hard delete (cascade FK가 자식까지 정리) + FS trash 디렉토리 제거 */
  purge(batchId: string): void {
    const batch = db.select().from(trashBatches).where(eq(trashBatches.id, batchId)).get()
    if (!batch) throw new NotFoundError(`Trash batch not found: ${batchId}`)
    const fsPath = batch.fsTrashPath
    const purgedWorkspaceId = batch.workspaceId

    withTransaction(() => {
      // 자식 row를 먼저 hard delete (FK가 cascade라 부모만 지워도 되지만 명시적으로)
      db.delete(canvasEdges).where(eq(canvasEdges.trashBatchId, batchId)).run()
      db.delete(canvasNodes).where(eq(canvasNodes.trashBatchId, batchId)).run()
      db.delete(canvasGroups).where(eq(canvasGroups.trashBatchId, batchId)).run()
      db.delete(canvases).where(eq(canvases.trashBatchId, batchId)).run()
      db.delete(todos).where(eq(todos.trashBatchId, batchId)).run()
      db.delete(schedules).where(eq(schedules.trashBatchId, batchId)).run()
      db.delete(recurringRules).where(eq(recurringRules.trashBatchId, batchId)).run()
      db.delete(notes).where(eq(notes.trashBatchId, batchId)).run()
      db.delete(csvFiles).where(eq(csvFiles.trashBatchId, batchId)).run()
      db.delete(pdfFiles).where(eq(pdfFiles.trashBatchId, batchId)).run()
      db.delete(imageFiles).where(eq(imageFiles.trashBatchId, batchId)).run()
      db.delete(folders).where(eq(folders.trashBatchId, batchId)).run()
      db.delete(templates).where(eq(templates.trashBatchId, batchId)).run()

      db.delete(trashBatches).where(eq(trashBatches.id, batchId)).run()
    })

    // FS trash 디렉토리 제거 (트랜잭션 외부 — rollback 불가능하므로)
    purgeTrashDir(fsPath)
    broadcastTrashChanged(purgedWorkspaceId)
  },

  /** workspace 단위 휴지통 batch 목록 (최근 삭제 우선) */
  list(workspaceId: string, options: TrashListOptions = {}): TrashListResult {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const offset = options.offset ?? 0
    const limit = options.limit ?? 50
    if (offset < 0) throw new ValidationError('offset must be >= 0')
    if (limit < 1 || limit > 200) throw new ValidationError('limit must be between 1 and 200')

    const conditions = [eq(trashBatches.workspaceId, workspaceId)]
    if (options.types && options.types.length > 0) {
      conditions.push(inArray(trashBatches.rootEntityType, options.types))
    }
    let rows = db
      .select()
      .from(trashBatches)
      .where(and(...conditions))
      .all()

    if (options.search && options.search.trim()) {
      const lower = options.search.trim().toLowerCase()
      rows = rows.filter((r) => r.rootTitle.toLowerCase().includes(lower))
    }

    rows.sort(
      (a, b) =>
        (b.deletedAt instanceof Date ? b.deletedAt.getTime() : Number(b.deletedAt)) -
        (a.deletedAt instanceof Date ? a.deletedAt.getTime() : Number(a.deletedAt))
    )

    const total = rows.length
    const sliced = rows.slice(offset, offset + limit)
    const batches: TrashBatchSummary[] = sliced.map((r) => ({
      id: r.id,
      workspaceId: r.workspaceId,
      rootEntityType: r.rootEntityType as TrashEntityKind,
      rootEntityId: r.rootEntityId,
      rootTitle: r.rootTitle,
      childCount: r.childCount,
      deletedAt: r.deletedAt instanceof Date ? r.deletedAt : new Date(r.deletedAt),
      reason: r.reason
    }))

    return {
      batches,
      total,
      hasMore: offset + sliced.length < total,
      nextOffset: offset + sliced.length
    }
  },

  /**
   * deletedAt < (now - cutoffMs)인 batch 모두 purge.
   * @returns purge된 batch 수
   */
  sweep(workspaceId: string, cutoffMs: number): number {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)
    if (cutoffMs < 0) throw new ValidationError('cutoffMs must be >= 0')

    const cutoff = new Date(Date.now() - cutoffMs)
    const oldBatches = db
      .select({ id: trashBatches.id })
      .from(trashBatches)
      .where(and(eq(trashBatches.workspaceId, workspaceId), lt(trashBatches.deletedAt, cutoff)))
      .all()

    for (const { id } of oldBatches) {
      this.purge(id)
    }
    return oldBatches.length
  },

  /** trashBatchId 역참조 — UI에서 단건 entity로 batch 찾기 (예: "이거 어느 batch?"). */
  findBatchByEntity(_workspaceId: string, batchIdField: string | null): TrashBatchSummary | null {
    if (!batchIdField) return null
    const batch = db.select().from(trashBatches).where(eq(trashBatches.id, batchIdField)).get()
    if (!batch) return null
    return {
      id: batch.id,
      workspaceId: batch.workspaceId,
      rootEntityType: batch.rootEntityType as TrashEntityKind,
      rootEntityId: batch.rootEntityId,
      rootTitle: batch.rootTitle,
      childCount: batch.childCount,
      deletedAt: batch.deletedAt instanceof Date ? batch.deletedAt : new Date(batch.deletedAt),
      reason: batch.reason
    }
  },

  /** 휴지통에 있는 row만 — UI의 "휴지통 비어있는지?" 표시 */
  countByWorkspace(workspaceId: string): number {
    return db.select().from(trashBatches).where(eq(trashBatches.workspaceId, workspaceId)).all()
      .length
  },

  // ─── 자동 비우기 설정 + cron 헬퍼 ────────────────────────────

  getRetention(): TrashRetentionKey {
    const raw = appSettingsRepository.get(SETTINGS_KEY)
    if (raw && isValidRetention(raw)) return raw
    return DEFAULT_RETENTION
  },

  setRetention(value: TrashRetentionKey): void {
    if (!isValidRetention(value)) {
      throw new ValidationError(
        `Invalid retention: ${value}. Must be one of ${Object.keys(RETENTION_DAYS).join(', ')}.`
      )
    }
    appSettingsRepository.set(SETTINGS_KEY, value)
  },

  /**
   * 모든 워크스페이스에 대해 retention 설정에 맞춰 sweep.
   * 'never' 설정이면 0 반환하고 아무것도 하지 않음.
   * @returns 전체 purge된 batch 수
   */
  sweepAll(): number {
    const retention = this.getRetention()
    const days = RETENTION_DAYS[retention]
    if (days === null) return 0 // never

    const cutoffMs = days * 24 * 60 * 60 * 1000
    const allWs = db.select({ id: trashBatches.workspaceId }).from(trashBatches).all()
    const wsIds = Array.from(new Set(allWs.map((r) => r.id)))
    let totalPurged = 0
    for (const wsId of wsIds) {
      try {
        totalPurged += this.sweep(wsId, cutoffMs)
      } catch {
        // 워크스페이스 단위 실패는 다른 워크스페이스 sweep을 막지 않음
      }
    }
    return totalPurged
  }
}
