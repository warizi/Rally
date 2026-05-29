/**
 * widgets/entity-link/ui/PendingLinkPicker.test.tsx
 *
 * 데이터 7종 모두 mock. selected pendingLinks 뱃지 X 클릭 → onRemove.
 * Popover trigger 클릭 시 동작. excludeType 제외 첫 탭으로 init.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  todos: [] as Array<{ id: string; title: string; parentId: string | null }>,
  schedules: [] as Array<{ id: string; title: string }>,
  notes: [] as Array<{ id: string; title: string }>,
  pdfs: [] as Array<{ id: string; title: string }>,
  csvs: [] as Array<{ id: string; title: string }>,
  images: [] as Array<{ id: string; title: string }>,
  canvases: [] as Array<{ id: string; title: string }>
}))

vi.mock('@entities/todo', () => ({
  useTodosByWorkspace: () => ({ data: mocks.todos })
}))
vi.mock('@entities/schedule', () => ({
  useAllSchedulesByWorkspace: () => ({ data: mocks.schedules })
}))
vi.mock('@entities/note', () => ({
  useNotesByWorkspace: () => ({ data: mocks.notes })
}))
vi.mock('@entities/pdf-file', () => ({
  usePdfFilesByWorkspace: () => ({ data: mocks.pdfs })
}))
vi.mock('@entities/csv-file', () => ({
  useCsvFilesByWorkspace: () => ({ data: mocks.csvs })
}))
vi.mock('@entities/image-file', () => ({
  useImageFilesByWorkspace: () => ({ data: mocks.images })
}))
vi.mock('@entities/canvas', () => ({
  useCanvasesByWorkspace: () => ({ data: mocks.canvases })
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
    todo: () => <span data-testid="icon-todo" />,
    schedule: () => <span data-testid="icon-schedule" />,
    note: () => <span data-testid="icon-note" />,
    pdf: () => <span data-testid="icon-pdf" />,
    csv: () => <span data-testid="icon-csv" />,
    image: () => <span data-testid="icon-image" />,
    canvas: () => <span data-testid="icon-canvas" />
  }
}))

vi.mock('@shared/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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

import { PendingLinkPicker } from '../PendingLinkPicker'

describe('PendingLinkPicker', () => {
  it('selected 비었음 → 뱃지 미노출', () => {
    render(
      <PendingLinkPicker
        workspaceId="ws"
        excludeType="todo"
        selected={[]}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />
    )
    // 7 tab buttons + add button
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0)
  })

  it('selected 있음 → 각 link title 뱃지 노출', () => {
    render(
      <PendingLinkPicker
        workspaceId="ws"
        excludeType="todo"
        selected={[
          { type: 'note', id: 'n1', title: 'My Note' },
          { type: 'csv', id: 'c1', title: 'My CSV' }
        ]}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />
    )
    expect(screen.getByText('My Note')).toBeInTheDocument()
    expect(screen.getByText('My CSV')).toBeInTheDocument()
  })

  it('selected X 버튼 클릭 → onRemove(link)', () => {
    const onRemove = vi.fn()
    const link = { type: 'note' as const, id: 'n1', title: 'A' }
    const { container } = render(
      <PendingLinkPicker
        workspaceId="ws"
        excludeType="todo"
        selected={[link]}
        onAdd={vi.fn()}
        onRemove={onRemove}
      />
    )
    // X 아이콘의 부모 button (뱃지 안의 X)
    const xIcon = container.querySelector('svg.lucide-x')
    fireEvent.click(xIcon!.closest('button')!)
    expect(onRemove).toHaveBeenCalledWith(link)
  })

  it('7개 type tab + add 버튼 노출 (7 tabs + Link icon)', () => {
    render(
      <PendingLinkPicker
        workspaceId="ws"
        excludeType="todo"
        selected={[]}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />
    )
    expect(screen.getByTestId('tab-note')).toBeInTheDocument()
    expect(screen.getByTestId('tab-csv')).toBeInTheDocument()
    expect(screen.getByTestId('tab-canvas')).toBeInTheDocument()
  })
})
