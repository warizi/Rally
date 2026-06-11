/**
 * workspace-watcher/event-processor 특성 테스트 (characterization).
 *
 * 목적: 파일시스템 보완 작업(0B~P4) 전 "변경 금지 계약"을 고정한다.
 * 계약 문서: Rally 노트 "워처 동작 계약 — 변경 금지 명세" (C2~C4)
 *
 * 고정하는 계약:
 *  - C2: rename/move 시 기존 레코드 ID 보존 (repository.update — 링크·태그 유지의 근거)
 *  - C3: 폴더 create → 레코드 생성 + subtree 강제 스캔 / 폴더 delete → 하위 정리 + 링크 제거
 *  - C4: 숨김 파일(leaf dotfile) 무시, skipFilter 경로 제외
 *
 * 의도적으로 고정하지 않는 것 (개정 예정 — 버그):
 *  - 같은 부모의 무관한 delete+create 쌍이 rename으로 오매칭되는 greedy 동작 (R-04, P3에서 수정)
 *  - rename으로 판정된 폴더 create의 subtree 스캔 생략 (R-04, P3에서 수정)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type * as parcelWatcher from '@parcel/watcher'

const { statMock, nanoidMock, folderRepoMocks, entityLinkRepoMocks, readDirAsyncMock, noteRepoMocks, noteReadFilesMock } =
  vi.hoisted(() => ({
    statMock: vi.fn(),
    nanoidMock: vi.fn(() => 'id-new-0001'),
    folderRepoMocks: {
      findByRelativePath: vi.fn(),
      findByIdentity: vi.fn(),
      findByWorkspaceId: vi.fn((): Array<{ id: string; relativePath: string }> => []),
      create: vi.fn(),
      createMany: vi.fn(),
      bulkUpdatePathPrefix: vi.fn(),
      bulkDeleteByPrefix: vi.fn(),
      deleteOrphans: vi.fn()
    },
    entityLinkRepoMocks: {
      removeAllByEntity: vi.fn()
    },
    readDirAsyncMock: vi.fn(
      async (): Promise<Array<{ name: string; relativePath: string }>> => []
    ),
    noteRepoMocks: {
      findByRelativePath: vi.fn(),
      findByIdentity: vi.fn(),
      findByWorkspaceId: vi.fn(
        (): Array<{ id: string; relativePath: string; folderId: string | null }> => []
      ),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      bulkUpdatePathPrefix: vi.fn(),
      bulkDeleteByPrefix: vi.fn(),
      deleteOrphans: vi.fn()
    },
    noteReadFilesMock: vi.fn(
      async (): Promise<Array<{ name: string; relativePath: string }>> => []
    )
  }))

// R-09(P1): event-processor 는 lstat 을 사용한다 (symlink 미추적 — 스캔 규칙과 통일)
vi.mock('fs', () => ({
  default: { promises: { lstat: statMock } },
  promises: { lstat: statMock }
}))
vi.mock('nanoid', () => ({ nanoid: nanoidMock }))
vi.mock('../../../repositories/folder', () => ({
  folderRepository: folderRepoMocks
}))
vi.mock('../../../repositories/entity-link', () => ({
  entityLinkRepository: entityLinkRepoMocks
}))
vi.mock('../../folder', () => ({
  readDirRecursiveAsync: readDirAsyncMock
}))
vi.mock('../file-type-config', () => ({
  fileTypeConfigs: [
    {
      matchExtension: (n: string) => n.endsWith('.md'),
      extractTitle: (n: string) => n.replace(/^.*\//, '').replace(/\.md$/, ''),
      repository: noteRepoMocks,
      channelName: 'note:changed',
      entityType: 'note',
      skipFilter: (rel: string) => rel.startsWith('.images/') || rel.includes('/.images/'),
      readFilesAsync: noteReadFilesMock
    }
  ]
}))

import { applyEvents } from '../event-processor'

const WS = 'ws-test0001'
const ROOT = '/ws'

function ev(type: 'create' | 'update' | 'delete', path: string): parcelWatcher.Event {
  return { type, path } as parcelWatcher.Event
}

const dirStat = { isDirectory: () => true, isFile: () => false }
const fileStat = { isDirectory: () => false, isFile: () => true }

beforeEach(() => {
  vi.clearAllMocks()
  folderRepoMocks.findByWorkspaceId.mockReturnValue([])
  noteRepoMocks.findByWorkspaceId.mockReturnValue([])
  readDirAsyncMock.mockResolvedValue([])
  noteReadFilesMock.mockResolvedValue([])
})

// ─── C2: 폴더 rename/move — ID 보존(경로 일괄 갱신) ─────────────

describe('applyEvents — 폴더 rename/move (C2)', () => {
  it('같은 부모의 delete+create 쌍 + 기존 폴더 존재 → bulkUpdatePathPrefix (폴더·파일 모두)', async () => {
    statMock.mockResolvedValue(dirStat)
    folderRepoMocks.findByRelativePath.mockImplementation((_ws, rel) =>
      rel === 'old-name' ? { id: 'fold-1', relativePath: 'old-name' } : undefined
    )

    const { folderPaths } = await applyEvents(WS, ROOT, [
      ev('delete', `${ROOT}/old-name`),
      ev('create', `${ROOT}/new-name`)
    ])

    expect(folderRepoMocks.bulkUpdatePathPrefix).toHaveBeenCalledWith(
      WS,
      'old-name',
      'new-name',
      expect.objectContaining({ kind: 'user' })
    )
    expect(noteRepoMocks.bulkUpdatePathPrefix).toHaveBeenCalledWith(
      WS,
      'old-name',
      'new-name',
      expect.anything()
    )
    // rename 처리 — 새 폴더 레코드를 만들지 않는다 (ID 보존)
    expect(folderRepoMocks.create).not.toHaveBeenCalled()
    expect(folderPaths).toContain('new-name')
  })

  it('다른 부모 + 같은 basename (이동) → bulkUpdatePathPrefix', async () => {
    statMock.mockResolvedValue(dirStat)
    folderRepoMocks.findByRelativePath.mockImplementation((_ws, rel) =>
      rel === 'a/sub' ? { id: 'fold-1', relativePath: 'a/sub' } : undefined
    )

    await applyEvents(WS, ROOT, [ev('delete', `${ROOT}/a/sub`), ev('create', `${ROOT}/b/sub`)])

    expect(folderRepoMocks.bulkUpdatePathPrefix).toHaveBeenCalledWith(
      WS,
      'a/sub',
      'b/sub',
      expect.anything()
    )
    expect(folderRepoMocks.create).not.toHaveBeenCalled()
  })

  it('DB에 없는 폴더의 delete+create 쌍 → rename 아님 (create는 신규 등록 경로로)', async () => {
    folderRepoMocks.findByRelativePath.mockReturnValue(undefined)
    statMock.mockResolvedValue(dirStat)

    await applyEvents(WS, ROOT, [ev('delete', `${ROOT}/ghost`), ev('create', `${ROOT}/fresh`)])

    expect(folderRepoMocks.bulkUpdatePathPrefix).not.toHaveBeenCalled()
    expect(folderRepoMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ relativePath: 'fresh', workspaceId: WS })
    )
  })
})

// ─── C3: 폴더 create — 레코드 생성 + subtree 스캔 ────────────────

describe('applyEvents — 폴더 create (C3)', () => {
  it('단독 create → folder 레코드 생성 + subtree 스캔(폴더·파일) 수행', async () => {
    statMock.mockResolvedValue(dirStat)
    folderRepoMocks.findByRelativePath.mockReturnValue(undefined)
    noteRepoMocks.findByRelativePath.mockReturnValue(undefined)
    readDirAsyncMock.mockResolvedValue([{ name: 'inner', relativePath: 'incoming/inner' }])
    noteReadFilesMock.mockResolvedValue([
      { name: 'doc.md', relativePath: 'incoming/inner/doc.md' }
    ])

    const { folderPaths, orphanPaths } = await applyEvents(WS, ROOT, [
      ev('create', `${ROOT}/incoming`)
    ])

    // 폴더 본체 + 스캔으로 발견된 서브폴더
    expect(folderRepoMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ relativePath: 'incoming' })
    )
    expect(folderRepoMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ relativePath: 'incoming/inner' })
    )
    // 스캔으로 발견된 내부 파일 등록 + broadcast 경로(orphanPaths)에 포함
    expect(noteRepoMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ relativePath: 'incoming/inner/doc.md', title: 'doc' })
    )
    expect(orphanPaths.get('note')).toContain('incoming/inner/doc.md')
    expect(folderPaths).toContain('incoming')
    expect(folderPaths).toContain('incoming/inner')
  })

  it('이미 등록된 폴더의 create 이벤트 → 레코드 중복 생성 없음, subtree 스캔은 수행', async () => {
    statMock.mockResolvedValue(dirStat)
    folderRepoMocks.findByRelativePath.mockReturnValue({ id: 'fold-1', relativePath: 'exists' })

    await applyEvents(WS, ROOT, [ev('create', `${ROOT}/exists`)])

    expect(folderRepoMocks.create).not.toHaveBeenCalled()
    expect(readDirAsyncMock).toHaveBeenCalledWith(ROOT, 'exists')
  })

  it('stat 실패(이미 사라진 경로) → 무시하고 throw 없음', async () => {
    statMock.mockRejectedValue(new Error('ENOENT'))
    folderRepoMocks.findByRelativePath.mockReturnValue(undefined)

    await expect(applyEvents(WS, ROOT, [ev('create', `${ROOT}/vanished`)])).resolves.toBeDefined()
    expect(folderRepoMocks.create).not.toHaveBeenCalled()
  })
})

// ─── C3: 폴더 delete — 하위 정리 + 링크 제거 ────────────────────

describe('applyEvents — 폴더 delete (C3)', () => {
  it('등록된 폴더 delete → 하위 파일 링크 제거 + prefix 일괄 삭제 + orphanPaths 수집', async () => {
    statMock.mockRejectedValue(new Error('ENOENT')) // 경로가 실제로 사라짐 = 진짜 삭제
    folderRepoMocks.findByRelativePath.mockImplementation((_ws, rel) =>
      rel === 'gone' ? { id: 'fold-1', relativePath: 'gone' } : undefined
    )
    noteRepoMocks.findByWorkspaceId.mockReturnValue([
      { id: 'note-1', relativePath: 'gone/a.md', folderId: 'fold-1' },
      { id: 'note-2', relativePath: 'kept/b.md', folderId: 'fold-2' }
    ])

    const { folderPaths, orphanPaths } = await applyEvents(WS, ROOT, [
      ev('delete', `${ROOT}/gone`)
    ])

    expect(entityLinkRepoMocks.removeAllByEntity).toHaveBeenCalledWith('note', 'note-1')
    expect(entityLinkRepoMocks.removeAllByEntity).not.toHaveBeenCalledWith('note', 'note-2')
    expect(noteRepoMocks.bulkDeleteByPrefix).toHaveBeenCalledWith(WS, 'gone')
    expect(folderRepoMocks.bulkDeleteByPrefix).toHaveBeenCalledWith(WS, 'gone')
    expect(orphanPaths.get('note')).toContain('gone/a.md')
    expect(folderPaths).toContain('gone')
  })

  it('DB에 없는 폴더 delete → no-op', async () => {
    statMock.mockRejectedValue(new Error('ENOENT'))
    folderRepoMocks.findByRelativePath.mockReturnValue(undefined)

    await applyEvents(WS, ROOT, [ev('delete', `${ROOT}/unknown`)])

    expect(folderRepoMocks.bulkDeleteByPrefix).not.toHaveBeenCalled()
    expect(noteRepoMocks.bulkDeleteByPrefix).not.toHaveBeenCalled()
  })
})

// ─── C2: 파일 rename — ID 보존 ──────────────────────────────────

describe('applyEvents — 파일 rename (C2)', () => {
  it('같은 폴더 내 rename → 기존 레코드 update (ID 보존), create/delete 아님', async () => {
    statMock.mockResolvedValue(fileStat)
    noteRepoMocks.findByRelativePath.mockImplementation((_ws, rel) =>
      rel === 'docs/old.md' ? { id: 'note-1', relativePath: 'docs/old.md', folderId: 'fold-1' } : undefined
    )
    folderRepoMocks.findByRelativePath.mockReturnValue({ id: 'fold-1', relativePath: 'docs' })

    await applyEvents(WS, ROOT, [
      ev('delete', `${ROOT}/docs/old.md`),
      ev('create', `${ROOT}/docs/new.md`)
    ])

    expect(noteRepoMocks.update).toHaveBeenCalledWith(
      'note-1',
      expect.objectContaining({ relativePath: 'docs/new.md', title: 'new', folderId: 'fold-1' })
    )
    expect(noteRepoMocks.create).not.toHaveBeenCalled()
    expect(noteRepoMocks.delete).not.toHaveBeenCalled()
    expect(entityLinkRepoMocks.removeAllByEntity).not.toHaveBeenCalled()
  })

  it('폴더 간 이동(basename 일치) → update로 folderId·relativePath 갱신, ID 보존', async () => {
    statMock.mockResolvedValue(fileStat)
    noteRepoMocks.findByRelativePath.mockImplementation((_ws, rel) =>
      rel === 'a/memo.md' ? { id: 'note-1', relativePath: 'a/memo.md', folderId: 'fold-a' } : undefined
    )
    folderRepoMocks.findByRelativePath.mockImplementation((_ws, rel) =>
      rel === 'b' ? { id: 'fold-b', relativePath: 'b' } : undefined
    )

    await applyEvents(WS, ROOT, [
      ev('delete', `${ROOT}/a/memo.md`),
      ev('create', `${ROOT}/b/memo.md`)
    ])

    expect(noteRepoMocks.update).toHaveBeenCalledWith(
      'note-1',
      expect.objectContaining({ relativePath: 'b/memo.md', folderId: 'fold-b' })
    )
    expect(noteRepoMocks.delete).not.toHaveBeenCalled()
  })
})

// ─── 파일 단독 create / delete ──────────────────────────────────

describe('applyEvents — 파일 create/delete', () => {
  it('단독 create → repo.create + parent folderId 매핑', async () => {
    statMock.mockResolvedValue(fileStat)
    noteRepoMocks.findByRelativePath.mockReturnValue(undefined)
    folderRepoMocks.findByRelativePath.mockImplementation((_ws, rel) =>
      rel === 'docs' ? { id: 'fold-1', relativePath: 'docs' } : undefined
    )

    await applyEvents(WS, ROOT, [ev('create', `${ROOT}/docs/fresh.md`)])

    expect(noteRepoMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        relativePath: 'docs/fresh.md',
        folderId: 'fold-1',
        title: 'fresh',
        workspaceId: WS
      })
    )
  })

  it('이미 등록된 path의 create → 중복 생성 없음', async () => {
    statMock.mockResolvedValue(fileStat)
    noteRepoMocks.findByRelativePath.mockReturnValue({
      id: 'note-1',
      relativePath: 'dup.md',
      folderId: null
    })

    await applyEvents(WS, ROOT, [ev('create', `${ROOT}/dup.md`)])

    expect(noteRepoMocks.create).not.toHaveBeenCalled()
  })

  it('단독 delete → 링크 제거 + repo.delete', async () => {
    statMock.mockRejectedValue(new Error('ENOENT')) // 경로가 실제로 사라짐 = 진짜 삭제
    noteRepoMocks.findByRelativePath.mockImplementation((_ws, rel) =>
      rel === 'bye.md' ? { id: 'note-1', relativePath: 'bye.md', folderId: null } : undefined
    )

    await applyEvents(WS, ROOT, [ev('delete', `${ROOT}/bye.md`)])

    expect(entityLinkRepoMocks.removeAllByEntity).toHaveBeenCalledWith('note', 'note-1')
    expect(noteRepoMocks.delete).toHaveBeenCalledWith('note-1')
  })
})

// ─── C4: 필터 규칙 ──────────────────────────────────────────────

describe('applyEvents — 필터 (C4)', () => {
  it('숨김 파일(leaf dotfile) 이벤트 무시', async () => {
    await applyEvents(WS, ROOT, [
      ev('create', `${ROOT}/.DS_Store`),
      ev('delete', `${ROOT}/sub/.hidden.md`)
    ])

    expect(noteRepoMocks.create).not.toHaveBeenCalled()
    expect(noteRepoMocks.delete).not.toHaveBeenCalled()
    expect(folderRepoMocks.create).not.toHaveBeenCalled()
  })

  it('skipFilter 경로(.images/) 파일 이벤트 무시', async () => {
    statMock.mockResolvedValue(fileStat)
    noteRepoMocks.findByRelativePath.mockReturnValue(undefined)

    await applyEvents(WS, ROOT, [ev('create', `${ROOT}/note/.images/pic.md`)])

    // leaf 가 dotfile 이 아니어도 skipFilter 로 제외
    expect(noteRepoMocks.create).not.toHaveBeenCalled()
  })

  it('update 이벤트는 레코드 변경을 일으키지 않는다 (현 계약 — 브로드캐스트는 watcher-service 책임)', async () => {
    await applyEvents(WS, ROOT, [ev('update', `${ROOT}/existing.md`)])

    expect(noteRepoMocks.create).not.toHaveBeenCalled()
    expect(noteRepoMocks.update).not.toHaveBeenCalled()
    expect(noteRepoMocks.delete).not.toHaveBeenCalled()
  })
})

// ─── P3: ino 확정 매칭 (R-04 근본 해결) ─────────────────────────

describe('applyEvents — P3 ino 확정 매칭', () => {
  function bigintDirStat(ino: bigint): {
    isDirectory: () => boolean
    isFile: () => boolean
    ino: bigint
    dev: bigint
  } {
    return { isDirectory: () => true, isFile: () => false, ino, dev: 7n }
  }

  it('다중 폴더 동시 이동: 무관한 delete 가 섞여도 각 폴더가 ino 로 정확히 move 된다', async () => {
    // 시나리오: X/alpha → alpha, X/beta → beta 동시 이동 (같은 배치, 같은 부모 delete 2개)
    statMock.mockImplementation(async (absPath: string) =>
      absPath.endsWith('/alpha') ? bigintDirStat(100n) : bigintDirStat(200n)
    )
    folderRepoMocks.findByIdentity.mockImplementation((_ws, ino: string) => {
      if (ino === '100') return { id: 'fold-a', relativePath: 'x/alpha', ino: '100', dev: '7' }
      if (ino === '200') return { id: 'fold-b', relativePath: 'x/beta', ino: '200', dev: '7' }
      return undefined
    })

    await applyEvents(WS, ROOT, [
      ev('delete', `${ROOT}/x/alpha`),
      ev('delete', `${ROOT}/x/beta`),
      ev('create', `${ROOT}/alpha`),
      ev('create', `${ROOT}/beta`)
    ])

    // 각자 자기 자신의 옛 경로에서 새 경로로 — 오매칭 없음
    expect(folderRepoMocks.bulkUpdatePathPrefix).toHaveBeenCalledWith(
      WS,
      'x/alpha',
      'alpha',
      expect.anything()
    )
    expect(folderRepoMocks.bulkUpdatePathPrefix).toHaveBeenCalledWith(
      WS,
      'x/beta',
      'beta',
      expect.anything()
    )
    expect(folderRepoMocks.create).not.toHaveBeenCalled()
    // move 후 옛 경로 delete 는 조회 miss 로 no-op — 삭제 없음
    expect(folderRepoMocks.bulkDeleteByPrefix).not.toHaveBeenCalled()
  })

  it('move 로 판정된 폴더도 subtree 스캔을 수행한다 (스캔 생략 버그 제거)', async () => {
    statMock.mockResolvedValue(bigintDirStat(100n))
    folderRepoMocks.findByIdentity.mockReturnValue({
      id: 'fold-a',
      relativePath: 'old-place',
      ino: '100',
      dev: '7'
    })

    await applyEvents(WS, ROOT, [ev('create', `${ROOT}/new-place`)])

    expect(readDirAsyncMock).toHaveBeenCalledWith(ROOT, 'new-place')
  })

  it('파일 ino 매칭: 어디로 이동했든 update 로 ID 보존', async () => {
    statMock.mockResolvedValue({ isFile: () => true, isDirectory: () => false, ino: 9n, dev: 7n })
    noteRepoMocks.findByIdentity.mockReturnValue({
      id: 'note-1',
      relativePath: 'deep/old/메모.md',
      folderId: 'fold-x',
      ino: '9',
      dev: '7'
    })

    await applyEvents(WS, ROOT, [ev('create', `${ROOT}/relocated.md`)])

    expect(noteRepoMocks.update).toHaveBeenCalledWith(
      'note-1',
      expect.objectContaining({ relativePath: 'relocated.md', title: 'relocated' })
    )
    expect(noteRepoMocks.create).not.toHaveBeenCalled()
  })

  it('동명 덮어쓰기(replace): 같은 경로 delete+create → row 유지 + ino 갱신, 삭제 없음', async () => {
    statMock.mockResolvedValue({ isFile: () => true, isDirectory: () => false, ino: 2n, dev: 7n })
    noteRepoMocks.findByIdentity.mockReturnValue(undefined) // 새 파일의 ino 는 DB 에 없음
    noteRepoMocks.findByRelativePath.mockImplementation((_ws, rel) =>
      rel === 'doc.md' ? { id: 'note-1', relativePath: 'doc.md', folderId: null, ino: '1' } : undefined
    )

    await applyEvents(WS, ROOT, [ev('delete', `${ROOT}/doc.md`), ev('create', `${ROOT}/doc.md`)])

    // row 유지 (링크 보존) + 새 파일의 identity 로 갱신
    expect(noteRepoMocks.update).toHaveBeenCalledWith('note-1', { ino: '2', dev: '7' })
    expect(noteRepoMocks.delete).not.toHaveBeenCalled()
    expect(entityLinkRepoMocks.removeAllByEntity).not.toHaveBeenCalled()
    expect(noteRepoMocks.create).not.toHaveBeenCalled()
  })

  it('ino 없는 환경에서 모호한 다중 쌍 → rename 포기, delete+create 처리 (오매칭 방지)', async () => {
    // 같은 부모에서 delete 2개 + create 2개, basename 전부 불일치 — 어느 쌍인지 알 수 없음
    statMock.mockImplementation(async (absPath: string) => {
      if (absPath.endsWith('c.md') || absPath.endsWith('d.md')) return fileStat // ino 없음
      throw new Error('ENOENT') // 삭제된 경로는 디스크에 없음
    })
    noteRepoMocks.findByRelativePath.mockImplementation((_ws, rel) =>
      rel === 'a.md'
        ? { id: 'note-a', relativePath: 'a.md', folderId: null }
        : rel === 'b.md'
          ? { id: 'note-b', relativePath: 'b.md', folderId: null }
          : undefined
    )

    await applyEvents(WS, ROOT, [
      ev('delete', `${ROOT}/a.md`),
      ev('delete', `${ROOT}/b.md`),
      ev('create', `${ROOT}/c.md`),
      ev('create', `${ROOT}/d.md`)
    ])

    // 오매칭 rename 없음 — 신규 2건 생성, 기존 2건 삭제
    expect(noteRepoMocks.update).not.toHaveBeenCalled()
    expect(noteRepoMocks.create).toHaveBeenCalledTimes(2)
    expect(noteRepoMocks.delete).toHaveBeenCalledWith('note-a')
    expect(noteRepoMocks.delete).toHaveBeenCalledWith('note-b')
  })
})
