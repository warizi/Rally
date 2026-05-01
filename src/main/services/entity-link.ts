import { inArray } from 'drizzle-orm'
import { db } from '../db'
import { todos, schedules, notes, csvFiles, pdfFiles, imageFiles, canvases } from '../db/schema'
import { entityLinkRepository } from '../repositories/entity-link'
import { todoRepository } from '../repositories/todo'
import { scheduleRepository } from '../repositories/schedule'
import { noteRepository } from '../repositories/note'
import { pdfFileRepository } from '../repositories/pdf-file'
import { imageFileRepository } from '../repositories/image-file'
import { csvFileRepository } from '../repositories/csv-file'
import { canvasRepository } from '../repositories/canvas'
import { NotFoundError, ValidationError } from '../lib/errors'
import type { LinkableEntityType } from '../db/schema/entity-link'

export interface LinkedEntity {
  entityType: LinkableEntityType
  entityId: string
  title: string
  linkedAt: Date
}

function findEntity(
  type: LinkableEntityType,
  id: string
): { workspaceId: string; title: string } | undefined {
  switch (type) {
    case 'todo':
      return todoRepository.findById(id)
    case 'schedule':
      return scheduleRepository.findById(id) as { workspaceId: string; title: string } | undefined
    case 'note':
      return noteRepository.findById(id)
    case 'pdf':
      return pdfFileRepository.findById(id)
    case 'csv':
      return csvFileRepository.findById(id)
    case 'image':
      return imageFileRepository.findById(id)
    case 'canvas':
      return canvasRepository.findById(id)
  }
}

function getWorkspaceId(type: LinkableEntityType, entity: { workspaceId: string | null }): string {
  const wsId = entity.workspaceId
  if (!wsId) throw new ValidationError(`Entity ${type} has no workspaceId`)
  return wsId
}

function getTitle(_type: LinkableEntityType, entity: { title: string }): string {
  return entity.title
}

/**
 * 여러 entity의 메타(title)를 type별 inArray로 일괄 fetch.
 * 반환 키: `${type}:${id}` (type 간 ID 충돌 방지)
 */
function fetchEntityTitlesBatch(
  refs: { type: LinkableEntityType; id: string }[]
): Map<string, string> {
  const result = new Map<string, string>()
  if (refs.length === 0) return result

  const byType: Record<LinkableEntityType, string[]> = {
    todo: [],
    schedule: [],
    note: [],
    csv: [],
    pdf: [],
    image: [],
    canvas: []
  }
  // 중복 제거
  const seen = new Set<string>()
  for (const { type, id } of refs) {
    const key = `${type}:${id}`
    if (seen.has(key)) continue
    seen.add(key)
    byType[type].push(id)
  }

  if (byType.todo.length > 0) {
    const rows = db
      .select({ id: todos.id, title: todos.title })
      .from(todos)
      .where(inArray(todos.id, byType.todo))
      .all()
    for (const r of rows) result.set(`todo:${r.id}`, r.title)
  }
  if (byType.schedule.length > 0) {
    const rows = db
      .select({ id: schedules.id, title: schedules.title })
      .from(schedules)
      .where(inArray(schedules.id, byType.schedule))
      .all()
    for (const r of rows) result.set(`schedule:${r.id}`, r.title)
  }
  if (byType.note.length > 0) {
    const rows = db
      .select({ id: notes.id, title: notes.title })
      .from(notes)
      .where(inArray(notes.id, byType.note))
      .all()
    for (const r of rows) result.set(`note:${r.id}`, r.title)
  }
  if (byType.csv.length > 0) {
    const rows = db
      .select({ id: csvFiles.id, title: csvFiles.title })
      .from(csvFiles)
      .where(inArray(csvFiles.id, byType.csv))
      .all()
    for (const r of rows) result.set(`csv:${r.id}`, r.title)
  }
  if (byType.pdf.length > 0) {
    const rows = db
      .select({ id: pdfFiles.id, title: pdfFiles.title })
      .from(pdfFiles)
      .where(inArray(pdfFiles.id, byType.pdf))
      .all()
    for (const r of rows) result.set(`pdf:${r.id}`, r.title)
  }
  if (byType.image.length > 0) {
    const rows = db
      .select({ id: imageFiles.id, title: imageFiles.title })
      .from(imageFiles)
      .where(inArray(imageFiles.id, byType.image))
      .all()
    for (const r of rows) result.set(`image:${r.id}`, r.title)
  }
  if (byType.canvas.length > 0) {
    const rows = db
      .select({ id: canvases.id, title: canvases.title })
      .from(canvases)
      .where(inArray(canvases.id, byType.canvas))
      .all()
    for (const r of rows) result.set(`canvas:${r.id}`, r.title)
  }

  return result
}

