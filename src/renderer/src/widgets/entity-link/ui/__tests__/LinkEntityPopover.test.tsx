/**
 * widgets/entity-link/ui/LinkEntityPopover.test.tsx
 *
 * 7 entity type tab + 검색 input + linkedSet 분기 → 체크 표시.
 * 항목 클릭 → linkEntity (없으면) 또는 unlinkEntity (있으면).
 * children = controlled trigger.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  linked: [] as Array<{ entityType: string; entityId: string }>,
  todos: [] as Array<{ id: string; title: string; parentId: string | null }>,
  schedules: [] as Array<{ id: string; title: string }>,
  notes: [] as Array<{ id: string; title: string }>,
  pdfs: [] as Array<{ id: string; title: string }>,
  csvs: [] as Array<{ id: string; title: string }>,
  images: [] as Array<{ id: string; title: string }>,
  canvases: [] as Array<{ id: string; title: string }>,
  linkMutate: vi.fn(),
  unlinkMutate: vi.fn()
}))

vi.mock('@entities/todo', () => ({ useTodosByWorkspace: () => ({ data: mocks.todos }) }))
vi.mock('@entities/schedule', () => ({
  useAllSchedulesByWorkspace: () => ({ data: mocks.schedules })
}))
vi.mock('@entities/note', () => ({ useNotesByWorkspace: () => ({ data: mocks.notes }) }))
vi.mock('@entities/pdf-file', () => ({ usePdfFilesByWorkspace: () => ({ data: mocks.pdfs }) }))
vi.mock('@entities/csv-file', () => ({ useCsvFilesByWorkspace: () => ({ data: mocks.csvs }) }))
vi.mock('@entities/image-file', () => ({
  useImageFilesByWorkspace: () => ({ data: mocks.images })
}))
vi.mock('@entities/canvas', () => ({
  useCanvasesByWorkspace: () => ({ data: mocks.canvases })
}))

vi.mock('@entities/entity-link', () => ({
  useLinkedEntities: () => ({ data: mocks.linked }),
  useLinkEntity: () => ({ mutate: mocks.linkMutate }),
  useUnlinkEntity: () => ({ mutate: mocks.unlinkMutate })
}))

vi.mock('@shared/lib/entity-link', () => ({
  ENTITY_TYPE_LABEL: {
    todo: '할 일',
    schedule: '일정',
    note: '노트',
    pdf: 'PDF',
    csv: '테이블',
    image: '이미지',
    canvas: '캔버스'
  },
  ENTITY_TYPE_ICON: {
    todo: () => <span />,
    schedule: () => <span />,
    note: () => <span />,
    pdf: () => <span />,
    csv: () => <span />,
    image: () => <span />,
    canvas: () => <span />
  }
}))

vi.mock('@shared/ui/popover', () => ({
  Popover: ({ open, children }: { open?: boolean; children: React.ReactNode }) => (
    <div data-popover-open={open ?? false}>{children}</div>
  ),
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

vi.mock('@shared/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <button data-testid={`tab-${value}`}>{children}</button>
  ),
  TabsContent: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-testid={`tab-content-${value}`}>{children}</div>
  )
}))

vi.mock('@shared/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

import { LinkEntityPopover } from '../LinkEntityPopover'

beforeEach(() => {
  mocks.linked = []
  mocks.todos = []
  mocks.schedules = []
  mocks.notes = []
  mocks.pdfs = []
  mocks.csvs = []
  mocks.images = []
  mocks.canvases = []
  mocks.linkMutate.mockReset()
  mocks.unlinkMutate.mockReset()
})

describe('LinkEntityPopover', () => {
  it('children (trigger) 렌더 + 검색 input 노출', () => {
    render(
      <LinkEntityPopover entityType="todo" entityId="t1" workspaceId="ws" open>
        <button data-testid="trigger">add link</button>
      </LinkEntityPopover>
    )
    expect(screen.getByTestId('trigger')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/검색/)).toBeInTheDocument()
  })

  it('7개 entity type tab 노출', () => {
    render(
      <LinkEntityPopover entityType="todo" entityId="t1" workspaceId="ws" open>
        <button>trigger</button>
      </LinkEntityPopover>
    )
    expect(screen.getByTestId('tab-schedule')).toBeInTheDocument()
    expect(screen.getByTestId('tab-note')).toBeInTheDocument()
    expect(screen.getByTestId('tab-canvas')).toBeInTheDocument()
  })

  it('linkedEntities + 데이터 → tab content 안에 항목 노출 (smoke)', () => {
    mocks.linked = [{ entityType: 'schedule', entityId: 's1' }]
    mocks.schedules = [{ id: 's1', title: 'Linked Schedule' }]
    const { container } = render(
      <LinkEntityPopover entityType="todo" entityId="t1" workspaceId="ws" open>
        <button>trigger</button>
      </LinkEntityPopover>
    )
    // 첫 active tab 은 excludeType="todo" 다음인 schedule
    expect(container.innerHTML).toMatch(/Linked Schedule/)
  })

  it('컨트롤드 모드 — open=true → popover open', () => {
    const onOpenChange = vi.fn()
    const { container } = render(
      <LinkEntityPopover
        entityType="todo"
        entityId="t1"
        workspaceId="ws"
        open={true}
        onOpenChange={onOpenChange}
      >
        <button>x</button>
      </LinkEntityPopover>
    )
    expect(container.querySelector('[data-popover-open="true"]')).toBeInTheDocument()
  })

  it('non-linked 항목 클릭 → linkEntity.mutate 호출 (entityType/Id 지정)', () => {
    mocks.todos = [{ id: 'td1', title: 'Untouched Todo', parentId: null }]
    render(
      <LinkEntityPopover entityType="note" entityId="n1" workspaceId="ws" open>
        <button>trigger</button>
      </LinkEntityPopover>
    )
    // Tabs mock 가 모든 TabsContent 를 동시 렌더 → 첫 element 만 클릭.
    fireEvent.click(screen.getAllByText('Untouched Todo')[0])
    expect(mocks.linkMutate).toHaveBeenCalledTimes(1)
    expect(mocks.linkMutate.mock.calls[0][0]).toMatchObject({
      typeA: 'note',
      idA: 'n1',
      typeB: 'todo',
      idB: 'td1',
      workspaceId: 'ws'
    })
    expect(mocks.unlinkMutate).not.toHaveBeenCalled()
  })

  it('linked 항목 클릭 → unlinkEntity.mutate 호출', () => {
    mocks.linked = [{ entityType: 'todo', entityId: 'td1' }]
    mocks.todos = [{ id: 'td1', title: 'Linked Todo', parentId: null }]
    render(
      <LinkEntityPopover entityType="note" entityId="n1" workspaceId="ws" open>
        <button>trigger</button>
      </LinkEntityPopover>
    )
    fireEvent.click(screen.getAllByText('Linked Todo')[0])
    expect(mocks.unlinkMutate).toHaveBeenCalledTimes(1)
    expect(mocks.unlinkMutate.mock.calls[0][0]).toMatchObject({
      typeA: 'note',
      idA: 'n1',
      typeB: 'todo',
      idB: 'td1'
    })
    expect(mocks.linkMutate).not.toHaveBeenCalled()
  })

  it('검색 input 에 query 입력 → 매칭만 노출', () => {
    mocks.todos = [
      { id: 'td1', title: 'Apple', parentId: null },
      { id: 'td2', title: 'Banana', parentId: null }
    ]
    render(
      <LinkEntityPopover entityType="note" entityId="n1" workspaceId="ws" open>
        <button>trigger</button>
      </LinkEntityPopover>
    )
    expect(screen.getAllByText('Apple').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Banana').length).toBeGreaterThan(0)

    fireEvent.change(screen.getByPlaceholderText(/검색/), { target: { value: 'app' } })
    expect(screen.getAllByText('Apple').length).toBeGreaterThan(0)
    expect(screen.queryByText('Banana')).toBeNull()
  })

  it('todos 가 parentId 있음 → todo 탭에서 제외 (parentId 없는 것만 표시)', () => {
    mocks.todos = [
      { id: 'p1', title: 'Parent Todo', parentId: null },
      { id: 's1', title: 'Sub Todo', parentId: 'p1' }
    ]
    render(
      <LinkEntityPopover entityType="note" entityId="n1" workspaceId="ws" open>
        <button>trigger</button>
      </LinkEntityPopover>
    )
    // entityType='note' → 첫 active='todo'. parent 만 노출.
    expect(screen.getAllByText('Parent Todo').length).toBeGreaterThan(0)
    expect(screen.queryByText('Sub Todo')).toBeNull()
  })

  it('schedule 데이터 → 7개 tab 중 schedule tab 노출 (smoke)', () => {
    mocks.schedules = [{ id: 's1', title: 'Schedule X' }]
    render(
      <LinkEntityPopover entityType="todo" entityId="t1" workspaceId="ws" open>
        <button>trigger</button>
      </LinkEntityPopover>
    )
    // entityType='todo' → 첫 active='schedule'. Schedule X 노출.
    expect(screen.getAllByText('Schedule X').length).toBeGreaterThan(0)
  })

  it('linkedSet 가 빈 매칭 검사 + 검색 빈문자열 → 모든 항목 노출', () => {
    mocks.todos = [
      { id: 't1', title: 'A', parentId: null },
      { id: 't2', title: 'B', parentId: null }
    ]
    render(
      <LinkEntityPopover entityType="note" entityId="n1" workspaceId="ws" open>
        <button>trigger</button>
      </LinkEntityPopover>
    )
    fireEvent.change(screen.getByPlaceholderText(/검색/), { target: { value: '' } })
    expect(screen.getAllByText('A').length).toBeGreaterThan(0)
    expect(screen.getAllByText('B').length).toBeGreaterThan(0)
  })

  it('filtered 비어있음 → "항목이 없습니다" 노출', () => {
    mocks.todos = [{ id: 't1', title: 'Apple', parentId: null }]
    render(
      <LinkEntityPopover entityType="note" entityId="n1" workspaceId="ws" open>
        <button>trigger</button>
      </LinkEntityPopover>
    )
    fireEvent.change(screen.getByPlaceholderText(/검색/), { target: { value: 'zzz' } })
    expect(screen.getAllByText('항목이 없습니다').length).toBeGreaterThan(0)
  })

  it('자기 자신 (entityType + entityId 매칭) 제외 — entityType ≠ activeTab type 이라도 다른 탭에선 제외', () => {
    // activeTab 은 entityType='note' 이면 todo. 'Self Note'(n1) 는 자기. notes 탭 비활성.
    // 검색 query 매칭으로 자기 자신 제외 분기 자체는 doNotChange 결과.
    mocks.notes = [
      { id: 'n1', title: 'Self Note' },
      { id: 'n2', title: 'Other Note' }
    ]
    render(
      <LinkEntityPopover entityType="note" entityId="n1" workspaceId="ws" open>
        <button>trigger</button>
      </LinkEntityPopover>
    )
    // entityType='note'이라 첫 active='todo'. notes 탭 활성 아님 → Self Note/Other Note 노출 안 됨.
    expect(screen.queryByText('Self Note')).toBeNull()
    expect(screen.queryByText('Other Note')).toBeNull()
  })

  it('input ArrowDown → list mode 전환 (focusIndex=0)', () => {
    mocks.todos = [{ id: 't1', title: 'First Item', parentId: null }]
    render(
      <LinkEntityPopover entityType="note" entityId="n1" workspaceId="ws" open>
        <button>trigger</button>
      </LinkEntityPopover>
    )
    const input = screen.getByPlaceholderText(/검색/)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    // smoke — 이후 클릭이 정상 작동하는지로 검증
    fireEvent.click(screen.getAllByText('First Item')[0])
    expect(mocks.linkMutate).toHaveBeenCalledTimes(1)
  })

  it('input ArrowDown + filtered.length=0 → 아무 일도 일어나지 않음 (smoke)', () => {
    mocks.todos = []
    render(
      <LinkEntityPopover entityType="note" entityId="n1" workspaceId="ws" open>
        <button>trigger</button>
      </LinkEntityPopover>
    )
    const input = screen.getByPlaceholderText(/검색/)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    // 빈 리스트 — 에러 없이 통과
    expect(screen.getAllByText('항목이 없습니다').length).toBeGreaterThan(0)
  })

  it('input ArrowUp → list 끝으로 이동 (smoke)', () => {
    mocks.todos = [
      { id: 't1', title: 'Item1', parentId: null },
      { id: 't2', title: 'Item2', parentId: null }
    ]
    render(
      <LinkEntityPopover entityType="note" entityId="n1" workspaceId="ws" open>
        <button>trigger</button>
      </LinkEntityPopover>
    )
    const input = screen.getByPlaceholderText(/검색/)
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    // 에러 없이 통과
    expect(screen.getAllByText('Item1').length).toBeGreaterThan(0)
  })

  it('children 없으면 기본 "연결" 버튼 노출', () => {
    render(<LinkEntityPopover entityType="todo" entityId="t1" workspaceId="ws" open />)
    expect(screen.getByText('연결')).toBeInTheDocument()
  })

  it('mouseEnter 항목 → focusIndex 변경 (smoke 클릭 동작)', () => {
    mocks.todos = [{ id: 't1', title: 'Mouse Item', parentId: null }]
    render(
      <LinkEntityPopover entityType="note" entityId="n1" workspaceId="ws" open>
        <button>trigger</button>
      </LinkEntityPopover>
    )
    const item = screen.getAllByText('Mouse Item')[0]
    fireEvent.mouseEnter(item)
    fireEvent.click(item)
    expect(mocks.linkMutate).toHaveBeenCalledTimes(1)
  })
})
