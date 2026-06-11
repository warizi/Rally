/**
 * workspace-watcher/watcher-service 특성 테스트 (characterization).
 *
 * 목적: 파일시스템 보완 작업(0B~P4) 전 "변경 금지 계약"을 고정한다.
 * 계약 문서: Rally 노트 "워처 동작 계약 — 변경 금지 명세" (C1·C5·C7)
 *
 * 고정하는 계약:
 *  - C1: 기동 완료 시 각 채널에 [] 브로드캐스트(전체 재조회 신호), 이벤트 배치 시
 *        해당 채널에 workspaceId + relPath('/' 구분) 페이로드
 *  - C5: recent-writes 에 등록된 path 는 재브로드캐스트하지 않음 / 전부 dedup 시 채널 생략
 *  - C7: applyEvents 예외가 외부로 전파되지 않고 watcher 가 유지됨
 *  - 50ms debounce 로 연속 이벤트가 한 배치로 합쳐짐
 *  - ensureWatching: 같은 workspace/path 면 no-op, 다르면 stop(스냅샷 기록) 후 재시작
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type * as parcelWatcher from '@parcel/watcher'

const {
  subscribeMock,
  writeSnapshotMock,
  unsubscribeMock,
  sendMock,
  syncOfflineChangesMock,
  reconcileFileTypeMock,
  getSnapshotPathMock,
  applyEventsMock,
  isRecentWriteMock
} = vi.hoisted(() => ({
  subscribeMock: vi.fn(),
  writeSnapshotMock: vi.fn(async () => undefined),
  unsubscribeMock: vi.fn(async () => undefined),
  sendMock: vi.fn(),
  syncOfflineChangesMock: vi.fn(async () => undefined),
  reconcileFileTypeMock: vi.fn(async () => undefined),
  getSnapshotPathMock: vi.fn(() => '/snap/ws.snapshot'),
  applyEventsMock: vi.fn(),
  isRecentWriteMock: vi.fn((_ws: string, _rel: string) => false)
}))

vi.mock('@parcel/watcher', () => ({
  subscribe: subscribeMock,
  writeSnapshot: writeSnapshotMock
}))
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => [{ webContents: { send: sendMock } }]
  }
}))
vi.mock('../reconciler', () => ({
  syncOfflineChanges: syncOfflineChangesMock,
  reconcileFileType: reconcileFileTypeMock,
  getSnapshotPath: getSnapshotPathMock
}))
vi.mock('../event-processor', () => ({
  applyEvents: applyEventsMock
}))
vi.mock('../../../lib/recent-writes', () => ({
  isRecentWrite: isRecentWriteMock
}))
vi.mock('../file-type-config', () => ({
  fileTypeConfigs: [
    {
      matchExtension: (n: string) => n.endsWith('.md'),
      extractTitle: (n: string) => n.replace(/\.md$/, ''),
      repository: {},
      channelName: 'note:changed',
      entityType: 'note',
      skipFilter: (rel: string) => rel.includes('/.images/') || rel.startsWith('.images/'),
      readFilesAsync: vi.fn(async () => [])
    }
  ]
}))

import { workspaceWatcher } from '../watcher-service'

const WS = 'ws-test0001'
const ROOT = '/ws'

type SubscribeCb = (err: Error | null, events: parcelWatcher.Event[]) => void

function emptyApplyResult(): { folderPaths: string[]; orphanPaths: Map<string, string[]> } {
  return { folderPaths: [], orphanPaths: new Map([['note', []]]) }
}

/** subscribe 가 콜백을 캡처하고 unsubscribe 핸들을 반환하도록 설정 */
function armSubscribe(): { getCb: () => SubscribeCb } {
  let captured: SubscribeCb | null = null
  subscribeMock.mockImplementation(async (_path: string, cb: SubscribeCb) => {
    captured = cb
    return { unsubscribe: unsubscribeMock }
  })
  return { getCb: () => captured! }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  isRecentWriteMock.mockReturnValue(false)
  applyEventsMock.mockResolvedValue(emptyApplyResult())
})

afterEach(async () => {
  vi.useRealTimers()
  await workspaceWatcher.stop()
})