/**
 * 여러 entity의 preview/description을 type별 inArray로 일괄 fetch.
 * - note/csv/pdf/image: preview (본문 앞 200자 캐시)
 * - canvas/todo/schedule: description
 * 반환 키: `${type}:${id}`. 빈 문자열은 null로 정규화.
 */
function fetchEntityPreviewsBatch(
  refs: { type: LinkableEntityType; id: string }[]
): Map<string, string | null> {
  const result = new Map<string, string | null>()
  if (refs.length === 0) return result

  const byType: Record<LinkableEntityType, string[]> = {
    todo: [],
    schedule: [],
    note: [],
    csv: [],
    pdf: [],
    image: [],
    canvas: []
  }
  const seen = new Set<string>()
  for (const { type, id } of refs) {
    const key = `${type}:${id}`
    if (seen.has(key)) continue
    seen.add(key)
    byType[type].push(id)
  }

  const norm = (s: string | null): string | null => (s && s.trim() ? s : null)

  if (byType.note.length > 0) {
    const rows = db
      .select({ id: notes.id, preview: notes.preview })
      .from(notes)
      .where(inArray(notes.id, byType.note))
      .all()
    for (const r of rows) result.set(`note:${r.id}`, norm(r.preview))
  }
  if (byType.csv.length > 0) {
    const rows = db
      .select({ id: csvFiles.id, preview: csvFiles.preview })
      .from(csvFiles)
      .where(inArray(csvFiles.id, byType.csv))
      .all()
    for (const r of rows) result.set(`csv:${r.id}`, norm(r.preview))
  }
  if (byType.pdf.length > 0) {
    const rows = db
      .select({ id: pdfFiles.id, preview: pdfFiles.preview })
      .from(pdfFiles)
      .where(inArray(pdfFiles.id, byType.pdf))
      .all()
    for (const r of rows) result.set(`pdf:${r.id}`, norm(r.preview))
  }
  if (byType.image.length > 0) {
    const rows = db
      .select({ id: imageFiles.id, preview: imageFiles.preview })
      .from(imageFiles)
      .where(inArray(imageFiles.id, byType.image))
      .all()
    for (const r of rows) result.set(`image:${r.id}`, norm(r.preview))
  }
  if (byType.canvas.length > 0) {
    const rows = db
      .select({ id: canvases.id, description: canvases.description })
      .from(canvases)
      .where(inArray(canvases.id, byType.canvas))
      .all()
    for (const r of rows) result.set(`canvas:${r.id}`, norm(r.description))
  }
  if (byType.todo.length > 0) {
    const rows = db
      .select({ id: todos.id, description: todos.description })
      .from(todos)
      .where(inArray(todos.id, byType.todo))
      .all()
    for (const r of rows) result.set(`todo:${r.id}`, norm(r.description))
  }
  if (byType.schedule.length > 0) {
    const rows = db
      .select({ id: schedules.id, description: schedules.description })
      .from(schedules)
      .where(inArray(schedules.id, byType.schedule))
      .all()
    for (const r of rows) result.set(`schedule:${r.id}`, norm(r.description))
  }

  return result
}

export interface LinkedEntityWithPreview extends LinkedEntity {
  preview: string | null
}

interface NormalizedLink {
  sourceType: LinkableEntityType
  sourceId: string
  targetType: LinkableEntityType
  targetId: string
}

function normalize(
  typeA: LinkableEntityType,
  idA: string,
  typeB: LinkableEntityType,
  idB: string
): NormalizedLink {
  if (typeA < typeB) return { sourceType: typeA, sourceId: idA, targetType: typeB, targetId: idB }
  if (typeA > typeB) return { sourceType: typeB, sourceId: idB, targetType: typeA, targetId: idA }
  if (idA < idB) return { sourceType: typeA, sourceId: idA, targetType: typeB, targetId: idB }
  return { sourceType: typeB, sourceId: idB, targetType: typeA, targetId: idA }
}

