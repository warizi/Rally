import { describe, expect, it, vi, beforeEach } from 'vitest'
import { todoService } from '../todo'
import { todoRepository } from '../../repositories/todo'
import { workspaceRepository } from '../../repositories/workspace'
import { NotFoundError } from '../../lib/errors'

vi.mock('../../repositories/workspace', () => ({
  workspaceRepository: { findById: vi.fn() }
}))

vi.mock('../../repositories/todo', () => ({
  todoRepository: {
    findByWorkspaceId: vi.fn(),
    findById: vi.fn(),
    findByParentId: vi.fn(),
    findTopLevelByWorkspaceId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    bulkUpdateListOrder: vi.fn(),
    bulkUpdateKanbanOrder: vi.fn(),
    bulkUpdateSubOrder: vi.fn()
  }
}))

const MOCK_WS = { id: 'ws-1', name: 'T', path: '/t', createdAt: new Date(), updatedAt: new Date() }

const MOCK_TODO_ROW = {
  id: 'todo-1',
  workspaceId: 'ws-1',
  parentId: null,
  title: 'Test',
  description: '',
  status: '할일' as const,
  priority: 'medium' as const,
  isDone: false,
  listOrder: 0,
  kanbanOrder: 0,
  subOrder: 0,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  doneAt: null,
  dueDate: null,
  startDate: null
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(workspaceRepository.findById).mockReturnValue(MOCK_WS)
  vi.mocked(todoRepository.create).mockReturnValue(MOCK_TODO_ROW)
  vi.mocked(todoRepository.update).mockReturnValue(MOCK_TODO_ROW)
  vi.mocked(todoRepository.findByWorkspaceId).mockReturnValue([MOCK_TODO_ROW])
  vi.mocked(todoRepository.findById).mockReturnValue(MOCK_TODO_ROW)
  vi.mocked(todoRepository.findTopLevelByWorkspaceId).mockReturnValue([])
  vi.mocked(todoRepository.findByParentId).mockReturnValue([])
})

describe('findByWorkspace', () => {
  it('정상 — todoRepository.findByWorkspaceId 호출 후 TodoItem[] 반환', () => {
    const result = todoService.findByWorkspace('ws-1')
    expect(todoRepository.findByWorkspaceId).toHaveBeenCalledWith('ws-1', undefined)
    expect(result).toHaveLength(1)
  })
  it('존재하지 않는 workspaceId → NotFoundError', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => todoService.findByWorkspace('bad-ws')).toThrow(NotFoundError)
  })
})

