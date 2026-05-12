import path from 'path'
import { NotFoundError } from '../../lib/errors'
import { workspaceRepository } from '../../repositories/workspace'
import { todoRepository } from '../../repositories/todo'
import { scheduleRepository } from '../../repositories/schedule'
import { recurringRuleRepository } from '../../repositories/recurring-rule'
import { noteRepository } from '../../repositories/note'
import { csvFileRepository } from '../../repositories/csv-file'
import { pdfFileRepository } from '../../repositories/pdf-file'
import { imageFileRepository } from '../../repositories/image-file'
import { folderRepository } from '../../repositories/folder'
import { templateRepository } from '../../repositories/template'
import { getTrashRoot } from './helpers'
import { getTrashHandler } from './handlers/registry'
import type { TrashEntityKind } from './types'

/**
 * 휴지통 cascade 수집기 — root entity 삭제 시 어떤 자식 row 들이 함께
 * trash 로 들어가야 하는지 + 어떤 FS 이동이 필요한지를 산출.
 *
 * 순수 함수 (DB 읽기만, 쓰기 없음). softRemove 트랜잭션 진입 전에 호출됨.
 */

// ─── 결과 타입 ───────────────────────────────────────────────

export interface CollectedRows {
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
  /** 사용자가 직접 삭제 액션한 root entity 의 메타 (UI 표시용) */
  rootTitle: string
  /** FS 파일 도메인의 경우 워크스페이스 내 원본 절대 경로 → trash 절대 경로 매핑 */
  fsMoves: Array<{ src: string; dst: string; relativePath: string }>
}

export function emptyCollected(): CollectedRows {
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

// ─── 도메인별 cascade 수집 ────────────────────────────────────

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

/**
 * 폴더 cascade — relativePath prefix 로 모든 후손(폴더 + 안의 파일들) 수집.
 * fs 이동은 폴더 통째 한 번 — DB 자식 row 의 relativePath 는 그대로 보존(복구를 위해).
 */
function collectFolderCascade(
  workspaceId: string,
  rootId: string,
  batchId: string
): CollectedRows {
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

// ─── dispatcher ───────────────────────────────────────────────

/**
 * entity type 에 따른 cascade 수집.
 *
 * 점진 이전 중 — 등록된 handler 가 있으면 registry 로 라우팅, 없으면 아래
 * switch 의 inline `collect{X}Cascade` 함수로 fallback. Phase 3 종료 시점에
 * 모든 entity 가 handler 로 이전되면 switch 는 제거 (handler 미등록 = 에러).
 */
export function collectCascade(
  workspaceId: string,
  entityType: TrashEntityKind,
  entityId: string,
  batchId: string
): CollectedRows {
  // 1. handler 등록 여부 확인 — 등록되어 있으면 우회
  const handler = getTrashHandler(entityType)
  if (handler) {
    return handler.collectCascade(entityId, { workspaceId, batchId })
  }

  // 2. fallback — 아직 handler 로 이전되지 않은 entity
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
      // canvas 는 Phase 2 에서 handler 로 이전됨 — 위 경로로 처리됨
      throw new Error('Canvas handler not registered — check trash/handlers/index.ts import')
    case 'note':
    case 'csv':
    case 'pdf':
    case 'image':
      return collectFileCascade(workspaceId, entityType, entityId, batchId)
    case 'folder':
      return collectFolderCascade(workspaceId, entityId, batchId)
  }
}

export function totalChildCount(rows: CollectedRows): number {
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
