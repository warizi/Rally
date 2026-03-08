import { describe, expect, it, vi, beforeEach } from 'vitest'
import * as fs from 'fs'
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { noteRepository } from '../../repositories/note'

// ─── Mock 선언 ───────────────────────────────────────────────
// fs.promises.stat는 auto-mock 대상이 아니므로 factory로 명시 포함
vi.mock('fs', () => {
  const stat = vi.fn()
  const existsSync = vi.fn().mockReturnValue(false) // snapshot 없음 → fullReconciliation
  const mkdirSync = vi.fn()
  const mod = { existsSync, mkdirSync, promises: { stat } }
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
    readMdFilesRecursiveAsync: vi.fn().mockResolvedValue([])
  }
})

// ─── 테스트 대상 (mock 등록 후 import) ───────────────────────
// dynamic import로 mock이 적용된 모듈 로드
const { workspaceWatcher } = await import('../workspace-watcher')
const { applyEvents } = await import('../workspace-watcher/event-processor')

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

function insertFolder(id: string, relativePath: string): void {
  testDb
    .insert(schema.folders)
    .values({
      id,
      workspaceId: WS_ID,
      relativePath,
      color: null,
      order: 0,
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
const statMock = (): StatMock => fs.promises.stat as unknown as StatMock

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
