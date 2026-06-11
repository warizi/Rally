import { describe, expect, it, vi, beforeEach } from 'vitest'
import * as fs from 'fs'
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { noteRepository } from '../../repositories/note'

// ─── Mock 선언 ───────────────────────────────────────────────
// fs.promises.lstat는 auto-mock 대상이 아니므로 factory로 명시 포함
// (P1/R-09: event-processor 가 stat 대신 lstat 사용)
vi.mock('fs', () => {
  const lstat = vi.fn()
  const access = vi.fn(async () => {
    throw new Error('ENOENT') // orphan 가드: 디스크에 없음 → 진짜 삭제로 판정
  })
  const existsSync = vi.fn().mockReturnValue(false) // snapshot 없음 → 이벤트 재생 생략
  const mkdirSync = vi.fn()
  const mod = { existsSync, mkdirSync, promises: { lstat, access } }
  return { ...mod, default: mod }
})

// parcelWatcher는 네이티브 바이너리 → stub으로 대체
vi.mock('@parcel/watcher', () => ({
  subscribe: vi.fn().mockResolvedValue({ unsubscribe: vi.fn() }),
  writeSnapshot: vi.fn().mockResolvedValue(undefined),
  getEventsSince: vi.fn().mockResolvedValue([])
}))

vi.mock('electron', () => ({
  app: { getPath: vi.fn().mockReturnValue('/tmp') },
  BrowserWindow: { getAllWindows: vi.fn().mockReturnValue([]) }
}))

// readDirRecursiveAsync / readMdFilesRecursiveAsync — 실제 fs 대신 stub
vi.mock('../folder', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../folder')>()
  return {
    ...actual,
    readDirRecursiveAsync: vi.fn().mockResolvedValue([])
  }
})

vi.mock('../../lib/fs-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/fs-utils')>()
  return {
    ...actual,
    scanWorkspaceAsync: vi.fn().mockResolvedValue({ folders: [], files: [], errors: [] }),
    readMdFilesRecursiveAsync: vi.fn().mockResolvedValue([]),
    readCsvFilesRecursiveAsync: vi.fn().mockResolvedValue([]),
    readPdfFilesRecursiveAsync: vi.fn().mockResolvedValue([]),
    readImageFilesRecursiveAsync: vi.fn().mockResolvedValue([])
  }
})

// ─── 테스트 대상 (mock 등록 후 import) ───────────────────────
// dynamic import로 mock이 적용된 모듈 로드
const { workspaceWatcher } = await import('../workspace-watcher')
const { applyEvents } = await import('../workspace-watcher/event-processor')
const { reconcileWorkspace } = await import('../workspace-watcher/reconciler')
const folderModule = await import('../folder')
const fsUtilsModule = await import('../../lib/fs-utils')
const { csvFileRepository } = await import('../../repositories/csv-file')
const { pdfFileRepository } = await import('../../repositories/pdf-file')
const { imageFileRepository } = await import('../../repositories/image-file')
const { folderRepository } = await import('../../repositories/folder')

// ─── 픽스처 헬퍼 ─────────────────────────────────────────────
const WS_ID = 'ws-test'
const WS_PATH = '/test/workspace'