describe('create', () => {
  it('최상위 생성 — findTopLevelByWorkspaceId 호출, findById 미호출', () => {
    todoService.create('ws-1', { title: '할일' })
    expect(todoRepository.findTopLevelByWorkspaceId).toHaveBeenCalledWith('ws-1')
    expect(todoRepository.findById).not.toHaveBeenCalled()
  })

  it('서브투두 생성 — findByParentId 호출, findTopLevelByWorkspaceId 미호출', () => {
    vi.mocked(todoRepository.findById).mockReturnValue(MOCK_TODO_ROW)
    todoService.create('ws-1', { title: '서브', parentId: 'todo-1' })
    expect(todoRepository.findByParentId).toHaveBeenCalledWith('todo-1')
    expect(todoRepository.findTopLevelByWorkspaceId).not.toHaveBeenCalled()
  })

  it('형제 없을 때 — listOrder=kanbanOrder=subOrder=0', () => {
    vi.mocked(todoRepository.findTopLevelByWorkspaceId).mockReturnValue([])
    todoService.create('ws-1', { title: '첫 투두' })
    expect(todoRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ listOrder: 0, kanbanOrder: 0, subOrder: 0 })
    )
  })

  it('형제 있을 때 (max listOrder=2) — listOrder=3', () => {
    vi.mocked(todoRepository.findTopLevelByWorkspaceId).mockReturnValue([
      { ...MOCK_TODO_ROW, id: 'sib-1', listOrder: 1, kanbanOrder: 1, subOrder: 1 },
      { ...MOCK_TODO_ROW, id: 'sib-2', listOrder: 2, kanbanOrder: 2, subOrder: 2 }
    ])
    todoService.create('ws-1', { title: '세 번째' })
    expect(todoRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ listOrder: 3, kanbanOrder: 3, subOrder: 3 })
    )
  })

  it("status='완료'로 생성 — isDone=true, doneAt=expect.any(Date)", () => {
    todoService.create('ws-1', { title: '완료', status: '완료' })
    expect(todoRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ isDone: true, doneAt: expect.any(Date) })
    )
  })

  it('기본 status 생성 — isDone=false, doneAt=null', () => {
    todoService.create('ws-1', { title: '할일' })
    expect(todoRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ isDone: false, doneAt: null })
    )
  })

  it("title='  제목  ' — trim 적용", () => {
    todoService.create('ws-1', { title: '  제목  ' })
    expect(todoRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: '제목' })
    )
  })

  it('description 미전달 — description=""', () => {
    todoService.create('ws-1', { title: '제목' })
    expect(todoRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ description: '' })
    )
  })

  it('없는 parentId → NotFoundError', () => {
    vi.mocked(todoRepository.findById).mockReturnValue(undefined)
    expect(() => todoService.create('ws-1', { title: 't', parentId: 'ghost' })).toThrow(NotFoundError)
  })

  it('없는 workspaceId → NotFoundError', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => todoService.create('bad', { title: 't' })).toThrow(NotFoundError)
  })
})

describe('update', () => {
  it('{isDone:true} → status=완료, doneAt=Date', () => {
    todoService.update('todo-1', { isDone: true })
    expect(todoRepository.update).toHaveBeenCalledWith(
      'todo-1',
      expect.objectContaining({ isDone: true, status: '완료', doneAt: expect.any(Date) })
    )
  })

  it('{isDone:false} → status=할일, doneAt=null', () => {
    todoService.update('todo-1', { isDone: false })
    expect(todoRepository.update).toHaveBeenCalledWith(
      'todo-1',
      expect.objectContaining({ isDone: false, status: '할일', doneAt: null })
    )
  })

  it("{status:'완료'} → isDone=true, doneAt=Date", () => {
    todoService.update('todo-1', { status: '완료' })
    expect(todoRepository.update).toHaveBeenCalledWith(
      'todo-1',
      expect.objectContaining({ isDone: true, status: '완료', doneAt: expect.any(Date) })
    )
  })

  it("{status:'진행중'} → isDone=false, doneAt=null", () => {
    todoService.update('todo-1', { status: '진행중' })
    expect(todoRepository.update).toHaveBeenCalledWith(
      'todo-1',
      expect.objectContaining({ isDone: false, status: '진행중', doneAt: null })
    )
  })

  it("{status:'보류'} → isDone=false, doneAt=null", () => {
    todoService.update('todo-1', { status: '보류' })
    expect(todoRepository.update).toHaveBeenCalledWith(
      'todo-1',
      expect.objectContaining({ isDone: false, status: '보류', doneAt: null })
    )
  })

  it('{title만} → isDone/status/doneAt 필드 포함 안 됨', () => {
    todoService.update('todo-1', { title: '새 제목' })
    const arg = vi.mocked(todoRepository.update).mock.calls[0][1]
    expect(arg).not.toHaveProperty('isDone')
    expect(arg).not.toHaveProperty('status')
    expect(arg).not.toHaveProperty('doneAt')
  })

  it('{isDone:false, status:진행중} → isDone 우선, status=할일로 강제', () => {
    todoService.update('todo-1', { isDone: false, status: '진행중' })
    expect(todoRepository.update).toHaveBeenCalledWith(
      'todo-1',
      expect.objectContaining({ isDone: false, status: '할일' })
    )
  })

  it("{title:'  수정  '} → title trim 적용", () => {
    todoService.update('todo-1', { title: '  수정  ' })
    expect(todoRepository.update).toHaveBeenCalledWith(
      'todo-1',
      expect.objectContaining({ title: '수정' })
    )
  })

  it("{description:'  설명  '} → description trim 적용", () => {
    todoService.update('todo-1', { description: '  설명  ' })
    expect(todoRepository.update).toHaveBeenCalledWith(
      'todo-1',
      expect.objectContaining({ description: '설명' })
    )
  })

  it('없는 todoId → NotFoundError (findById 단계)', () => {
    vi.mocked(todoRepository.findById).mockReturnValue(undefined)
    expect(() => todoService.update('ghost', { title: 'x' })).toThrow(NotFoundError)
  })

  it('update 반환 undefined → NotFoundError (update 단계)', () => {
    vi.mocked(todoRepository.update).mockReturnValue(undefined)
    expect(() => todoService.update('todo-1', { title: 'x' })).toThrow(NotFoundError)
  })
})

