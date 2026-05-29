/**
 * workspace-watcher/reconciler 단위 테스트.
 *
 * 3 가지 핵심 분기:
 *  - syncOfflineChanges: snapshot 존재 + getEventsSince 성공 → applyEvents
 *  - syncOfflineChanges: snapshot 존재 + getEventsSince 실패 → fullReconciliation fallback
 *  - syncOfflineChanges: snapshot 없음 → fullReconciliation
 *
 * + reconcileFileType (insert + orphan cleanup) + getSnapshotPath path 빌드.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const {
  existsSyncMock,
  mkdirSyncMock,
  getEventsSinceMock,
  writeSnapshotMock,
  appGetPathMock,
  readDirAsyncMock,
  applyEventsMock,
  cleanupOrphansMock,
  nanoidMock,
  folderRepoMocks
} = vi.hoisted(() => ({
  existsSyncMock: vi.fn(),
  mkdirSyncMock: vi.fn(),
  getEventsSinceMock: vi.fn(),
  writeSnapshotMock: vi.fn(),
  appGetPathMock: vi.fn(() => '/userdata'),
  readDirAsyncMock: vi.fn(),
  applyEventsMock: vi.fn(),
  cleanupOrphansMock: vi.fn(),
  nanoidMock: vi.fn(() => 'id-aabbcc1'),
  folderRepoMocks: {
    findByWorkspaceId: vi.fn(),
    findByRelativePath: vi.fn(),
    createMany: vi.fn(),
    deleteOrphans: vi.fn()
  }
}))

vi.mock('fs', () => ({
  default: { existsSync: existsSyncMock, mkdirSync: mkdirSyncMock },
  existsSync: existsSyncMock,
  mkdirSync: mkdirSyncMock
}))
vi.mock('@parcel/watcher', () => ({
  getEventsSince: getEventsSinceMock,
  writeSnapshot: writeSnapshotMock
}))
vi.mock('electron', () => ({
  app: { getPath: appGetPathMock }
}))
vi.mock('nanoid', () => ({ nanoid: nanoidMock }))
vi.mock('../../../repositories/folder', () => ({
  folderRepository: folderRepoMocks
}))
vi.mock('../../folder', () => ({
  readDirRecursiveAsync: readDirAsyncMock
}))
vi.mock('../../../lib/orphan-cleanup', () => ({
  cleanupOrphansAndDelete: cleanupOrphansMock
}))
vi.mock('../event-processor', () => ({
  applyEvents: applyEventsMock
}))

import { syncOfflineChanges, reconcileFileType, getSnapshotPath } from '../reconciler'
import type { FileTypeConfig } from '../file-type-config'

beforeEach(() => {
  vi.clearAllMocks()
  folderRepoMocks.findByWorkspaceId.mockReturnValue([])
})

describe('getSnapshotPath', () => {
  it('userData / workspace-snapshots / <wsId>.snapshot 경로 + mkdir recursive', () => {
    const p = getSnapshotPath('ws-aabbcc12')
    expect(mkdirSyncMock).toHaveBeenCalledWith(expect.stringContaining('workspace-snapshots'), {
      recursive: true
    })
    expect(p).toContain('ws-aabbcc12.snapshot')
  })
})

describe('syncOfflineChanges', () => {
  it('snapshot 존재 + getEventsSince 성공 → applyEvents + writeSnapshot', async () => {
    existsSyncMock.mockReturnValue(true)
    getEventsSinceMock.mockResolvedValue([{ path: '/x.md', type: 'create' }])
    applyEventsMock.mockResolvedValue(undefined)
    writeSnapshotMock.mockResolvedValue(undefined)

    await syncOfflineChanges('ws-aabbcc12', '/ws/path')

    expect(getEventsSinceMock).toHaveBeenCalled()
    expect(applyEventsMock).toHaveBeenCalledWith('ws-aabbcc12', '/ws/path', [
      { path: '/x.md', type: 'create' }
    ])
    expect(writeSnapshotMock).toHaveBeenCalled()
  })

  it('snapshot 존재 + getEventsSince 실패 → fullReconciliation 호출 후 early return (applyEvents X)', async () => {
    existsSyncMock.mockReturnValue(true)
    getEventsSinceMock.mockRejectedValue(new Error('corrupted'))
    readDirAsyncMock.mockResolvedValue([{ relativePath: 'a.md', name: 'a.md' }])

    await syncOfflineChanges('ws-aabbcc12', '/ws/path')

    expect(readDirAsyncMock).toHaveBeenCalledWith('/ws/path', '')
    expect(applyEventsMock).not.toHaveBeenCalled()
    // writeSnapshot 도 호출되지 않음 (early return)
    expect(writeSnapshotMock).not.toHaveBeenCalled()
  })

  it('snapshot 없음 → fullReconciliation 만 호출', async () => {
    existsSyncMock.mockReturnValue(false)
    readDirAsyncMock.mockResolvedValue([])

    await syncOfflineChanges('ws-aabbcc12', '/ws/path')

    expect(getEventsSinceMock).not.toHaveBeenCalled()
    expect(readDirAsyncMock).toHaveBeenCalled()
    expect(folderRepoMocks.createMany).toHaveBeenCalled()
    expect(folderRepoMocks.deleteOrphans).toHaveBeenCalled()
  })

  it('writeSnapshot 실패해도 throw 없이 swallow', async () => {
    existsSyncMock.mockReturnValue(true)
    getEventsSinceMock.mockResolvedValue([])
    applyEventsMock.mockResolvedValue(undefined)
    writeSnapshotMock.mockRejectedValue(new Error('disk full'))

    await expect(syncOfflineChanges('ws-aabbcc12', '/ws/path')).resolves.toBeUndefined()
  })
})

describe('reconcileFileType', () => {
  function makeConfig(): FileTypeConfig {
    return {
      entityType: 'note',
      channelName: 'note:changed',
      extractTitle: (n: string) => n.replace(/\.md$/, ''),
      matchExtension: (n: string) => n.endsWith('.md'),
      readFilesAsync: vi.fn(),
      repository: {
        findByWorkspaceId: vi.fn(),
        findByRelativePath: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
        bulkDeleteByPrefix: vi.fn(),
        bulkUpdatePathPrefix: vi.fn(),
        createMany: vi.fn(),
        deleteOrphans: vi.fn(),
        update: vi.fn()
      }
    } as unknown as FileTypeConfig
  }

  it('FS 에 새 파일 있음 → repository.createMany + orphan cleanup', async () => {
    const cfg = makeConfig()
    vi.mocked(cfg.readFilesAsync).mockResolvedValue([
      { relativePath: 'new.md', name: 'new.md' },
      { relativePath: 'sub/dir.md', name: 'dir.md' }
    ])
    vi.mocked(cfg.repository.findByWorkspaceId)
      .mockReturnValueOnce([]) // 첫 호출: 기존 DB 비어있음 → 둘 다 insert 후보
      .mockReturnValue([]) // orphan 검사 시점 — 이미 createMany 호출됨

    await reconcileFileType('ws-aabbcc12', '/ws', cfg)

    expect(cfg.repository.createMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ relativePath: 'new.md', title: 'new' }),
        expect.objectContaining({ relativePath: 'sub/dir.md' })
      ])
    )
    expect(cleanupOrphansMock).toHaveBeenCalled()
  })

  it('DB 에만 있는 파일 → orphan 후보로 cleanupOrphansAndDelete 호출', async () => {
    const cfg = makeConfig()
    vi.mocked(cfg.readFilesAsync).mockResolvedValue([])
    vi.mocked(cfg.repository.findByWorkspaceId).mockReturnValue([
      { id: 'orphan-1', relativePath: 'gone.md', folderId: null }
    ])

    await reconcileFileType('ws-aabbcc12', '/ws', cfg)

    expect(cfg.repository.createMany).toHaveBeenCalledWith([])
    expect(cleanupOrphansMock).toHaveBeenCalledWith('note', ['orphan-1'], expect.any(Function))
  })

  it('parent folder 찾기 → folderId 매핑', async () => {
    const cfg = makeConfig()
    vi.mocked(cfg.readFilesAsync).mockResolvedValue([{ relativePath: 'subdir/x.md', name: 'x.md' }])
    vi.mocked(cfg.repository.findByWorkspaceId).mockReturnValue([])
    folderRepoMocks.findByRelativePath.mockReturnValue({
      id: 'fold-aabbcc',
      relativePath: 'subdir',
      workspaceId: 'ws-aabbcc12'
    })

    await reconcileFileType('ws-aabbcc12', '/ws', cfg)

    expect(folderRepoMocks.findByRelativePath).toHaveBeenCalledWith('ws-aabbcc12', 'subdir')
    expect(cfg.repository.createMany).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ folderId: 'fold-aabbcc' })])
    )
  })
})
