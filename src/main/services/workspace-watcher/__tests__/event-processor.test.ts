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

vi.mock('fs', () => ({
  default: { promises: { stat: statMock } },
  promises: { stat: statMock }
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
    folderRepoMocks.findByRelativePath.mockReturnValue(undefined)

    await applyEvents(WS, ROOT, [ev('delete', `${ROOT}/unknown`)])

    expect(folderRepoMocks.bulkDeleteByPrefix).not.toHaveBeenCalled()
    expect(noteRepoMocks.bulkDeleteByPrefix).not.toHaveBeenCalled()
  })
})

// ─── C2: 파일 rename — ID 보존 ──────────────────────────────────

describe('applyEvents — 파일 rename (C2)', () => {
  it('같은 폴더 내 rename → 기존 레코드 update (ID 보존), create/delete 아님', async () => {
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
    noteRepoMocks.findByRelativePath.mockReturnValue({
      id: 'note-1',
      relativePath: 'dup.md',
      folderId: null
    })

    await applyEvents(WS, ROOT, [ev('create', `${ROOT}/dup.md`)])

    expect(noteRepoMocks.create).not.toHaveBeenCalled()
  })

  it('단독 delete → 링크 제거 + repo.delete', async () => {
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
