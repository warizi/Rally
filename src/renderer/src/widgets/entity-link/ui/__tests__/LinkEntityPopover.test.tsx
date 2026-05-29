/**
 * widgets/entity-link/ui/LinkEntityPopover.test.tsx
 *
 * 7 entity type tab + 검색 input + linkedSet 분기 → 체크 표시.
 * 항목 클릭 → linkEntity (없으면) 또는 unlinkEntity (있으면).
 * children = controlled trigger.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

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
})
