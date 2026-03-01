import { entityLinkRepository } from '../repositories/entity-link'
import { todoRepository } from '../repositories/todo'
import { scheduleRepository } from '../repositories/schedule'
import { noteRepository } from '../repositories/note'
import { pdfFileRepository } from '../repositories/pdf-file'
import { csvFileRepository } from '../repositories/csv-file'
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

  unlink(typeA: LinkableEntityType, idA: string, typeB: LinkableEntityType, idB: string): void {
    const normalized = normalize(typeA, idA, typeB, idB)
    entityLinkRepository.unlink(
      normalized.sourceType,
      normalized.sourceId,
      normalized.targetType,
      normalized.targetId
    )
  },

  getLinked(entityType: LinkableEntityType, entityId: string): LinkedEntity[] {
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

  removeAllLinks(entityType: LinkableEntityType, entityId: string): void {
    entityLinkRepository.removeAllByEntity(entityType, entityId)
  },

  removeAllLinksForTodos(todoIds: string[]): void {
    entityLinkRepository.removeAllByEntities('todo', todoIds)
  }
}