describe('부모 자동완료', () => {
  const subTodo = { ...MOCK_TODO_ROW, id: 'sub-1', parentId: 'par-1' }
  const parentTodo = { ...MOCK_TODO_ROW, id: 'par-1' }

  it('서브투두 완료 + 모든 형제 완료 → update 2회 (부모 자동완료)', () => {
    vi.mocked(todoRepository.findById).mockReturnValue(subTodo)
    vi.mocked(todoRepository.update).mockReturnValue(subTodo)
    vi.mocked(todoRepository.findByParentId).mockReturnValue([
      { ...subTodo, id: 'sub-1', isDone: false },
      { ...subTodo, id: 'sub-2', isDone: true }
    ])
    todoService.update('sub-1', { isDone: true })
    expect(todoRepository.update).toHaveBeenCalledTimes(2)
    expect(todoRepository.update).toHaveBeenNthCalledWith(
      2,
      'par-1',
      expect.objectContaining({ isDone: true, status: '완료' })
    )
  })

  it('서브투두 완료 + 미완료 형제 있음 → update 1회', () => {
    vi.mocked(todoRepository.findById).mockReturnValue(subTodo)
    vi.mocked(todoRepository.update).mockReturnValue(subTodo)
    vi.mocked(todoRepository.findByParentId).mockReturnValue([
      { ...subTodo, id: 'sub-1', isDone: false },
      { ...subTodo, id: 'sub-2', isDone: false }
    ])
    todoService.update('sub-1', { isDone: true })
    expect(todoRepository.update).toHaveBeenCalledTimes(1)
  })

  it('서브투두 단독 (형제 없음) → update 2회 (always allDone=true)', () => {
    vi.mocked(todoRepository.findById).mockReturnValue(subTodo)
    vi.mocked(todoRepository.update).mockReturnValue(subTodo)
    vi.mocked(todoRepository.findByParentId).mockReturnValue([
      { ...subTodo, id: 'sub-1', isDone: false }
    ])
    todoService.update('sub-1', { isDone: true })
    expect(todoRepository.update).toHaveBeenCalledTimes(2)
  })

  it('최상위 투두 완료 → update 1회, findByParentId 미호출', () => {
    vi.mocked(todoRepository.findById).mockReturnValue(parentTodo)
    vi.mocked(todoRepository.update).mockReturnValue(parentTodo)
    todoService.update('par-1', { isDone: true })
    expect(todoRepository.update).toHaveBeenCalledTimes(1)
    expect(todoRepository.findByParentId).not.toHaveBeenCalled()
  })

  it("status='완료' 업데이트도 부모 자동완료 트리거", () => {
    vi.mocked(todoRepository.findById).mockReturnValue(subTodo)
    vi.mocked(todoRepository.update).mockReturnValue(subTodo)
    vi.mocked(todoRepository.findByParentId).mockReturnValue([
      { ...subTodo, id: 'sub-1', isDone: false }
    ])
    todoService.update('sub-1', { status: '완료' })
    expect(todoRepository.update).toHaveBeenCalledTimes(2)
  })
})

