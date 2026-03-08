import path from 'path'
import fs from 'fs'
import type * as parcelWatcher from '@parcel/watcher'
import { folderRepository } from '../../repositories/folder'
import { entityLinkRepository } from '../../repositories/entity-link'
import { nanoid } from 'nanoid'
import { fileTypeConfigs } from './file-type-config'
import type { FileTypeConfig } from './file-type-config'

/**
 * 이벤트 배치 → DB 동기화
 *
 * 처리 순서 (순서 중요):
 * 1. 폴더 rename/move 감지 → bulkUpdatePathPrefix (폴더 + 하위 파일)
 * 2. 나머지 폴더 이벤트 처리 (create/delete)
 * 3+. 파일 타입별 rename/create/delete 처리
 */
export async function applyEvents(
  workspaceId: string,
  workspacePath: string,
  events: parcelWatcher.Event[]
): Promise<{
  folderPaths: string[]
  orphanPaths: Map<string, string[]>
}> {
  const changedFolderPaths: string[] = []
  const orphanPaths = new Map<string, string[]>(fileTypeConfigs.map((c) => [c.entityType, []]))

  // ─── Step 1: 폴더 rename/move 감지 ───────────────────────────
  const isFileEvent = (absPath: string): boolean =>
    fileTypeConfigs.some((c) => c.matchExtension(absPath))

  const nonFileDeletes = events.filter(
    (e) => e.type === 'delete' && !isFileEvent(e.path) && !path.basename(e.path).startsWith('.')
  )
  const nonFileCreates = events.filter(
    (e) => e.type === 'create' && !isFileEvent(e.path) && !path.basename(e.path).startsWith('.')
  )
  const pairedFolderDeletePaths = new Set<string>()
  const pairedFolderCreatePaths = new Set<string>()
  for (const createEvent of nonFileCreates) {
    const createParent = path.dirname(createEvent.path)
    const createBasename = path.basename(createEvent.path)
    const matchingDelete =
      nonFileDeletes.find(
        (d) => !pairedFolderDeletePaths.has(d.path) && path.dirname(d.path) === createParent
      ) ??
      nonFileDeletes.find(
        (d) => !pairedFolderDeletePaths.has(d.path) && path.basename(d.path) === createBasename
      )
    if (matchingDelete) {
      const oldRel = path.relative(workspacePath, matchingDelete.path).replace(/\\/g, '/')
      const newRel = path.relative(workspacePath, createEvent.path).replace(/\\/g, '/')
      const existingFolder = folderRepository.findByRelativePath(workspaceId, oldRel)
      if (existingFolder) {
        folderRepository.bulkUpdatePathPrefix(workspaceId, oldRel, newRel)
        for (const config of fileTypeConfigs) {
          config.repository.bulkUpdatePathPrefix(workspaceId, oldRel, newRel)
        }
        pairedFolderDeletePaths.add(matchingDelete.path)
        pairedFolderCreatePaths.add(createEvent.path)
        changedFolderPaths.push(newRel)
      }
    }
  }

  // ─── Step 2: 나머지 폴더 이벤트 처리 (create / delete) ───────
  for (const event of events) {
    const absPath = event.path
    const rel = path.relative(workspacePath, absPath).replace(/\\/g, '/')
    const basename = path.basename(absPath)

    if (isFileEvent(absPath)) continue
    if (pairedFolderDeletePaths.has(absPath) || pairedFolderCreatePaths.has(absPath)) continue

    // getEventsSince rename + oldPath (플랫폼 의존적)
    if (
      'oldPath' in event &&
      typeof (event as unknown as { oldPath: string }).oldPath === 'string'
    ) {
      const oldRel = path
        .relative(workspacePath, (event as unknown as { oldPath: string }).oldPath)
        .replace(/\\/g, '/')
      folderRepository.bulkUpdatePathPrefix(workspaceId, oldRel, rel)
      for (const config of fileTypeConfigs) {
        config.repository.bulkUpdatePathPrefix(workspaceId, oldRel, rel)
      }
      changedFolderPaths.push(rel)
      continue
    }

    if (event.type === 'create') {
      try {
        const stat = await fs.promises.stat(absPath)
        if (!stat.isDirectory()) continue
      } catch {
        continue
      }
      if (basename.startsWith('.')) continue
      const existing = folderRepository.findByRelativePath(workspaceId, rel)
      if (!existing) {
        const now = new Date()
        folderRepository.create({
          id: nanoid(),
          workspaceId,
          relativePath: rel,
          color: null,
          order: 0,
          createdAt: now,
          updatedAt: now
        })
        changedFolderPaths.push(rel)
      }
      continue
    }

    if (event.type === 'delete') {
      const existing = folderRepository.findByRelativePath(workspaceId, rel)
      if (existing) {
        // 삭제 전 하위 파일 경로 수집 → changed 이벤트에 포함
        for (const config of fileTypeConfigs) {
          const children = config.repository
            .findByWorkspaceId(workspaceId)
            .filter((item) => item.relativePath.startsWith(rel + '/'))
          orphanPaths.get(config.entityType)!.push(...children.map((item) => item.relativePath))
          for (const child of children) {
            entityLinkRepository.removeAllByEntity(config.entityType, child.id)
          }
          config.repository.bulkDeleteByPrefix(workspaceId, rel)
        }
        folderRepository.bulkDeleteByPrefix(workspaceId, rel)
        changedFolderPaths.push(rel)
      }
      continue
    }
  }

  // ─── Steps 3+: 파일 타입별 rename/create/delete 처리 ────────
  for (const config of fileTypeConfigs) {
    await processFileTypeEvents(workspaceId, workspacePath, events, config)
  }

  return { folderPaths: changedFolderPaths, orphanPaths }
}

