import fs from 'fs'
import * as parcelWatcher from '@parcel/watcher'
import { app } from 'electron'
import path from 'path'
import { folderRepository } from '../../repositories/folder'
import { cleanupOrphansAndDelete } from '../../lib/orphan-cleanup'
import { readDirRecursiveAsync } from '../folder'
import { nanoid } from 'nanoid'
import { fileTypeConfigs } from './file-type-config'
import type { FileTypeConfig } from './file-type-config'
import { applyEvents } from './event-processor'

export async function syncOfflineChanges(
  workspaceId: string,
  workspacePath: string
): Promise<void> {
  const snapshotPath = getSnapshotPath(workspaceId)
  let events: parcelWatcher.Event[] = []

  if (fs.existsSync(snapshotPath)) {
    try {
      events = await parcelWatcher.getEventsSince(workspacePath, snapshotPath)
    } catch {
      try {
        await fullReconciliation(workspaceId, workspacePath)
      } catch {
        /* ignore — watcher continues without initial sync */
      }
      return
    }
  } else {
    try {
      await fullReconciliation(workspaceId, workspacePath)
    } catch {
      /* ignore — watcher continues without initial sync */
    }
    return
  }

  await applyEvents(workspaceId, workspacePath, events)

  try {
    await parcelWatcher.writeSnapshot(workspacePath, snapshotPath)
  } catch {
    /* ignore */
  }
}

/**
 * 특정 파일 타입의 FS ↔ DB 동기화 (reconciliation)
 */
export async function reconcileFileType(
  workspaceId: string,
  workspacePath: string,
  config: FileTypeConfig
): Promise<void> {
  const fsEntries = await config.readFilesAsync(workspacePath, '')
  const fsPaths = fsEntries.map((e) => e.relativePath)

  const dbRows = config.repository.findByWorkspaceId(workspaceId)
  const dbPathSet = new Set(dbRows.map((r) => r.relativePath))

  const now = new Date()
  const toInsert = fsEntries
    .filter((e) => !dbPathSet.has(e.relativePath))
    .map((e) => {
      const parentRel = e.relativePath.includes('/')
        ? e.relativePath.split('/').slice(0, -1).join('/')
        : null
      const folder = parentRel ? folderRepository.findByRelativePath(workspaceId, parentRel) : null
      return {
        id: nanoid(),
        workspaceId,
        relativePath: e.relativePath,
        folderId: folder?.id ?? null,
        title: config.extractTitle(e.name),
        description: '',
        preview: '',
        order: 0,
        createdAt: now,
        updatedAt: now
      }
    })

  config.repository.createMany(toInsert)
  const fsPathSet = new Set(fsPaths)
  const orphanIds = config.repository
    .findByWorkspaceId(workspaceId)
    .filter((r) => !fsPathSet.has(r.relativePath))
    .map((r) => r.id)
  cleanupOrphansAndDelete(config.entityType, orphanIds, () =>
    config.repository.deleteOrphans(workspaceId, fsPaths)
  )
}

async function fullReconciliation(workspaceId: string, workspacePath: string): Promise<void> {
  const fsEntries = await readDirRecursiveAsync(workspacePath, '')
  const fsPaths = fsEntries.map((e) => e.relativePath)

  const dbFolders = folderRepository.findByWorkspaceId(workspaceId)
  const dbPathSet = new Set(dbFolders.map((f) => f.relativePath))

  const now = new Date()
  const toInsert = fsEntries
    .filter((e) => !dbPathSet.has(e.relativePath))
    .map((e) => ({
      id: nanoid(),
      workspaceId,
      relativePath: e.relativePath,
      color: null as null,
      order: 0,
      createdAt: now,
      updatedAt: now
    }))
  folderRepository.createMany(toInsert)
  folderRepository.deleteOrphans(workspaceId, fsPaths)
}

export function getSnapshotPath(workspaceId: string): string {
  const snapshotsDir = path.join(app.getPath('userData'), 'workspace-snapshots')
  fs.mkdirSync(snapshotsDir, { recursive: true })
  return path.join(snapshotsDir, `${workspaceId}.snapshot`)
}

export { fileTypeConfigs }
