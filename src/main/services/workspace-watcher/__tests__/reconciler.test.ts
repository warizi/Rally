/**
 * workspace-watcher/reconciler 단위 테스트.
 *
 * P1 구조 (풀 reconcile 상시화):
 *  - syncOfflineChanges: 스냅샷 diff 이벤트 재생 fast-path 전용.
 *    스냅샷 없음/실패 시 아무것도 하지 않는다 — 풀 동기화는 reconcileWorkspace 책임.
 *  - reconcileWorkspace: 단일 패스 스캔으로 폴더+파일을 매 기동 동기화 (R-03 해소).
 *  - reconcileFileType: 단일 타입 자체 스캔 버전 (insert + NFC 보정 + orphan cleanup).
 *
 * 0B 세이프가드:
 *  - 스캔 부분 실패 시 orphan 삭제 보류 (R-02)
 *  - orphan 급감 시 디스크 실재 교차검증 후 보류 (R-01)
 *
 * P1 NFC (R-06): DB raw 가 NFD 여도 NFC 기준 동일 항목이면 update 로 ID 보존.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const {
  existsSyncMock,
  mkdirSyncMock,
  accessMock,
  lstatMock,
  getEventsSinceMock,
  writeSnapshotMock,
  appGetPathMock,
  applyEventsMock,
  cleanupOrphansMock,
  nanoidMock,
  scanMock,
  folderRepoMocks,
  noteCfgRepoMocks
} = vi.hoisted(() => ({
  existsSyncMock: vi.fn(),
  mkdirSyncMock: vi.fn(),
  accessMock: vi.fn(),
  lstatMock: vi.fn(),
  getEventsSinceMock: vi.fn(),
  writeSnapshotMock: vi.fn(),
  appGetPathMock: vi.fn(() => '/userdata'),
  applyEventsMock: vi.fn(),
  cleanupOrphansMock: vi.fn(),
  nanoidMock: vi.fn(() => 'id-aabbcc1'),
  scanMock: vi.fn(
    async (): Promise<{
      folders: Array<{ name: string; relativePath: string }>
      files: Array<{ name: string; relativePath: string }>
      errors: unknown[]
    }> => ({ folders: [], files: [], errors: [] })
  ),
  folderRepoMocks: {
    findByWorkspaceId: vi.fn((): Array<{ id: string; relativePath: string }> => []),
    findByRelativePath: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    deleteOrphans: vi.fn(),
    bulkUpdatePathPrefix: vi.fn(),
    bulkDeleteByPrefix: vi.fn()
  },
  noteCfgRepoMocks: {
    findByWorkspaceId: vi.fn(
      (): Array<{ id: string; relativePath: string; folderId: string | null }> => []
    ),
    findByRelativePath: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteOrphans: vi.fn(),
    bulkUpdatePathPrefix: vi.fn(),
    bulkDeleteByPrefix: vi.fn()
  }
}))

vi.mock('fs', () => ({
  default: {
    existsSync: existsSyncMock,
    mkdirSync: mkdirSyncMock,
    promises: { access: accessMock, lstat: lstatMock }
  },
  existsSync: existsSyncMock,
  mkdirSync: mkdirSyncMock,
  promises: { access: accessMock, lstat: lstatMock }
}))
vi.mock('../../../lib/logger', () => ({
  scoped: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  logger: {}
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
vi.mock('../../../lib/orphan-cleanup', () => ({
  cleanupOrphansAndDelete: cleanupOrphansMock
}))
vi.mock('../event-processor', () => ({
  applyEvents: applyEventsMock
}))
vi.mock('../../../lib/fs-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/fs-utils')>()
  return { ...actual, scanWorkspaceAsync: scanMock }
})
vi.mock('../file-type-config', () => ({
  fileTypeConfigs: [
    {
      matchExtension: (n: string) => n.endsWith('.md'),
      extractTitle: (n: string) => n.replace(/\.md$/, ''),
      repository: noteCfgRepoMocks,
      channelName: 'note:changed',
      entityType: 'note',
      readFilesAsync: vi.fn(async () => [])
    }
  ]
}))

import {
  syncOfflineChanges,
  reconcileFileType,
  reconcileWorkspace,
  getSnapshotPath
} from '../reconciler'
import type { FileTypeConfig } from '../file-type-config'

beforeEach(() => {
  vi.clearAllMocks()
  folderRepoMocks.findByWorkspaceId.mockReturnValue([])
  noteCfgRepoMocks.findByWorkspaceId.mockReturnValue([])
  scanMock.mockResolvedValue({ folders: [], files: [], errors: [] })
  lstatMock.mockRejectedValue(new Error('ENOENT')) // identity 미해석 (기본)
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

describe('syncOfflineChanges — 이벤트 재생 fast-path (P1)', () => {
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

  it('snapshot 존재 + getEventsSince 실패 → 이벤트 재생 생략 (풀 reconcile 이 보정 — R-19)', async () => {
    existsSyncMock.mockReturnValue(true)
    getEventsSinceMock.mockRejectedValue(new Error('corrupted'))

    await expect(syncOfflineChanges('ws-aabbcc12', '/ws/path')).resolves.toBeUndefined()

    expect(applyEventsMock).not.toHaveBeenCalled()
    expect(writeSnapshotMock).not.toHaveBeenCalled()
  })

  it('snapshot 없음 → 아무것도 하지 않음 (풀 동기화는 reconcileWorkspace 책임)', async () => {
    existsSyncMock.mockReturnValue(false)

    await syncOfflineChanges('ws-aabbcc12', '/ws/path')

    expect(getEventsSinceMock).not.toHaveBeenCalled()
    expect(applyEventsMock).not.toHaveBeenCalled()
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

  it('DB 에 이미 있는 path 는 insert 후보에서 제외 (기존 레코드·ID 보존)', async () => {
    const cfg = makeConfig()
    vi.mocked(cfg.readFilesAsync).mockResolvedValue([
      { relativePath: 'kept.md', name: 'kept.md' },
      { relativePath: 'fresh.md', name: 'fresh.md' }
    ])
    vi.mocked(cfg.repository.findByWorkspaceId).mockReturnValue([
      { id: 'note-kept', relativePath: 'kept.md', folderId: null }
    ])

    await reconcileFileType('ws-aabbcc12', '/ws', cfg)

    const inserted = vi.mocked(cfg.repository.createMany).mock.calls[0][0] as Array<{
      relativePath: string
    }>
    expect(inserted.map((r) => r.relativePath)).toEqual(['fresh.md'])
    // FS 에도 있는 kept.md 는 orphan 으로 분류되지 않는다
    expect(cleanupOrphansMock).toHaveBeenCalledWith('note', [], expect.any(Function))
  })

  it('NFC 자가 보정 (R-06): DB raw 가 NFD 면 update 로 경로만 통일 — ID 보존, 삭제 없음', async () => {
    const NFC = '한글노트.md'.normalize('NFC')
    const NFD = '한글노트.md'.normalize('NFD')
    expect(NFC).not.toBe(NFD) // 전제 확인

    const cfg = makeConfig()
    vi.mocked(cfg.readFilesAsync).mockResolvedValue([{ relativePath: NFC, name: NFC }])
    vi.mocked(cfg.repository.findByWorkspaceId).mockReturnValue([
      { id: 'note-nfd', relativePath: NFD, folderId: null }
    ])

    await reconcileFileType('ws-aabbcc12', '/ws', cfg)

    expect(cfg.repository.update).toHaveBeenCalledWith(
      'note-nfd',
      expect.objectContaining({ relativePath: NFC })
    )
    expect(vi.mocked(cfg.repository.createMany).mock.calls[0][0]).toEqual([])
    expect(cleanupOrphansMock).toHaveBeenCalledWith('note', [], expect.any(Function))
  })
})

// ── 0B 세이프가드: 스캔 실패·orphan 급감 시 삭제 보류 (R-01·R-02) ──

describe('reconcileFileType — 0B 삭제 세이프가드', () => {
  function makeGuardConfig(): FileTypeConfig {
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

  function rows(n: number): Array<{ id: string; relativePath: string; folderId: null }> {
    return Array.from({ length: n }, (_, i) => ({
      id: `note-${i}`,
      relativePath: `n${i}.md`,
      folderId: null
    }))
  }

  it('스캔 부분 실패(onError) → 신규 등록은 수행, orphan 삭제는 보류 (R-02)', async () => {
    const cfg = makeGuardConfig()
    vi.mocked(cfg.readFilesAsync).mockImplementation(async (_abs, _rel, onError) => {
      onError?.(new Error('EMFILE: too many open files'))
      return [{ relativePath: 'survivor.md', name: 'survivor.md' }]
    })
    vi.mocked(cfg.repository.findByWorkspaceId).mockReturnValue(rows(3))

    await reconcileFileType('ws-aabbcc12', '/ws', cfg)

    // 신규 등록은 정상 수행
    expect(cfg.repository.createMany).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ relativePath: 'survivor.md' })])
    )
    // 불완전한 스캔으로 orphan 을 판단하지 않는다 — 삭제 0건
    expect(cleanupOrphansMock).not.toHaveBeenCalled()
    expect(cfg.repository.deleteOrphans).not.toHaveBeenCalled()
  })

  it('orphan 급감(50%↑·10건↑) + 디스크 실재 → 삭제 보류 (R-01)', async () => {
    const cfg = makeGuardConfig()
    vi.mocked(cfg.readFilesAsync).mockResolvedValue([]) // 스캔 오류 없이 빈 결과
    vi.mocked(cfg.repository.findByWorkspaceId).mockReturnValue(rows(12))
    accessMock.mockResolvedValue(undefined) // 샘플 경로가 디스크에 실재

    await reconcileFileType('ws-aabbcc12', '/ws', cfg)

    expect(accessMock).toHaveBeenCalled()
    expect(cleanupOrphansMock).not.toHaveBeenCalled()
    expect(cfg.repository.deleteOrphans).not.toHaveBeenCalled()
  })

  it('orphan 급감이지만 디스크에도 실제로 없음 → 진짜 대량 삭제로 보고 진행', async () => {
    const cfg = makeGuardConfig()
    vi.mocked(cfg.readFilesAsync).mockResolvedValue([])
    vi.mocked(cfg.repository.findByWorkspaceId).mockReturnValue(rows(12))
    accessMock.mockRejectedValue(new Error('ENOENT'))

    await reconcileFileType('ws-aabbcc12', '/ws', cfg)

    expect(cleanupOrphansMock).toHaveBeenCalledWith(
      'note',
      rows(12).map((r) => r.id),
      expect.any(Function)
    )
  })

  it('소량 orphan(10건 미만)은 가드 없이 기존대로 진행', async () => {
    const cfg = makeGuardConfig()
    vi.mocked(cfg.readFilesAsync).mockResolvedValue([])
    vi.mocked(cfg.repository.findByWorkspaceId).mockReturnValue(rows(5))

    await reconcileFileType('ws-aabbcc12', '/ws', cfg)

    expect(accessMock).not.toHaveBeenCalled()
    expect(cleanupOrphansMock).toHaveBeenCalledWith(
      'note',
      rows(5).map((r) => r.id),
      expect.any(Function)
    )
  })
})

// ── P1: reconcileWorkspace — 매 기동 폴더+파일 단일 패스 동기화 ──

describe('reconcileWorkspace (P1 — R-03 해소)', () => {
  it('스캔 결과 기준으로 폴더 신규 등록 + orphan 삭제 + 파일 타입 동기화를 매번 수행한다', async () => {
    scanMock.mockResolvedValue({
      folders: [
        { name: 'kept', relativePath: 'kept' },
        { name: 'fresh', relativePath: 'kept/fresh' }
      ],
      files: [
        { name: 'doc.md', relativePath: 'kept/doc.md' },
        { name: 'pic.png', relativePath: 'kept/pic.png' } // matchExtension 불일치 → note 대상 아님
      ],
      errors: []
    })
    folderRepoMocks.findByWorkspaceId.mockReturnValue([
      { id: 'fold-kept', relativePath: 'kept' },
      { id: 'fold-gone', relativePath: 'gone' }
    ])

    await reconcileWorkspace('ws-aabbcc12', '/ws/path')

    // 신규 폴더만 insert (kept 는 기존)
    const inserted = folderRepoMocks.createMany.mock.calls[0][0] as Array<{
      relativePath: string
    }>
    expect(inserted.map((f) => f.relativePath)).toEqual(['kept/fresh'])
    // orphan 폴더는 스캔 경로 keep-list 로 삭제
    expect(folderRepoMocks.deleteOrphans).toHaveBeenCalledWith('ws-aabbcc12', [
      'kept',
      'kept/fresh'
    ])
    // 파일 타입 동기화 — md 만 note 대상
    const noteInserted = noteCfgRepoMocks.createMany.mock.calls[0][0] as Array<{
      relativePath: string
    }>
    expect(noteInserted.map((r) => r.relativePath)).toEqual(['kept/doc.md'])
  })

  it('폴더 NFC 자가 보정 (R-06): raw NFD row 는 update 로 ID 보존', async () => {
    const NFC = '한글폴더'.normalize('NFC')
    const NFD = '한글폴더'.normalize('NFD')
    scanMock.mockResolvedValue({
      folders: [{ name: NFC, relativePath: NFC }],
      files: [],
      errors: []
    })
    folderRepoMocks.findByWorkspaceId.mockReturnValue([{ id: 'fold-nfd', relativePath: NFD }])

    await reconcileWorkspace('ws-aabbcc12', '/ws/path')

    expect(folderRepoMocks.update).toHaveBeenCalledWith(
      'fold-nfd',
      expect.objectContaining({ relativePath: NFC })
    )
    expect(folderRepoMocks.createMany.mock.calls[0][0]).toEqual([])
    // NFC 보정된 row 는 orphan 아님
    expect(folderRepoMocks.deleteOrphans).toHaveBeenCalledWith('ws-aabbcc12', [NFC])
  })

  it('스캔 부분 실패 → 등록만 수행하고 폴더·파일 orphan 삭제 모두 보류 (R-02)', async () => {
    scanMock.mockResolvedValue({
      folders: [{ name: 'visible', relativePath: 'visible' }],
      files: [],
      errors: [new Error('EACCES: permission denied')]
    })
    folderRepoMocks.findByWorkspaceId.mockReturnValue([
      { id: 'fold-1', relativePath: 'hidden-by-error' }
    ])
    noteCfgRepoMocks.findByWorkspaceId.mockReturnValue([
      { id: 'note-1', relativePath: 'hidden-by-error/a.md', folderId: 'fold-1' }
    ])

    await reconcileWorkspace('ws-aabbcc12', '/ws/path')

    expect(folderRepoMocks.createMany).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ relativePath: 'visible' })])
    )
    expect(folderRepoMocks.deleteOrphans).not.toHaveBeenCalled()
    expect(cleanupOrphansMock).not.toHaveBeenCalled()
    expect(noteCfgRepoMocks.deleteOrphans).not.toHaveBeenCalled()
  })

  it('폴더 orphan 급감 + 디스크 실재 → 폴더 삭제 보류 (R-01)', async () => {
    scanMock.mockResolvedValue({ folders: [], files: [], errors: [] })
    folderRepoMocks.findByWorkspaceId.mockReturnValue(
      Array.from({ length: 12 }, (_, i) => ({ id: `fold-${i}`, relativePath: `f${i}` }))
    )
    accessMock.mockResolvedValue(undefined)

    await reconcileWorkspace('ws-aabbcc12', '/ws/path')

    expect(folderRepoMocks.deleteOrphans).not.toHaveBeenCalled()
  })
})

// ── P2: ino/dev identity backfill ──────────────────────────────

describe('identity backfill (P2)', () => {
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

  it('ino 없는 기존 row → lstat({bigint}) identity 로 update', async () => {
    const cfg = makeConfig()
    vi.mocked(cfg.readFilesAsync).mockResolvedValue([{ relativePath: 'a.md', name: 'a.md' }])
    vi.mocked(cfg.repository.findByWorkspaceId).mockReturnValue([
      { id: 'note-1', relativePath: 'a.md', folderId: null } // ino 미보유
    ])
    lstatMock.mockResolvedValue({ ino: 123n, dev: 9n })

    await reconcileFileType('ws-aabbcc12', '/ws', cfg)

    expect(lstatMock).toHaveBeenCalledWith(expect.stringContaining('a.md'), { bigint: true })
    expect(cfg.repository.update).toHaveBeenCalledWith('note-1', { ino: '123', dev: '9' })
  })

  it('신규 insert row 에 ino/dev 포함', async () => {
    const cfg = makeConfig()
    vi.mocked(cfg.readFilesAsync).mockResolvedValue([{ relativePath: 'new.md', name: 'new.md' }])
    vi.mocked(cfg.repository.findByWorkspaceId).mockReturnValue([])
    lstatMock.mockResolvedValue({ ino: 7n, dev: 1n })

    await reconcileFileType('ws-aabbcc12', '/ws', cfg)

    expect(cfg.repository.createMany).toHaveBeenCalledWith([
      expect.objectContaining({ relativePath: 'new.md', ino: '7', dev: '1' })
    ])
  })

  it('ino 이미 보유한 row 는 lstat 하지 않는다 (steady state 비용 0, rootDev 1회 제외)', async () => {
    const cfg = makeConfig()
    vi.mocked(cfg.readFilesAsync).mockResolvedValue([{ relativePath: 'a.md', name: 'a.md' }])
    vi.mocked(cfg.repository.findByWorkspaceId).mockReturnValue([
      { id: 'note-1', relativePath: 'a.md', folderId: null, ino: '123', dev: '9' }
    ])
    // rootDev 조회가 row 의 dev 와 일치해야 re-backfill 이 발동하지 않는다
    lstatMock.mockResolvedValue({ ino: 1n, dev: 9n })

    await reconcileFileType('ws-aabbcc12', '/ws', cfg)

    // 워크스페이스 루트 dev 확인 1회만 — 파일 단위 lstat 없음
    expect(lstatMock).toHaveBeenCalledTimes(1)
    expect(lstatMock).not.toHaveBeenCalledWith(expect.stringContaining('a.md'), expect.anything())
    expect(cfg.repository.update).not.toHaveBeenCalled()
  })

  it('P3 dev 가드: 볼륨 교체(rootDev 불일치) row 는 ino 가 있어도 re-backfill', async () => {
    const cfg = makeConfig()
    vi.mocked(cfg.readFilesAsync).mockResolvedValue([{ relativePath: 'a.md', name: 'a.md' }])
    vi.mocked(cfg.repository.findByWorkspaceId).mockReturnValue([
      { id: 'note-1', relativePath: 'a.md', folderId: null, ino: '123', dev: '99' } // 옛 볼륨
    ])
    lstatMock.mockResolvedValue({ ino: 777n, dev: 9n }) // 현재 볼륨

    await reconcileFileType('ws-aabbcc12', '/ws', cfg)

    expect(cfg.repository.update).toHaveBeenCalledWith('note-1', { ino: '777', dev: '9' })
  })

  it('P3 move 감지: path 미일치·(dev,ino) 일치 → update 로 ID 보존, insert/orphan 없음', async () => {
    const cfg = makeConfig()
    vi.mocked(cfg.readFilesAsync).mockResolvedValue([
      { relativePath: 'moved/here.md', name: 'here.md' }
    ])
    vi.mocked(cfg.repository.findByWorkspaceId).mockReturnValue([
      { id: 'note-1', relativePath: 'was/there.md', folderId: 'fold-x', ino: '55', dev: '9' }
    ])
    lstatMock.mockResolvedValue({ ino: 55n, dev: 9n })

    await reconcileFileType('ws-aabbcc12', '/ws', cfg)

    expect(cfg.repository.update).toHaveBeenCalledWith(
      'note-1',
      expect.objectContaining({ relativePath: 'moved/here.md', title: 'here' })
    )
    expect(vi.mocked(cfg.repository.createMany).mock.calls[0][0]).toEqual([])
    // move 로 매칭됐으므로 orphan 아님 — 삭제 0건
    expect(cleanupOrphansMock).toHaveBeenCalledWith('note', [], expect.any(Function))
  })

  it('lstat 실패(파일이 그새 사라짐) → identity 없이 insert, throw 없음', async () => {
    const cfg = makeConfig()
    vi.mocked(cfg.readFilesAsync).mockResolvedValue([{ relativePath: 'gone.md', name: 'gone.md' }])
    vi.mocked(cfg.repository.findByWorkspaceId).mockReturnValue([])
    lstatMock.mockRejectedValue(new Error('ENOENT'))

    await reconcileFileType('ws-aabbcc12', '/ws', cfg)

    expect(cfg.repository.createMany).toHaveBeenCalledWith([
      expect.objectContaining({ relativePath: 'gone.md', ino: null, dev: null })
    ])
  })

  it('reconcileWorkspace: 폴더 row 도 동일하게 backfill', async () => {
    scanMock.mockResolvedValue({
      folders: [{ name: 'docs', relativePath: 'docs' }],
      files: [],
      errors: []
    })
    folderRepoMocks.findByWorkspaceId.mockReturnValue([{ id: 'fold-1', relativePath: 'docs' }])
    lstatMock.mockResolvedValue({ ino: 55n, dev: 2n })

    await reconcileWorkspace('ws-aabbcc12', '/ws/path')

    expect(folderRepoMocks.update).toHaveBeenCalledWith('fold-1', { ino: '55', dev: '2' })
  })
})