describe('start — 초기 동기화 + 브로드캐스트 + subscribe (C1)', () => {
  it('syncOfflineChanges → reconcileFileType → 각 채널 [] 브로드캐스트 → subscribe 순서', async () => {
    armSubscribe()

    await workspaceWatcher.start(WS, ROOT)

    expect(syncOfflineChangesMock).toHaveBeenCalledWith(WS, ROOT)
    expect(reconcileFileTypeMock).toHaveBeenCalledTimes(1) // config 1개당 1회
    expect(sendMock).toHaveBeenCalledWith('folder:changed', WS, [])
    expect(sendMock).toHaveBeenCalledWith('note:changed', WS, [])
    expect(subscribeMock).toHaveBeenCalledWith(ROOT, expect.any(Function))
    expect(workspaceWatcher.getActiveWorkspaceId()).toBe(WS)
  })

  it('reconcileFileType 실패해도 watcher 는 시작된다 (C7)', async () => {
    armSubscribe()
    reconcileFileTypeMock.mockRejectedValue(new Error('scan fail'))

    await expect(workspaceWatcher.start(WS, ROOT)).resolves.toBeUndefined()
    expect(subscribeMock).toHaveBeenCalled()
    expect(workspaceWatcher.getActiveWorkspaceId()).toBe(WS)
  })

  it('subscribe 실패(접근 불가) → throw 없이 watcher 없이 진행 (C7)', async () => {
    subscribeMock.mockRejectedValue(new Error('EACCES'))

    await expect(workspaceWatcher.start(WS, ROOT)).resolves.toBeUndefined()
    expect(workspaceWatcher.getActiveWorkspaceId()).toBeNull()
  })
})

describe('ensureWatching — 전환 규칙', () => {
  it('같은 workspace/path → no-op (subscribe 재호출 없음)', async () => {
    armSubscribe()

    await workspaceWatcher.ensureWatching(WS, ROOT)
    await workspaceWatcher.ensureWatching(WS, ROOT)

    expect(subscribeMock).toHaveBeenCalledTimes(1)
  })

  it('다른 workspace → 기존 구독 해제 + 스냅샷 기록 후 재시작', async () => {
    armSubscribe()

    await workspaceWatcher.ensureWatching(WS, ROOT)
    await workspaceWatcher.ensureWatching('ws-other001', '/other')

    expect(unsubscribeMock).toHaveBeenCalledTimes(1)
    expect(writeSnapshotMock).toHaveBeenCalledWith(ROOT, '/snap/ws.snapshot')
    expect(subscribeMock).toHaveBeenCalledTimes(2)
    expect(workspaceWatcher.getActiveWorkspaceId()).toBe('ws-other001')
  })
})

describe('이벤트 배치 — 50ms debounce + 채널 페이로드 (C1)', () => {
  it('연속 콜백이 한 배치로 합쳐져 applyEvents 1회 호출', async () => {
    const { getCb } = armSubscribe()
    await workspaceWatcher.start(WS, ROOT)
    sendMock.mockClear()

    getCb()(null, [{ type: 'create', path: `${ROOT}/a.md` } as parcelWatcher.Event])
    getCb()(null, [{ type: 'create', path: `${ROOT}/b.md` } as parcelWatcher.Event])
    await vi.advanceTimersByTimeAsync(60)

    expect(applyEventsMock).toHaveBeenCalledTimes(1)
    expect(applyEventsMock).toHaveBeenCalledWith(WS, ROOT, [
      expect.objectContaining({ path: `${ROOT}/a.md` }),
      expect.objectContaining({ path: `${ROOT}/b.md` })
    ])
  })

  it('note:changed 에 workspaceId + relPath("/" 구분) 페이로드', async () => {
    const { getCb } = armSubscribe()
    await workspaceWatcher.start(WS, ROOT)
    sendMock.mockClear()

    getCb()(null, [{ type: 'update', path: `${ROOT}/docs/note.md` } as parcelWatcher.Event])
    await vi.advanceTimersByTimeAsync(60)

    expect(sendMock).toHaveBeenCalledWith('note:changed', WS, ['docs/note.md'])
  })

  it('dotfile·skipFilter 경로는 페이로드에서 제외', async () => {
    const { getCb } = armSubscribe()
    await workspaceWatcher.start(WS, ROOT)
    sendMock.mockClear()

    getCb()(null, [
      { type: 'update', path: `${ROOT}/.hidden.md` } as parcelWatcher.Event,
      { type: 'update', path: `${ROOT}/n/.images/x.md` } as parcelWatcher.Event,
      { type: 'update', path: `${ROOT}/ok.md` } as parcelWatcher.Event
    ])
    await vi.advanceTimersByTimeAsync(60)

    expect(sendMock).toHaveBeenCalledWith('note:changed', WS, ['ok.md'])
  })

  it('orphanPaths(폴더 삭제로 함께 사라진 파일)가 페이로드에 병합', async () => {
    const { getCb } = armSubscribe()
    await workspaceWatcher.start(WS, ROOT)
    sendMock.mockClear()
    applyEventsMock.mockResolvedValue({
      folderPaths: ['gone'],
      orphanPaths: new Map([['note', ['gone/a.md']]])
    })

    getCb()(null, [{ type: 'delete', path: `${ROOT}/gone` } as parcelWatcher.Event])
    await vi.advanceTimersByTimeAsync(60)

    expect(sendMock).toHaveBeenCalledWith('note:changed', WS, ['gone/a.md'])
    expect(sendMock).toHaveBeenCalledWith('folder:changed', WS, ['gone'])
  })
})

