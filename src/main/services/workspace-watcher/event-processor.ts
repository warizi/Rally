import path from 'path'
import fs from 'fs'
import type * as parcelWatcher from '@parcel/watcher'
import { folderRepository } from '../../repositories/folder'
import { entityLinkRepository } from '../../repositories/entity-link'
import { nanoid } from 'nanoid'
import { fileTypeConfigs } from './file-type-config'
import type { FileTypeConfig } from './file-type-config'
import { USER_ACTOR } from '../_shared/actor'
import { readDirRecursiveAsync } from '../folder'

/**
 * 이벤트 배치 → DB 동기화
 *
 * 처리 순서 (순서 중요):
 * 1. 폴더 rename/move 감지 → bulkUpdatePathPrefix (폴더 + 하위 파일)
 * 2. 나머지 폴더 이벤트 처리 (create/delete)
 *    - create: 폴더 record 생성 + subtree 강제 재귀 스캔 (macOS FSEvents 등 일부
 *      FS watcher 는 외부에서 이동돼 들어오는 폴더의 내부 파일/서브폴더 이벤트를
 *      생략하므로, 직접 스캔으로 누락 없이 동기화 보장)
 * 3+. 파일 타입별 rename/create/delete 처리
 *
 * orphanPaths 는 broadcast 용 "이벤트 외 추가 변경된 경로" 컨테이너 —
 * 폴더 삭제로 함께 사라진 파일과 폴더 create 시 스캔으로 발견된 파일을 모두 포함.
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
        folderRepository.bulkUpdatePathPrefix(workspaceId, oldRel, newRel, USER_ACTOR)
        for (const config of fileTypeConfigs) {
          config.repository.bulkUpdatePathPrefix(workspaceId, oldRel, newRel, USER_ACTOR)
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
      folderRepository.bulkUpdatePathPrefix(workspaceId, oldRel, rel, USER_ACTOR)
      for (const config of fileTypeConfigs) {
        config.repository.bulkUpdatePathPrefix(workspaceId, oldRel, rel, USER_ACTOR)
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
      // 외부에서 이동돼 들어온 폴더의 내부 파일/서브폴더는 watcher 이벤트가 생략될 수
      // 있으므로 직접 재귀 스캔으로 보완. 이미 등록된 record 는 findByRelativePath 로 skip.
      await scanFolderSubtree(workspaceId, workspacePath, rel, changedFolderPaths, orphanPaths)
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

/**
 * 새로 등장한 폴더의 subtree 를 재귀 스캔해 누락된 폴더/파일 record 를 보완한다.
 *
 * macOS FSEvents 같은 일부 FS watcher 는 외부에서 한꺼번에 이동돼 들어오는 폴더의
 * 내부 파일·서브폴더 create 이벤트를 생략한다. 이 helper 는 그런 환경에서도 폴더가
 * 새로 인식될 때 내부를 강제로 스캔해 DB 와 FS 를 일관 유지한다.
 *
 * 이미 등록된 record 는 findByRelativePath 로 skip 되므로 중복 호출 안전.
 */
async function scanFolderSubtree(
  workspaceId: string,
  workspacePath: string,
  folderRel: string,
  changedFolderPaths: string[],
  orphanPaths: Map<string, string[]>
): Promise<void> {
  const now = new Date()

  const subDirs = await readDirRecursiveAsync(workspacePath, folderRel)
  for (const sub of subDirs) {
    const existing = folderRepository.findByRelativePath(workspaceId, sub.relativePath)
    if (existing) continue
    folderRepository.create({
      id: nanoid(),
      workspaceId,
      relativePath: sub.relativePath,
      color: null,
      order: 0,
      createdAt: now,
      updatedAt: now
    })
    changedFolderPaths.push(sub.relativePath)
  }

  for (const config of fileTypeConfigs) {
    const files = await config.readFilesAsync(workspacePath, folderRel)
    const collected = orphanPaths.get(config.entityType)!
    for (const f of files) {
      if (config.skipFilter?.(f.relativePath)) continue
      const existing = config.repository.findByRelativePath(workspaceId, f.relativePath)
      if (existing) continue
      const parentRel = f.relativePath.includes('/')
        ? f.relativePath.split('/').slice(0, -1).join('/')
        : null
      const folder = parentRel ? folderRepository.findByRelativePath(workspaceId, parentRel) : null
      config.repository.create({
        id: nanoid(),
        workspaceId,
        relativePath: f.relativePath,
        folderId: folder?.id ?? null,
        title: config.extractTitle(f.name),
        description: '',
        preview: '',
        order: 0,
        createdAt: now,
        updatedAt: now
      })
      collected.push(f.relativePath)
    }
  }
}
