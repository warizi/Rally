import { workspaceWatcher } from '../../../services/workspace-watcher'
import { workspaceRepository } from '../../../repositories/workspace'
import { noteRepository, type Note } from '../../../repositories/note'
import { csvFileRepository, type CsvFile } from '../../../repositories/csv-file'
import { ValidationError, NotFoundError } from '../../../lib/errors'

export function requireBody(body: unknown): asserts body is Record<string, unknown> {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body is required')
  }
}

export function resolveActiveWorkspace(): string {
  const wsId = workspaceWatcher.getActiveWorkspaceId()
  if (!wsId)
    throw new ValidationError('활성 워크스페이스가 없습니다. Rally에서 워크스페이스를 열어주세요.')
  const ws = workspaceRepository.findById(wsId)
  if (!ws) throw new ValidationError('활성 워크스페이스를 찾을 수 없습니다.')
  return wsId
}

export function resolveItemType(
  id: string
): { type: 'note'; row: Note } | { type: 'table'; row: CsvFile } {
  const note = noteRepository.findById(id)
  if (note) return { type: 'note', row: note }
  const csv = csvFileRepository.findById(id)
  if (csv) return { type: 'table', row: csv }
  throw new NotFoundError(`Item not found: ${id}`)
}

/**
 * entity가 활성 워크스페이스에 속하는지 검증.
 * null/undefined / 다른 워크스페이스면 NotFoundError throw — 정보 노출 방지를 위해
 * 'forbidden' 대신 'not found'로 응답.
 */
export function assertOwnedByWorkspace<T extends { workspaceId: string }>(
  entity: T | null | undefined,
  wsId: string,
  notFoundMessage: string
): asserts entity is T {
  if (!entity || entity.workspaceId !== wsId) {
    throw new NotFoundError(notFoundMessage)
  }
}