describe('recent-writes dedup (C5)', () => {
  it('등록된 path 는 페이로드에서 제외', async () => {
    const { getCb } = armSubscribe()
    await workspaceWatcher.start(WS, ROOT)
    sendMock.mockClear()
    isRecentWriteMock.mockImplementation((_ws: string, rel: string) => rel === 'mine.md')

    getCb()(null, [
      { type: 'update', path: `${ROOT}/mine.md` } as parcelWatcher.Event,
      { type: 'update', path: `${ROOT}/other.md` } as parcelWatcher.Event
    ])
    await vi.advanceTimersByTimeAsync(60)

    expect(sendMock).toHaveBeenCalledWith('note:changed', WS, ['other.md'])
  })

  it('전부 dedup 되면 해당 채널 브로드캐스트 생략', async () => {
    const { getCb } = armSubscribe()
    await workspaceWatcher.start(WS, ROOT)
    sendMock.mockClear()
    isRecentWriteMock.mockReturnValue(true)

    getCb()(null, [{ type: 'update', path: `${ROOT}/mine.md` } as parcelWatcher.Event])
    await vi.advanceTimersByTimeAsync(60)

    const noteCalls = sendMock.mock.calls.filter((c) => c[0] === 'note:changed')
    expect(noteCalls).toHaveLength(0)
  })
})

describe('장애 격리 (C7)', () => {
  it('applyEvents 예외 → 전파 없음, 다음 배치는 정상 처리', async () => {
    const { getCb } = armSubscribe()
    await workspaceWatcher.start(WS, ROOT)
    sendMock.mockClear()
    applyEventsMock.mockRejectedValueOnce(new Error('boom'))

    getCb()(null, [{ type: 'update', path: `${ROOT}/x.md` } as parcelWatcher.Event])
    await vi.advanceTimersByTimeAsync(60)

    // 실패 배치 — 브로드캐스트 생략, throw 없음
    expect(sendMock.mock.calls.filter((c) => c[0] === 'note:changed')).toHaveLength(0)

    applyEventsMock.mockResolvedValue(emptyApplyResult())
    getCb()(null, [{ type: 'update', path: `${ROOT}/y.md` } as parcelWatcher.Event])
    await vi.advanceTimersByTimeAsync(60)

    expect(sendMock).toHaveBeenCalledWith('note:changed', WS, ['y.md'])
  })

  it('subscribe 콜백에 err 전달 시 무시', async () => {
    const { getCb } = armSubscribe()
    await workspaceWatcher.start(WS, ROOT)

    getCb()(new Error('watcher error'), [])
    await vi.advanceTimersByTimeAsync(60)

    expect(applyEventsMock).not.toHaveBeenCalled()
  })
})

describe('stop — 구독 해제 + 스냅샷 기록', () => {
  it('unsubscribe + writeSnapshot(activePath, snapshotPath) + 상태 초기화', async () => {
    armSubscribe()
    await workspaceWatcher.start(WS, ROOT)

    await workspaceWatcher.stop()

    expect(unsubscribeMock).toHaveBeenCalledTimes(1)
    expect(writeSnapshotMock).toHaveBeenCalledWith(ROOT, '/snap/ws.snapshot')
    expect(workspaceWatcher.getActiveWorkspaceId()).toBeNull()
  })

  it('대기 중 debounce 배치는 stop 시 폐기', async () => {
    const { getCb } = armSubscribe()
    await workspaceWatcher.start(WS, ROOT)

    getCb()(null, [{ type: 'update', path: `${ROOT}/pending.md` } as parcelWatcher.Event])
    await workspaceWatcher.stop()
    await vi.advanceTimersByTimeAsync(120)

    expect(applyEventsMock).not.toHaveBeenCalled()
  })

  it('writeSnapshot 실패해도 throw 없음', async () => {
    armSubscribe()
    await workspaceWatcher.start(WS, ROOT)
    writeSnapshotMock.mockRejectedValueOnce(new Error('disk full'))

    await expect(workspaceWatcher.stop()).resolves.toBeUndefined()
  })
})
