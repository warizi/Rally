/**
 * 잠금(isLocked) 가드 + toggleLock — service 단위 테스트.
 * - 잠금 시 차단 대상(content / title / folder / soft-delete) 은 LockedError throw
 * - 허용 대상 (csv columnWidths, canvas viewport) 은 통과
 * - toggleLock 은 가드 우회 (잠금 상태에서도 해제 가능)
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { canvasService } from '../canvas'
import { csvFileService } from '../csv-file'
import { canvasRepository } from '../../repositories/canvas'
import { csvFileRepository } from '../../repositories/csv-file'
import { workspaceRepository } from '../../repositories/workspace'
import { LockedError } from '../../lib/errors'

vi.mock('../../repositories/workspace', () => ({
  workspaceRepository: { findById: vi.fn() }
}))

vi.mock('../../repositories/canvas', () => ({
  canvasRepository: {
    findById: vi.fn(),
    update: vi.fn(),
    updateViewport: vi.fn(),
    delete: vi.fn()
  }
}))

vi.mock('../../repositories/csv-file', () => ({
  csvFileRepository: {
    findById: vi.fn(),
    findByWorkspaceId: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}))

vi.mock('../trash', () => ({
  trashService: { softRemove: vi.fn() }
}))

vi.mock('../item-tag', () => ({
  itemTagService: { removeByItem: vi.fn() }
}))

const MOCK_WS = {
  id: 'ws-1',
  name: 'T',
  path: '/t',
  createdAt: new Date(),
  updatedAt: new Date()
}

const LOCKED_CANVAS = {
  id: 'canvas-1',
  workspaceId: 'ws-1',
  title: 'C',
  description: '',
  viewportX: 0,
  viewportY: 0,
  viewportZoom: 1,
  isLocked: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'user' as const,
  createdById: null,
  updatedBy: 'user' as const,
  updatedById: null,
  deletedAt: null,
  trashBatchId: null
}

const LOCKED_CSV = {
  id: 'csv-1',
  workspaceId: 'ws-1',
  folderId: null,
  relativePath: 'test.csv',
  title: 'test',
  description: '',
  preview: '',
  columnWidths: null,
  order: 0,
  isLocked: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'user' as const,
  createdById: null,
  updatedBy: 'user' as const,
  updatedById: null,
  ino: null,
  dev: null,
  deletedAt: null,
  trashBatchId: null
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(workspaceRepository.findById).mockReturnValue(MOCK_WS)
})

// ─── canvas ─────────────────────────────────────────────────

describe('canvasService — 잠금 가드', () => {
  it('잠금된 canvas update 는 LockedError 를 throw 한다', () => {
    vi.mocked(canvasRepository.findById).mockReturnValue(LOCKED_CANVAS)
    expect(() => canvasService.update('canvas-1', { title: 'new' })).toThrow(LockedError)
  })

  it('잠금된 canvas soft remove 는 LockedError 를 throw 한다', () => {
    vi.mocked(canvasRepository.findById).mockReturnValue(LOCKED_CANVAS)
    expect(() => canvasService.remove('canvas-1')).toThrow(LockedError)
  })

  it('잠금된 canvas 도 viewport 갱신은 허용된다 (view 메타)', () => {
    vi.mocked(canvasRepository.findById).mockReturnValue(LOCKED_CANVAS)
    expect(() => canvasService.updateViewport('canvas-1', { x: 1, y: 2, zoom: 1.5 })).not.toThrow()
    expect(canvasRepository.updateViewport).toHaveBeenCalled()
  })

  it('잠금된 canvas 도 toggleLock 으로 해제할 수 있다 (가드 우회)', () => {
    vi.mocked(canvasRepository.findById).mockReturnValue(LOCKED_CANVAS)
    vi.mocked(canvasRepository.update).mockReturnValue({ ...LOCKED_CANVAS, isLocked: false })
    const result = canvasService.toggleLock('canvas-1', false)
    expect(result.isLocked).toBe(false)
    expect(canvasRepository.update).toHaveBeenCalledWith(
      'canvas-1',
      expect.objectContaining({ isLocked: false })
    )
  })

  it('잠금되지 않은 canvas 는 update 가 정상 동작한다', () => {
    const unlocked = { ...LOCKED_CANVAS, isLocked: false }
    vi.mocked(canvasRepository.findById).mockReturnValue(unlocked)
    vi.mocked(canvasRepository.update).mockReturnValue(unlocked)
    expect(() => canvasService.update('canvas-1', { title: 'new' })).not.toThrow()
  })
})

// ─── csv-file ────────────────────────────────────────────────

describe('csvFileService — 잠금 가드', () => {
  it('잠금된 csv writeContent 는 LockedError 를 throw 한다', () => {
    vi.mocked(csvFileRepository.findById).mockReturnValue(LOCKED_CSV)
    expect(() => csvFileService.writeContent('ws-1', 'csv-1', 'a,b\n')).toThrow(LockedError)
  })

  it('잠금된 csv rename 은 LockedError 를 throw 한다', () => {
    vi.mocked(csvFileRepository.findById).mockReturnValue(LOCKED_CSV)
    expect(() => csvFileService.rename('ws-1', 'csv-1', 'new-name')).toThrow(LockedError)
  })

  it('잠금된 csv soft remove 는 LockedError 를 throw 한다', () => {
    vi.mocked(csvFileRepository.findById).mockReturnValue(LOCKED_CSV)
    expect(() => csvFileService.remove('ws-1', 'csv-1')).toThrow(LockedError)
  })

  it('잠금된 csv 도 columnWidths 갱신은 허용된다 (view 메타)', () => {
    vi.mocked(csvFileRepository.findById).mockReturnValue(LOCKED_CSV)
    vi.mocked(csvFileRepository.update).mockReturnValue({ ...LOCKED_CSV, columnWidths: '[100,80]' })
    expect(() =>
      csvFileService.updateMeta('ws-1', 'csv-1', { columnWidths: '[100,80]' })
    ).not.toThrow()
  })

  it('잠금된 csv 의 description 변경은 LockedError 를 throw 한다', () => {
    vi.mocked(csvFileRepository.findById).mockReturnValue(LOCKED_CSV)
    expect(() => csvFileService.updateMeta('ws-1', 'csv-1', { description: 'new' })).toThrow(
      LockedError
    )
  })

  it('잠금된 csv 도 toggleLock 으로 해제할 수 있다 (가드 우회)', () => {
    vi.mocked(csvFileRepository.findById).mockReturnValue(LOCKED_CSV)
    vi.mocked(csvFileRepository.update).mockReturnValue({ ...LOCKED_CSV, isLocked: false })
    const result = csvFileService.toggleLock('ws-1', 'csv-1', false)
    expect(result.isLocked).toBe(false)
  })
})

// ─── LockedError contract ────────────────────────────────────

describe('LockedError', () => {
  it('code 는 "LOCKED" 이다', () => {
    const err = new LockedError()
    expect(err.code).toBe('LOCKED')
    expect(err.name).toBe('LockedError')
  })
})