/**
 * 특정 파일 타입의 rename/create/delete 이벤트 처리
 */
async function processFileTypeEvents(
  workspaceId: string,
  workspacePath: string,
  events: parcelWatcher.Event[],
  config: FileTypeConfig
): Promise<void> {
  const filterEvent = (e: parcelWatcher.Event, type: 'create' | 'delete'): boolean => {
    if (e.type !== type || !config.matchExtension(e.path) || path.basename(e.path).startsWith('.'))
      return false
    if (config.skipFilter) {
      const rel = path.relative(workspacePath, e.path).replace(/\\/g, '/')
      return !config.skipFilter(rel)
    }
    return true
  }

  const deletes = events.filter((e) => filterEvent(e, 'delete'))
  const creates = events.filter((e) => filterEvent(e, 'create'))
  const pairedDeletePaths = new Set<string>()
  const pairedCreatePaths = new Set<string>()

  // rename/move 감지
  for (const createEvent of creates) {
    const createDir = path.dirname(createEvent.path)
    const createBasename = path.basename(createEvent.path)
    const matchingDelete =
      deletes.find((d) => !pairedDeletePaths.has(d.path) && path.dirname(d.path) === createDir) ??
      deletes.find(
        (d) => !pairedDeletePaths.has(d.path) && path.basename(d.path) === createBasename
      )
    if (matchingDelete) {
      const oldRel = path.relative(workspacePath, matchingDelete.path).replace(/\\/g, '/')
      const newRel = path.relative(workspacePath, createEvent.path).replace(/\\/g, '/')
      const existing = config.repository.findByRelativePath(workspaceId, oldRel)
      if (existing) {
        const newParentRel = newRel.includes('/') ? newRel.split('/').slice(0, -1).join('/') : null
        const newFolder = newParentRel
          ? folderRepository.findByRelativePath(workspaceId, newParentRel)
          : null
        config.repository.update(existing.id, {
          relativePath: newRel,
          folderId: newParentRel ? (newFolder?.id ?? existing.folderId) : null,
          title: config.extractTitle(createEvent.path),
          updatedAt: new Date()
        })
        pairedDeletePaths.add(matchingDelete.path)
        pairedCreatePaths.add(createEvent.path)
      }
    }
  }

  // standalone create
  for (const createEvent of creates) {
    if (pairedCreatePaths.has(createEvent.path)) continue
    const rel = path.relative(workspacePath, createEvent.path).replace(/\\/g, '/')
    const existing = config.repository.findByRelativePath(workspaceId, rel)
    if (!existing) {
      try {
        const stat = await fs.promises.stat(createEvent.path)
        if (!stat.isFile()) continue
      } catch {
        continue
      }
      const parentRel = rel.includes('/') ? rel.split('/').slice(0, -1).join('/') : null
      const folder = parentRel ? folderRepository.findByRelativePath(workspaceId, parentRel) : null
      const now = new Date()
      config.repository.create({
        id: nanoid(),
        workspaceId,
        relativePath: rel,
        folderId: folder?.id ?? null,
        title: config.extractTitle(createEvent.path),
        description: '',
        preview: '',
        order: 0,
        createdAt: now,
        updatedAt: now
      })
    }
  }

  // standalone delete
  for (const deleteEvent of deletes) {
    if (pairedDeletePaths.has(deleteEvent.path)) continue
    const rel = path.relative(workspacePath, deleteEvent.path).replace(/\\/g, '/')
    const existing = config.repository.findByRelativePath(workspaceId, rel)
    if (existing) {
      entityLinkRepository.removeAllByEntity(config.entityType, existing.id)
      config.repository.delete(existing.id)
    }
  }
}
