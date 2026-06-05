/**
 * 도메인별 invalid input 회귀 테스트.
 *
 * 잘못된 id / path / payload / date / enum / 범위 입력이 service 호출 전에
 * IPC boundary 에서 차단되는지(`success:false` + service mock 미호출) 검증한다.
 * 대표 케이스만 모아 도메인 전반의 검증 동작을 보장한다.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ipcHandlers, getHandler, makeIpcMainMock } from './_ipc-mock'

vi.mock('electron', () => ({
  ...makeIpcMainMock(),
  dialog: { showOpenDialog: vi.fn(), showSaveDialog: vi.fn() }
}))

vi.mock('../../services/note', () => ({
  noteService: {
    create: vi.fn(),
    import: vi.fn(),
    readByWorkspaceFromDb: vi.fn()
  }
}))
vi.mock('../../services/csv-file', () => ({
  csvFileService: { import: vi.fn(), readByWorkspaceFromDb: vi.fn() }
}))
vi.mock('../../services/todo', () => ({
  todoService: { remove: vi.fn(), create: vi.fn() }
}))
vi.mock('../../services/trash', () => ({
  trashService: { setRetention: vi.fn() }
}))
vi.mock('../../services/reminder', () => ({
  reminderService: { set: vi.fn() }
}))
vi.mock('../../services/schedule', () => ({
  scheduleService: { create: vi.fn() }
}))
vi.mock('../../services/canvas-node', () => ({
  canvasNodeService: { updatePositions: vi.fn() }
}))
vi.mock('../../services/terminal', () => ({
  terminalService: { create: vi.fn() }
}))
vi.mock('../../repositories/terminal-session', () => ({
  terminalSessionRepository: { create: vi.fn() }
}))
vi.mock('../../repositories/terminal-layout', () => ({
  terminalLayoutRepository: {}
}))

import { registerNoteHandlers } from '../note'
import { registerCsvFileHandlers } from '../csv-file'
import { registerTodoHandlers } from '../todo'
import { registerTrashHandlers } from '../trash'
import { registerReminderHandlers } from '../reminder'
import { registerScheduleHandlers } from '../schedule'
import { registerCanvasNodeHandlers } from '../canvas-node'
import { registerTerminalHandlers } from '../terminal'

import { noteService } from '../../services/note'
import { csvFileService } from '../../services/csv-file'
import { todoService } from '../../services/todo'
import { trashService } from '../../services/trash'
import { reminderService } from '../../services/reminder'
import { scheduleService } from '../../services/schedule'
import { canvasNodeService } from '../../services/canvas-node'
import { terminalService } from '../../services/terminal'

const WS = 'ws-aabbcc12'

beforeEach(() => {
  ipcHandlers.clear()
  vi.clearAllMocks()
  registerNoteHandlers()
  registerCsvFileHandlers()
  registerTodoHandlers()
  registerTrashHandlers()
  registerReminderHandlers()
  registerScheduleHandlers()
  registerCanvasNodeHandlers()
  registerTerminalHandlers()
})

/** 동기 validateIpc 핸들러 호출 결과를 IpcResponse 로 받는다. */
function call<T = unknown>(channel: string, ...args: unknown[]): { success: boolean } {
  return getHandler<T>(channel)({}, ...args) as unknown as { success: boolean }
}

describe('invalid id (nanoid 형식 위반)', () => {
  it('todo:remove → 너무 짧은 id 거부, service 미호출', () => {
    const res = call('todo:remove', 'bad')
    expect(res.success).toBe(false)
    expect(todoService.remove).not.toHaveBeenCalled()
  })

  it('todo:remove → 공백/슬래시 포함 id 거부', () => {
    expect(call('todo:remove', 'has/slash/id').success).toBe(false)
    expect(todoService.remove).not.toHaveBeenCalled()
  })
})

describe('path traversal 차단', () => {
  it('csv:import → ".." 세그먼트 경로 거부', () => {
    const res = call('csv:import', WS, null, '../../etc/passwd')
    expect(res.success).toBe(false)
    expect(csvFileService.import).not.toHaveBeenCalled()
  })

  it('note:import → 백슬래시 traversal 거부', () => {
    const res = call('note:import', WS, null, '..\\..\\secret')
    expect(res.success).toBe(false)
    expect(noteService.import).not.toHaveBeenCalled()
  })
})

describe('빈/과길이 문자열', () => {
  it('note:create → 빈 이름 거부', () => {
    const res = call('note:create', WS, null, '   ')
    expect(res.success).toBe(false)
    expect(noteService.create).not.toHaveBeenCalled()
  })

  it('note:create → 255자 초과 이름 거부', () => {
    const res = call('note:create', WS, null, 'a'.repeat(256))
    expect(res.success).toBe(false)
    expect(noteService.create).not.toHaveBeenCalled()
  })
})

describe('잘못된 enum', () => {
  it('trash:setRetention → 허용되지 않은 키 거부', () => {
    const res = call('trash:setRetention', '30d')
    expect(res.success).toBe(false)
    expect(trashService.setRetention).not.toHaveBeenCalled()
  })

  it('reminder:set → 잘못된 entityType 거부', () => {
    const res = call('reminder:set', { entityType: 'project', entityId: WS, offsetMs: 1000 })
    expect(res.success).toBe(false)
    expect(reminderService.set).not.toHaveBeenCalled()
  })
})

describe('잘못된 Date / 필수 필드 누락', () => {
  it('schedule:create → 파싱 불가 startAt 거부', () => {
    const res = call('schedule:create', WS, {
      title: 'meeting',
      startAt: 'not-a-date',
      endAt: new Date()
    })
    expect(res.success).toBe(false)
    expect(scheduleService.create).not.toHaveBeenCalled()
  })

  it('schedule:create → 필수 endAt 누락 거부', () => {
    const res = call('schedule:create', WS, { title: 'meeting', startAt: new Date() })
    expect(res.success).toBe(false)
    expect(scheduleService.create).not.toHaveBeenCalled()
  })
})

describe('잘못된 배열/payload shape', () => {
  it('canvasNode:updatePositions → 배열 아님 거부', () => {
    const res = call('canvasNode:updatePositions', { id: 'x', x: 1, y: 2 })
    expect(res.success).toBe(false)
    expect(canvasNodeService.updatePositions).not.toHaveBeenCalled()
  })

  it('canvasNode:updatePositions → 요소 id 형식 위반 거부', () => {
    const res = call('canvasNode:updatePositions', [{ id: 'x', x: 1, y: 2 }])
    expect(res.success).toBe(false)
    expect(canvasNodeService.updatePositions).not.toHaveBeenCalled()
  })
})

describe('terminal cols/rows 범위', () => {
  it('terminal:create → cols 0 거부', () => {
    const res = call('terminal:create', {
      workspaceId: WS,
      cwd: '/tmp',
      cols: 0,
      rows: 24
    })
    expect(res.success).toBe(false)
    expect(terminalService.create).not.toHaveBeenCalled()
  })

  it('terminal:create → rows 과대값 거부', () => {
    const res = call('terminal:create', {
      workspaceId: WS,
      cwd: '/tmp',
      cols: 80,
      rows: 999999
    })
    expect(res.success).toBe(false)
    expect(terminalService.create).not.toHaveBeenCalled()
  })

  it('terminal:create → 정상 입력은 통과(회귀 가드)', () => {
    const res = call('terminal:create', {
      workspaceId: WS,
      cwd: '/tmp',
      cols: 80,
      rows: 24
    })
    expect(res.success).toBe(true)
    expect(terminalService.create).toHaveBeenCalled()
  })
})