describe('remove', () => {
  it('정상 삭제 → todoRepository.delete 1회', () => {
    todoService.remove('todo-1')
    expect(todoRepository.delete).toHaveBeenCalledWith('todo-1')
    expect(todoRepository.delete).toHaveBeenCalledTimes(1)
  })
  it('없는 todoId → NotFoundError', () => {
    vi.mocked(todoRepository.findById).mockReturnValue(undefined)
    expect(() => todoService.remove('ghost')).toThrow(NotFoundError)
  })
})

describe('reorderList', () => {
  it('bulkUpdateListOrder 호출', () => {
    todoService.reorderList('ws-1', [{ id: 'todo-1', order: 5 }])
    expect(todoRepository.bulkUpdateListOrder).toHaveBeenCalledWith([{ id: 'todo-1', order: 5 }])
  })
  it('없는 workspaceId → NotFoundError', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => todoService.reorderList('bad', [])).toThrow(NotFoundError)
  })
})

describe('reorderKanban', () => {
  it("status='완료' — bulkUpdateKanbanOrder에 isDone=true, doneAt=number 전달", () => {
    todoService.reorderKanban('ws-1', [{ id: 'todo-1', order: 1, status: '완료' }])
    expect(todoRepository.bulkUpdateKanbanOrder).toHaveBeenCalledWith([
      expect.objectContaining({ isDone: true, doneAt: expect.any(Number) })
    ])
  })
  it("status='할일' — isDone=false, doneAt=null 전달", () => {
    todoService.reorderKanban('ws-1', [{ id: 'todo-1', order: 1, status: '할일' }])
    expect(todoRepository.bulkUpdateKanbanOrder).toHaveBeenCalledWith([
      expect.objectContaining({ isDone: false, doneAt: null })
    ])
  })
  it('status 없음 — {id, order}만 전달', () => {
    todoService.reorderKanban('ws-1', [{ id: 'todo-1', order: 1 }])
    expect(todoRepository.bulkUpdateKanbanOrder).toHaveBeenCalledWith([{ id: 'todo-1', order: 1 }])
  })
})

describe('reorderSub', () => {
  it('bulkUpdateSubOrder 호출', () => {
    todoService.reorderSub('todo-1', [{ id: 'sub-1', order: 2 }])
    expect(todoRepository.bulkUpdateSubOrder).toHaveBeenCalledWith([{ id: 'sub-1', order: 2 }])
  })
  it('없는 parentId → NotFoundError', () => {
    vi.mocked(todoRepository.findById).mockReturnValue(undefined)
    expect(() => todoService.reorderSub('ghost', [])).toThrow(NotFoundError)
  })
})

describe('toTodoItem Date 변환', () => {
  it('createdAt/updatedAt → Date 인스턴스 (number 입력)', () => {
    const numericRow = {
      ...MOCK_TODO_ROW,
      createdAt: 1700000000000 as unknown as Date,
      updatedAt: 1700000000000 as unknown as Date
    }
    vi.mocked(todoRepository.findById).mockReturnValue(numericRow)
    vi.mocked(todoRepository.update).mockReturnValue(numericRow)
    const result = todoService.update('todo-1', { title: 'x' })
    expect(result.createdAt).toBeInstanceOf(Date)
    expect(result.updatedAt).toBeInstanceOf(Date)
  })
  it('isDone=true → doneAt은 Date 인스턴스', () => {
    const doneRow = { ...MOCK_TODO_ROW, isDone: true, doneAt: 1700000000000 as unknown as Date }
    vi.mocked(todoRepository.update).mockReturnValue(doneRow)
    const result = todoService.update('todo-1', { isDone: true })
    expect(result.doneAt).toBeInstanceOf(Date)
  })
  it('isDone=false → doneAt=null', () => {
    const undoneRow = { ...MOCK_TODO_ROW, isDone: false, doneAt: null }
    vi.mocked(todoRepository.update).mockReturnValue(undoneRow)
    const result = todoService.update('todo-1', { isDone: false })
    expect(result.doneAt).toBeNull()
  })
})