export const entityLinkService = {
  link(
    typeA: LinkableEntityType,
    idA: string,
    typeB: LinkableEntityType,
    idB: string,
    workspaceId: string
  ): void {
    if (typeA === typeB && idA === idB) {
      throw new ValidationError('Cannot link an entity to itself')
    }

    const entityA = findEntity(typeA, idA)
    if (!entityA) throw new NotFoundError(`${typeA} not found: ${idA}`)
    const entityB = findEntity(typeB, idB)
    if (!entityB) throw new NotFoundError(`${typeB} not found: ${idB}`)

    const wsA = getWorkspaceId(typeA, entityA)
    const wsB = getWorkspaceId(typeB, entityB)
    if (wsA !== wsB) {
      throw new ValidationError('Cannot link entities from different workspaces')
    }
    if (wsA !== workspaceId) {
      throw new ValidationError('Workspace mismatch')
    }

    const normalized = normalize(typeA, idA, typeB, idB)
    entityLinkRepository.link({
      ...normalized,
      workspaceId,
      createdAt: new Date()
    })
  },

  unlink(
    typeA: LinkableEntityType,
    idA: string,
    typeB: LinkableEntityType,
    idB: string,
    workspaceId?: string
  ): void {
    // workspaceId 인자가 주어지면 양 끝 entity가 그 워크스페이스에 속하는지 검증.
    // 미제공 시 기존 동작 유지 (backward-compat).
    if (workspaceId) {
      const entityA = findEntity(typeA, idA)
      if (entityA) {
        const wsA = getWorkspaceId(typeA, entityA)
        if (wsA !== workspaceId) {
          throw new NotFoundError(`${typeA} not found in active workspace: ${idA}`)
        }
      }
      const entityB = findEntity(typeB, idB)
      if (entityB) {
        const wsB = getWorkspaceId(typeB, entityB)
        if (wsB !== workspaceId) {
          throw new NotFoundError(`${typeB} not found in active workspace: ${idB}`)
        }
      }
    }

    const normalized = normalize(typeA, idA, typeB, idB)
    entityLinkRepository.unlink(
      normalized.sourceType,
      normalized.sourceId,
      normalized.targetType,
      normalized.targetId
    )
  },

  getLinked(
    entityType: LinkableEntityType,
    entityId: string,
    workspaceId?: string
  ): LinkedEntity[] {
    // workspaceId 인자가 주어지면 대상 entity가 그 워크스페이스에 속하는지 사전 검증.
    if (workspaceId) {
      const entity = findEntity(entityType, entityId)
      if (!entity || getWorkspaceId(entityType, entity) !== workspaceId) {
        throw new NotFoundError(`${entityType} not found in active workspace: ${entityId}`)
      }
    }
    const rows = entityLinkRepository.findByEntity(entityType, entityId)
    const result: LinkedEntity[] = []
    const orphanRows: {
      sourceType: string
      sourceId: string
      targetType: string
      targetId: string
    }[] = []

    for (const row of rows) {
      const isSource = row.sourceType === entityType && row.sourceId === entityId
      const linkedType = (isSource ? row.targetType : row.sourceType) as LinkableEntityType
      const linkedId = isSource ? row.targetId : row.sourceId

      const entity = findEntity(linkedType, linkedId)
      if (!entity) {
        orphanRows.push(row)
        continue
      }

      result.push({
        entityType: linkedType,
        entityId: linkedId,
        title: getTitle(linkedType, entity),
        linkedAt: row.createdAt
      })
    }

    for (const orphan of orphanRows) {
      entityLinkRepository.unlink(
        orphan.sourceType,
        orphan.sourceId,
        orphan.targetType,
        orphan.targetId
      )
    }

    return result
  },

  /**
   * 여러 entity의 링크를 일괄 조회 (N+1 회피).
   * 반환: entity ID → LinkedEntity[] Map.
   * 호출자는 워크스페이스 검증을 직접 해야 함 (이 함수는 batch 검증 미지원).
   */
  getLinkedBatch(entityType: LinkableEntityType, entityIds: string[]): Map<string, LinkedEntity[]> {
    const result = new Map<string, LinkedEntity[]>()
    if (entityIds.length === 0) return result

    // 1. 단일 쿼리로 모든 link row fetch
    const rows = entityLinkRepository.findByEntities(entityType, entityIds)

    // 2. 본인 ID별로 그룹화 + 반대편 type/id 추출
    const idSet = new Set(entityIds)
    interface Ref {
      myId: string
      otherType: LinkableEntityType
      otherId: string
      createdAt: Date
    }
    const refs: Ref[] = []
    for (const row of rows) {
      if (row.sourceType === entityType && idSet.has(row.sourceId)) {
        refs.push({
          myId: row.sourceId,
          otherType: row.targetType as LinkableEntityType,
          otherId: row.targetId,
          createdAt: row.createdAt
        })
      } else if (row.targetType === entityType && idSet.has(row.targetId)) {
        refs.push({
          myId: row.targetId,
          otherType: row.sourceType as LinkableEntityType,
          otherId: row.sourceId,
          createdAt: row.createdAt
        })
      }
    }

    // 3. 반대편 entity title 일괄 fetch (type별 inArray)
    const titleMap = fetchEntityTitlesBatch(refs.map((r) => ({ type: r.otherType, id: r.otherId })))

    // 4. 결과 조립 (orphan은 batch에서 skip — cleanup은 별도 cron)
    for (const ref of refs) {
      const title = titleMap.get(`${ref.otherType}:${ref.otherId}`)
      if (!title) continue
      const arr = result.get(ref.myId) ?? []
      arr.push({
        entityType: ref.otherType,
        entityId: ref.otherId,
        title,
        linkedAt: ref.createdAt
      })
      result.set(ref.myId, arr)
    }

    return result
  },

  /**
   * 특정 entity에 연결된 다른 entity 중 targetType과 일치하는 ID 목록을 반환.
   * 예: findEntityIdsLinkedTo('todo', 'note', 'n-1') → note n-1과 연결된 todo id들.
   * list_todos의 linkedTo 필터에 사용.
   */
  findEntityIdsLinkedTo(
    targetType: LinkableEntityType,
    sourceType: LinkableEntityType,
    sourceId: string
  ): string[] {
    const rows = entityLinkRepository.findByEntity(sourceType, sourceId)
    const ids: string[] = []
    for (const row of rows) {
      if (
        row.sourceType === sourceType &&
        row.sourceId === sourceId &&
        row.targetType === targetType
      ) {
        ids.push(row.targetId)
      } else if (
        row.targetType === sourceType &&
        row.targetId === sourceId &&
        row.sourceType === targetType
      ) {
        ids.push(row.sourceId)
      }
    }
    return ids
  },

  /**
   * getLinkedBatch + 각 링크 대상의 preview/description을 일괄 fetch해 반환.
   * 추가 쿼리는 type별 1개씩 (최대 7개) — N+1 회피.
   */
  getLinkedBatchWithPreview(
    entityType: LinkableEntityType,
    entityIds: string[]
  ): Map<string, LinkedEntityWithPreview[]> {
    const linkedMap = this.getLinkedBatch(entityType, entityIds)
    const allRefs: { type: LinkableEntityType; id: string }[] = []
    for (const list of linkedMap.values()) {
      for (const l of list) allRefs.push({ type: l.entityType, id: l.entityId })
    }
    const previewMap = fetchEntityPreviewsBatch(allRefs)
    const enriched = new Map<string, LinkedEntityWithPreview[]>()
    for (const [id, list] of linkedMap.entries()) {
      enriched.set(
        id,
        list.map((l) => ({
          ...l,
          preview: previewMap.get(`${l.entityType}:${l.entityId}`) ?? null
        }))
      )
    }
    return enriched
  },

  removeAllLinks(entityType: LinkableEntityType, entityId: string): void {
    entityLinkRepository.removeAllByEntity(entityType, entityId)
  },

  removeAllLinksForTodos(todoIds: string[]): void {
    entityLinkRepository.removeAllByEntities('todo', todoIds)
  }
}