function insertWorkspace(): void {
  testDb
    .insert(schema.workspaces)
    .values({
      id: WS_ID,
      name: 'Test',
      path: WS_PATH,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .onConflictDoNothing()
    .run()
}

function insertFolder(id: string, relativePath: string, ino: string | null = null): void {
  testDb
    .insert(schema.folders)
    .values({
      id,
      workspaceId: WS_ID,
      relativePath,
      color: null,
      order: 0,
      ino,
      dev: ino !== null ? '42' : null,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .onConflictDoNothing()
    .run()
}

function insertNote(id: string, relativePath: string, folderId: string | null = null): void {
  testDb
    .insert(schema.notes)
    .values({
      id,
      workspaceId: WS_ID,
      folderId,
      relativePath,
      title: relativePath.replace(/\.md$/, ''),
      description: '',
      preview: '',
      order: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .onConflictDoNothing()
    .run()
}

/** parcelWatcher.Event 생성 헬퍼 */
function makeEvent(
  type: 'create' | 'delete' | 'update',
  relPath: string
): { type: 'create' | 'delete' | 'update'; path: string } {
  return { type, path: `${WS_PATH}/${relPath}` }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const watcher = workspaceWatcher as any

// factory mock의 vi.fn()을 직접 조작하는 헬퍼
type StatMock = ReturnType<typeof vi.fn>
const statMock = (): StatMock => fs.promises.lstat as unknown as StatMock

beforeEach(() => {
  vi.clearAllMocks()
  insertWorkspace()
  // fs.promises.stat: 기본적으로 isFile() = true (standalone create 처리용)
  statMock().mockResolvedValue({
    isFile: () => true,
    isDirectory: () => false
  } as unknown as fs.Stats)
})

// ─── applyEvents: standalone MD create ───────────────────────
describe('applyEvents — standalone MD create', () => {
  it('새 .md 파일 create 이벤트 → DB에 note row가 추가된다', async () => {
    await applyEvents(WS_ID, WS_PATH, [makeEvent('create', 'new-note.md')])

    const note = noteRepository.findByRelativePath(WS_ID, 'new-note.md')
    expect(note).toBeDefined()
    expect(note?.title).toBe('new-note')
    expect(note?.folderId).toBeNull()
  })

  it('하위 폴더의 .md 파일 create — 폴더가 DB에 있으면 folderId 자동 연결', async () => {
    insertFolder('f-docs', 'docs')
    await applyEvents(WS_ID, WS_PATH, [makeEvent('create', 'docs/my-note.md')])

    const note = noteRepository.findByRelativePath(WS_ID, 'docs/my-note.md')
    expect(note).toBeDefined()
    expect(note?.folderId).toBe('f-docs')
  })

  it('이미 DB에 있는 경로는 중복 insert하지 않는다', async () => {
    insertNote('n-existing', 'exists.md')
    await applyEvents(WS_ID, WS_PATH, [makeEvent('create', 'exists.md')])

    const all = noteRepository.findByWorkspaceId(WS_ID)
    expect(all.filter((n) => n.relativePath === 'exists.md')).toHaveLength(1)
  })

  it('stat 실패 시 (이미 삭제된 파일) DB insert를 건너뛴다', async () => {
    statMock().mockRejectedValueOnce(new Error('ENOENT'))
    await applyEvents(WS_ID, WS_PATH, [makeEvent('create', 'ghost.md')])

    expect(noteRepository.findByRelativePath(WS_ID, 'ghost.md')).toBeUndefined()
  })
})

// ─── applyEvents: standalone MD delete ───────────────────────
describe('applyEvents — standalone MD delete', () => {
  it('.md 파일 delete 이벤트 → DB에서 note row가 삭제된다', async () => {
    insertNote('n1', 'to-delete.md')
    // 진짜 삭제 — 경로가 디스크에서 사라진 상태
    statMock().mockRejectedValue(new Error('ENOENT'))
    await applyEvents(WS_ID, WS_PATH, [makeEvent('delete', 'to-delete.md')])

    expect(noteRepository.findById('n1')).toBeUndefined()
  })

  it('DB에 없는 경로 delete 이벤트 → 에러 없이 무시된다', async () => {
    await expect(
      applyEvents(WS_ID, WS_PATH, [makeEvent('delete', 'ghost.md')])
    ).resolves.not.toThrow()
  })
})

// ─── applyEvents: MD rename (delete+create pair) ─────────────
describe('applyEvents — MD rename (delete+create pair)', () => {
  it('같은 디렉토리의 delete+create 쌍 → ID 보존, relativePath 변경', async () => {
    insertNote('n1', 'old-name.md')
    await applyEvents(WS_ID, WS_PATH, [
      makeEvent('delete', 'old-name.md'),
      makeEvent('create', 'new-name.md')
    ])

    const updated = noteRepository.findById('n1')
    expect(updated).toBeDefined()
    expect(updated?.relativePath).toBe('new-name.md')
    expect(updated?.title).toBe('new-name')
    // old path는 DB에 없어야 함
    expect(noteRepository.findByRelativePath(WS_ID, 'old-name.md')).toBeUndefined()
  })

  it('다른 폴더로 이동 (delete+create 쌍, 파일명 동일) → ID 보존, folderId 갱신', async () => {
    insertNote('n1', 'note.md')
    insertFolder('f-dest', 'dest')
    await applyEvents(WS_ID, WS_PATH, [
      makeEvent('delete', 'note.md'),
      makeEvent('create', 'dest/note.md')
    ])

    const updated = noteRepository.findById('n1')
    expect(updated?.relativePath).toBe('dest/note.md')
    expect(updated?.folderId).toBe('f-dest')
  })
})

// ─── handleEvents: pendingEvents 누적 ────────────────────────
describe('handleEvents — pendingEvents 누적', () => {
  it('50ms 내 다중 호출 → 모든 이벤트가 누적되어 한 번에 처리된다', async () => {
    vi.useFakeTimers()

    const events1 = [makeEvent('create', 'a.md')]
    const events2 = [makeEvent('create', 'b.md')]
    const events3 = [makeEvent('create', 'c.md')]

    watcher.handleEvents(WS_ID, WS_PATH, events1)
    watcher.handleEvents(WS_ID, WS_PATH, events2)
    watcher.handleEvents(WS_ID, WS_PATH, events3)

    // 타이머 실행 전: DB에 아직 아무것도 없음
    expect(noteRepository.findByWorkspaceId(WS_ID)).toHaveLength(0)

    // 50ms 경과 → 디바운스 실행
    await vi.runAllTimersAsync()

    // 3개 이벤트 모두 처리됨
    const notes = noteRepository.findByWorkspaceId(WS_ID)
    const paths = notes.map((n) => n.relativePath).sort()
    expect(paths).toEqual(['a.md', 'b.md', 'c.md'])

    vi.useRealTimers()
  })

  it('stop() 호출 시 pendingEvents가 초기화된다', () => {
    watcher.pendingEvents = [makeEvent('create', 'pending.md')]
    // stop()은 subscription unsubscribe도 시도하므로 subscription을 미리 null로 설정
    watcher.subscription = null
    watcher.activeWorkspacePath = null
    watcher.activeWorkspaceId = null
    watcher.stop()
    expect(watcher.pendingEvents).toHaveLength(0)
  })
})

// ─── applyEvents: 외부 폴더 이동 시 subtree 재귀 스캔 ─────────
// macOS FSEvents 등 일부 FS watcher 는 폴더가 한꺼번에 이동돼 들어올 때 최상위
// 폴더의 create 이벤트만 emit 하고 내부 파일/서브폴더 이벤트는 생략한다.
// event-processor 는 폴더 create 시 직접 subtree 를 스캔해 보완한다.
describe('applyEvents — 폴더 create 시 subtree 재귀 스캔', () => {
  beforeEach(() => {
    // 폴더 create 이벤트에 대해 stat.isDirectory() = true 반환
    statMock().mockResolvedValue({
      isFile: () => false,
      isDirectory: () => true
    } as unknown as fs.Stats)
  })

  it('Case A: 폴더 create + 내부 .md 파일 create 가 모두 emit 된 경우 — 중복 없이 처리', async () => {
    vi.mocked(folderModule.readDirRecursiveAsync).mockResolvedValue([])
    vi.mocked(fsUtilsModule.readMdFilesRecursiveAsync).mockResolvedValue([
      { name: 'note.md', relativePath: 'mybox/note.md' }
    ])
    // 파일 create 이벤트 처리할 때 stat.isFile()=true 가 필요하므로 동적 분기
    statMock().mockImplementation(async (absPath: string) => {
      if (absPath.endsWith('.md')) {
        return { isFile: () => true, isDirectory: () => false } as fs.Stats
      }
      return { isFile: () => false, isDirectory: () => true } as fs.Stats
    })

    await applyEvents(WS_ID, WS_PATH, [
      makeEvent('create', 'mybox'),
      makeEvent('create', 'mybox/note.md')
    ])

    const folders = folderRepository.findByWorkspaceId(WS_ID)
    expect(folders.map((f) => f.relativePath)).toContain('mybox')
    const notes = noteRepository.findByWorkspaceId(WS_ID)
    const noteRows = notes.filter((n) => n.relativePath === 'mybox/note.md')
    expect(noteRows).toHaveLength(1)
    expect(noteRows[0].folderId).toBe(folders.find((f) => f.relativePath === 'mybox')?.id)
  })

  it('Case B: 폴더 create 이벤트만 emit + 내부에 .md 파일 존재 — 스캔으로 보완 등록', async () => {
    vi.mocked(folderModule.readDirRecursiveAsync).mockResolvedValue([])
    vi.mocked(fsUtilsModule.readMdFilesRecursiveAsync).mockResolvedValue([
      { name: 'a.md', relativePath: 'mybox/a.md' },
      { name: 'b.md', relativePath: 'mybox/b.md' }
    ])

    await applyEvents(WS_ID, WS_PATH, [makeEvent('create', 'mybox')])

    const folder = folderRepository.findByRelativePath(WS_ID, 'mybox')
    expect(folder).toBeDefined()
    const notes = noteRepository
      .findByWorkspaceId(WS_ID)
      .filter((n) => n.relativePath.startsWith('mybox/'))
    expect(notes.map((n) => n.relativePath).sort()).toEqual(['mybox/a.md', 'mybox/b.md'])
    expect(notes.every((n) => n.folderId === folder?.id)).toBe(true)
  })

  it('Case C: 중첩 서브폴더 + 다양한 파일 타입 — folder/csv/pdf/image record 모두 생성', async () => {
    vi.mocked(folderModule.readDirRecursiveAsync).mockResolvedValue([
      { name: 'sub', relativePath: 'mybox/sub' }
    ])
    vi.mocked(fsUtilsModule.readMdFilesRecursiveAsync).mockResolvedValue([
      { name: 'note.md', relativePath: 'mybox/note.md' }
    ])
    vi.mocked(fsUtilsModule.readCsvFilesRecursiveAsync).mockResolvedValue([
      { name: 'data.csv', relativePath: 'mybox/sub/data.csv' }
    ])
    vi.mocked(fsUtilsModule.readPdfFilesRecursiveAsync).mockResolvedValue([
      { name: 'doc.pdf', relativePath: 'mybox/doc.pdf' }
    ])
    vi.mocked(fsUtilsModule.readImageFilesRecursiveAsync).mockResolvedValue([
      { name: 'pic.png', relativePath: 'mybox/sub/pic.png' }
    ])

    await applyEvents(WS_ID, WS_PATH, [makeEvent('create', 'mybox')])

    expect(folderRepository.findByRelativePath(WS_ID, 'mybox')).toBeDefined()
    expect(folderRepository.findByRelativePath(WS_ID, 'mybox/sub')).toBeDefined()
    expect(noteRepository.findByRelativePath(WS_ID, 'mybox/note.md')).toBeDefined()
    expect(csvFileRepository.findByRelativePath(WS_ID, 'mybox/sub/data.csv')).toBeDefined()
    expect(pdfFileRepository.findByRelativePath(WS_ID, 'mybox/doc.pdf')).toBeDefined()
    expect(imageFileRepository.findByRelativePath(WS_ID, 'mybox/sub/pic.png')).toBeDefined()

    // 서브폴더 내 파일의 folderId 는 해당 서브폴더 record 와 매칭
    const subFolder = folderRepository.findByRelativePath(WS_ID, 'mybox/sub')
    const csv = csvFileRepository.findByRelativePath(WS_ID, 'mybox/sub/data.csv')
    expect(csv?.folderId).toBe(subFolder?.id)
  })

  it('Case D: 스캔 시 이미 DB 에 등록된 파일은 중복 insert 안 함', async () => {
    insertFolder('f-mybox', 'mybox')
    insertNote('n-existing', 'mybox/already.md', 'f-mybox')

    vi.mocked(folderModule.readDirRecursiveAsync).mockResolvedValue([])
    vi.mocked(fsUtilsModule.readMdFilesRecursiveAsync).mockResolvedValue([
      { name: 'already.md', relativePath: 'mybox/already.md' },
      { name: 'new.md', relativePath: 'mybox/new.md' }
    ])

    // mybox 폴더는 이미 DB 에 있으므로 create 이벤트가 와도 폴더 record 신규 생성 안 함
    // 하지만 scan 은 여전히 돌면서 누락 파일 보완
    await applyEvents(WS_ID, WS_PATH, [makeEvent('create', 'mybox')])

    const all = noteRepository
      .findByWorkspaceId(WS_ID)
      .filter((n) => n.relativePath.startsWith('mybox/'))
    expect(all.map((n) => n.relativePath).sort()).toEqual(['mybox/already.md', 'mybox/new.md'])
    // 기존 record 의 id 유지 확인
    expect(noteRepository.findByRelativePath(WS_ID, 'mybox/already.md')?.id).toBe('n-existing')
  })
})

// ─── P3: ino 기반 move 확정 매칭 (실제 DB) ─────────────────────
describe('applyEvents — P3 ino 확정 매칭 (실제 DB)', () => {
  it('다중 폴더 동시 이동: 전부 ID 보존 + 내부 파일 경로 일괄 갱신 (증상 2 시나리오)', async () => {
    insertFolder('f-m1', 'stash/box1', '5001')
    insertFolder('f-m2', 'stash/box2', '5002')
    insertNote('n-in1', 'stash/box1/in.md', 'f-m1')
    insertNote('n-in2', 'stash/box2/in.md', 'f-m2')

    statMock().mockImplementation(async (absPath: string) => ({
      isFile: () => false,
      isDirectory: () => true,
      ino: absPath.endsWith('/box1') ? 5001n : 5002n,
      dev: 42n
    }))
    vi.mocked(folderModule.readDirRecursiveAsync).mockResolvedValue([])

    // 같은 부모의 delete 2 + create 2 — 기존 greedy 였으면 오매칭/스캔 생략 케이스
    await applyEvents(WS_ID, WS_PATH, [
      makeEvent('delete', 'stash/box1'),
      makeEvent('delete', 'stash/box2'),
      makeEvent('create', 'box1'),
      makeEvent('create', 'box2')
    ])

    // 폴더 ID 보존 + 경로 갱신
    expect(folderRepository.findByRelativePath(WS_ID, 'box1')?.id).toBe('f-m1')
    expect(folderRepository.findByRelativePath(WS_ID, 'box2')?.id).toBe('f-m2')
    // 내부 파일도 prefix 일괄 갱신, ID 보존 → 링크·태그가 따라온다
    expect(noteRepository.findById('n-in1')?.relativePath).toBe('box1/in.md')
    expect(noteRepository.findById('n-in2')?.relativePath).toBe('box2/in.md')
    // 옛 경로 row 없음 (신규 생성도 없음)
    expect(folderRepository.findByRelativePath(WS_ID, 'stash/box1')).toBeUndefined()
  })

  it('동명 덮어쓰기(replace): row 유지 + ino 갱신 — 링크 파괴 없음', async () => {
    insertNote('n-swap', 'swap.md')

    statMock().mockResolvedValue({
      isFile: () => true,
      isDirectory: () => false,
      ino: 6001n,
      dev: 42n
    })

    await applyEvents(WS_ID, WS_PATH, [
      makeEvent('delete', 'swap.md'),
      makeEvent('create', 'swap.md')
    ])

    const row = noteRepository.findById('n-swap')
    expect(row).toBeDefined() // 삭제되지 않음
    expect(row?.relativePath).toBe('swap.md')
    expect(row?.ino).toBe('6001') // 새 파일의 identity 로 갱신
  })

  it('시나리오 C 회귀: 폴더 replace 가 delete/create 배치 2개로 분리돼도 노트 row 보존', async () => {
    // QA 실패 사례 — Finder "바꾸기" 는 휴지통 이동(delete) + 들여오기(create) 두 FS
    // 작업이라 50ms debounce 를 넘어 배치가 분리될 수 있다. delete 처리 시점에 새
    // 폴더가 이미 실재하므로 row 를 삭제하면 안 된다.
    insertFolder('f-rep', 'repfold', '7001')
    insertNote('n-rep', 'repfold/B.md', 'f-rep')

    // 디스크에는 새 폴더·파일이 이미 자리잡은 상태 (lstat 성공)
    statMock().mockImplementation(async (absPath: string) =>
      absPath.endsWith('.md')
        ? { isFile: () => true, isDirectory: () => false, ino: 7102n, dev: 42n }
        : { isFile: () => false, isDirectory: () => true, ino: 7101n, dev: 42n }
    )
    vi.mocked(folderModule.readDirRecursiveAsync).mockResolvedValue([])
    vi.mocked(fsUtilsModule.readMdFilesRecursiveAsync).mockResolvedValue([
      { name: 'B.md', relativePath: 'repfold/B.md' }
    ])

    // 배치 1: delete 만 도착 — 경로 실재 → 삭제 보류
    await applyEvents(WS_ID, WS_PATH, [
      makeEvent('delete', 'repfold'),
      makeEvent('delete', 'repfold/B.md')
    ])
    expect(folderRepository.findById('f-rep')).toBeDefined()
    expect(noteRepository.findById('n-rep')).toBeDefined()

    // 배치 2: create 도착 — replace 판정, row 유지 + ino 갱신
    await applyEvents(WS_ID, WS_PATH, [
      makeEvent('create', 'repfold'),
      makeEvent('create', 'repfold/B.md')
    ])

    const folder = folderRepository.findById('f-rep')
    const note = noteRepository.findById('n-rep')
    expect(folder?.relativePath).toBe('repfold')
    expect(folder?.ino).toBe('7101') // 새 폴더의 identity
    expect(note?.relativePath).toBe('repfold/B.md')
    expect(note?.ino).toBe('7102') // 새 파일의 identity
    // 중복 row 없음
    const dupes = noteRepository
      .findByWorkspaceId(WS_ID)
      .filter((n) => n.relativePath === 'repfold/B.md')
    expect(dupes).toHaveLength(1)
  })
})

// ─── P2: reconcileWorkspace identity backfill (실제 DB) ────────
describe('reconcileWorkspace — ino/dev identity backfill (P2)', () => {
  it('ino 없는 기존 폴더·노트 row 와 신규 row 모두 identity 가 채워진다 (커버리지 100%)', async () => {
    insertFolder('f-docs2', 'docs2')
    insertNote('n-old2', 'docs2/old.md', 'f-docs2')

    vi.mocked(fsUtilsModule.scanWorkspaceAsync).mockResolvedValue({
      folders: [{ name: 'docs2', relativePath: 'docs2' }],
      files: [
        { name: 'old.md', relativePath: 'docs2/old.md' },
        { name: 'new.md', relativePath: 'docs2/new.md' }
      ],
      errors: []
    })
    let inoSeq = 1000n
    statMock().mockImplementation(async () => ({
      ino: inoSeq++,
      dev: 42n,
      isFile: () => true,
      isDirectory: () => false
    }))

    await reconcileWorkspace(WS_ID, WS_PATH)

    // 기존 row backfill — ID 보존 + identity 채움
    const folder = folderRepository.findByRelativePath(WS_ID, 'docs2')
    expect(folder?.id).toBe('f-docs2')
    expect(folder?.ino).not.toBeNull()
    expect(folder?.dev).toBe('42')

    const oldNote = noteRepository.findByRelativePath(WS_ID, 'docs2/old.md')
    expect(oldNote?.id).toBe('n-old2')
    expect(oldNote?.ino).not.toBeNull()

    // 신규 row 는 생성 시점부터 identity 보유
    const newNote = noteRepository.findByRelativePath(WS_ID, 'docs2/new.md')
    expect(newNote).toBeDefined()
    expect(newNote?.ino).not.toBeNull()
    expect(newNote?.dev).toBe('42')

    // 커버리지: docs2 범위의 모든 활성 row 가 ino 보유
    const rows = noteRepository
      .findByWorkspaceId(WS_ID)
      .filter((n) => n.relativePath.startsWith('docs2/'))
    expect(rows.every((r) => r.ino !== null)).toBe(true)
  })
})
