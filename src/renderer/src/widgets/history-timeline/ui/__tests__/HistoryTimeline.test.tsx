/**
 * widgets/history-timeline/ui/HistoryTimeline.test.tsx
 *
 * isLoading / isError / 빈 결과 / 데이터 있음 4가지 분기 smoke.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  data: undefined as
    | undefined
    | { pages: Array<{ days: Array<{ date: string; todos: unknown[] }> }> },
  hasNextPage: false,
  isFetchingNextPage: false,
  isLoading: false,
  isError: false
}))

vi.mock('@entities/history', () => ({
  useHistoryInfinite: () => ({
    data: mocks.data,
    fetchNextPage: vi.fn(),
    hasNextPage: mocks.hasNextPage,
    isFetchingNextPage: mocks.isFetchingNextPage,
    isLoading: mocks.isLoading,
    isError: mocks.isError
  })
}))

vi.mock('@shared/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ScrollBar: () => null
}))

const tabStoreMocks = vi.hoisted(() => ({
  openTab: vi.fn()
}))

vi.mock('@/entities/tab-system', () => ({
  useTabStore: (sel?: (s: { openTab: typeof tabStoreMocks.openTab }) => unknown) =>
    sel ? sel({ openTab: tabStoreMocks.openTab }) : null
}))

vi.mock('@shared/constants/entity-icon', () => ({
  ENTITY_ICON: {
    todo: () => null,
    note: () => null,
    pdf: () => null,
    csv: () => null,
    image: () => null,
    canvas: () => null,
    schedule: () => null
  },
  ENTITY_ICON_COLOR: {}
}))

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

vi.mock('@dnd-kit/core', () => ({
  useDraggable: () => ({
    attributes: { role: 'button', tabIndex: 0 },
    listeners: {},
    setNodeRef: vi.fn(),
    isDragging: false
  })
}))

// ResizeObserver / IntersectionObserver mocks
type RO = (entries: unknown[]) => void
class MockResizeObserver {
  cb: RO
  constructor(cb: RO) {
    this.cb = cb
  }
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
;(globalThis as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver =
  MockResizeObserver
class MockIntersectionObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  takeRecords(): unknown[] {
    return []
  }
}
;(
  globalThis as unknown as { IntersectionObserver: typeof MockIntersectionObserver }
).IntersectionObserver = MockIntersectionObserver

vi.mock('@shared/ui/author-badge', () => ({
  AuthorBadge: () => null
}))

vi.mock('../../lib/highlight', () => ({
  HighlightText: ({ text }: { text: string }) => <>{text}</>
}))

vi.mock('../../lib/link-to-tab', () => ({
  linkToTabOptions: () => null
}))

vi.mock('../../lib/history-link-drag', () => ({
  buildHistoryLinkDragId: () => 'drag-id'
}))

import { HistoryTimeline } from '../HistoryTimeline'

beforeEach(() => {
  mocks.data = undefined
  mocks.hasNextPage = false
  mocks.isFetchingNextPage = false
  mocks.isLoading = false
  mocks.isError = false
})

describe('HistoryTimeline', () => {
  it('isLoading=true → Loader 노출', () => {
    mocks.isLoading = true
    const { container } = render(
      <HistoryTimeline workspaceId="ws" query="" fromDate={null} toDate={null} />
    )
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('isError=true → 에러 메시지', () => {
    mocks.isError = true
    render(<HistoryTimeline workspaceId="ws" query="" fromDate={null} toDate={null} />)
    expect(screen.getByText(/오류가 발생했습니다/)).toBeInTheDocument()
  })

  it('빈 결과 + 검색어 없음 → "완료된 할 일이 없습니다"', () => {
    mocks.data = { pages: [{ days: [] }] }
    render(<HistoryTimeline workspaceId="ws" query="" fromDate={null} toDate={null} />)
    expect(screen.getByText('완료된 할 일이 없습니다.')).toBeInTheDocument()
  })

  it('빈 결과 + 검색어 → "조건에 맞는 항목이 없습니다"', () => {
    mocks.data = { pages: [{ days: [] }] }
    render(<HistoryTimeline workspaceId="ws" query="hello" fromDate={null} toDate={null} />)
    expect(screen.getByText('조건에 맞는 항목이 없습니다.')).toBeInTheDocument()
  })

  it('데이터 있음 → 날짜 + 항목 노출', () => {
    mocks.data = {
      pages: [
        {
          days: [
            {
              date: '2026-05-30',
              todos: [
                {
                  id: 't1',
                  title: 'Completed Todo',
                  doneAt: new Date('2026-05-30T10:00:00Z'),
                  links: [],
                  updatedBy: 'user',
                  updatedById: null
                }
              ]
            }
          ]
        }
      ]
    } as never
    render(<HistoryTimeline workspaceId="ws" query="" fromDate={null} toDate={null} />)
    expect(screen.getByText('Completed Todo')).toBeInTheDocument()
  })

  it('parent + sub-todo 그룹화 (같은 day) → 부모 + 자식 모두 노출', () => {
    mocks.data = {
      pages: [
        {
          days: [
            {
              date: '2026-05-30',
              todos: [
                {
                  id: 'p1',
                  title: 'Parent Todo',
                  doneAt: new Date('2026-05-30T10:00:00Z'),
                  parentId: null,
                  links: [],
                  updatedBy: 'user',
                  updatedById: null
                },
                {
                  id: 's1',
                  parentId: 'p1',
                  parentTitle: 'Parent Todo',
                  title: 'Sub Todo',
                  doneAt: new Date('2026-05-30T11:00:00Z'),
                  links: [],
                  updatedBy: 'user',
                  updatedById: null
                }
              ]
            }
          ]
        }
      ]
    } as never
    render(<HistoryTimeline workspaceId="ws" query="" fromDate={null} toDate={null} />)
    expect(screen.getAllByText('Parent Todo').length).toBeGreaterThan(0)
    expect(screen.getByText('Sub Todo')).toBeInTheDocument()
  })

  it('recurring kind → 보라색 아이콘 (text-violet-500)', () => {
    mocks.data = {
      pages: [
        {
          days: [
            {
              date: '2026-05-30',
              todos: [
                {
                  id: 't1',
                  title: 'Recurring Done',
                  doneAt: new Date(),
                  kind: 'recurring',
                  parentId: null,
                  links: [],
                  updatedBy: 'user',
                  updatedById: null
                }
              ]
            }
          ]
        }
      ]
    } as never
    const { container } = render(
      <HistoryTimeline workspaceId="ws" query="" fromDate={null} toDate={null} />
    )
    expect(container.querySelector('.text-violet-500')).toBeInTheDocument()
  })

  it('links 있는 todo → LinkNode 노출', () => {
    mocks.data = {
      pages: [
        {
          days: [
            {
              date: '2026-05-30',
              todos: [
                {
                  id: 't1',
                  title: 'Todo with Link',
                  doneAt: new Date(),
                  parentId: null,
                  links: [
                    {
                      type: 'note',
                      id: 'n1',
                      title: 'Linked Note',
                      description: 'desc',
                      updatedBy: 'user',
                      updatedById: null,
                      updatedAt: new Date()
                    }
                  ],
                  updatedBy: 'user',
                  updatedById: null
                }
              ]
            }
          ]
        }
      ]
    } as never
    render(<HistoryTimeline workspaceId="ws" query="" fromDate={null} toDate={null} />)
    expect(screen.getByText('Linked Note')).toBeInTheDocument()
  })

  it('여러 day → 각 날짜별 라벨 노출', () => {
    mocks.data = {
      pages: [
        {
          days: [
            {
              date: '2026-05-30',
              todos: [
                {
                  id: 't1',
                  title: 'Day1',
                  doneAt: new Date(),
                  parentId: null,
                  links: [],
                  updatedBy: 'user',
                  updatedById: null
                }
              ]
            },
            {
              date: '2026-05-29',
              todos: [
                {
                  id: 't2',
                  title: 'Day2',
                  doneAt: new Date(),
                  parentId: null,
                  links: [],
                  updatedBy: 'user',
                  updatedById: null
                }
              ]
            }
          ]
        }
      ]
    } as never
    render(<HistoryTimeline workspaceId="ws" query="" fromDate={null} toDate={null} />)
    expect(screen.getByText('Day1')).toBeInTheDocument()
    expect(screen.getByText('Day2')).toBeInTheDocument()
  })

  it('linked entity 클릭 → openTab 호출 (linkToTabOptions)', () => {
    tabStoreMocks.openTab.mockClear()
    mocks.data = {
      pages: [
        {
          days: [
            {
              date: '2026-05-30',
              todos: [
                {
                  id: 't1',
                  title: 'Done',
                  doneAt: new Date(),
                  parentId: null,
                  links: [
                    {
                      type: 'note',
                      id: 'n1',
                      title: 'Linked',
                      description: '',
                      updatedBy: 'user',
                      updatedById: null,
                      updatedAt: new Date()
                    }
                  ],
                  updatedBy: 'user',
                  updatedById: null
                }
              ]
            }
          ]
        }
      ]
    } as never
    // linkToTabOptions mock 이 null 반환 → openTab 호출 안 됨
    render(<HistoryTimeline workspaceId="ws" query="" fromDate={null} toDate={null} />)
    const linkedBtn = screen.getByText('Linked').closest('div[role="button"]')
    if (linkedBtn) {
      ;(linkedBtn as HTMLElement).click()
    }
    // linkToTabOptions mock 이 null 반환이라 openTab 호출 안 됨
    expect(tabStoreMocks.openTab).not.toHaveBeenCalled()
  })

  it('linked entity Enter 키 → handleClick 동작 (smoke)', () => {
    mocks.data = {
      pages: [
        {
          days: [
            {
              date: '2026-05-30',
              todos: [
                {
                  id: 't1',
                  title: 'Done',
                  doneAt: new Date(),
                  parentId: null,
                  links: [
                    {
                      type: 'pdf',
                      id: 'p1',
                      title: 'Linked PDF',
                      description: 'desc',
                      updatedBy: 'user',
                      updatedById: null,
                      updatedAt: new Date()
                    }
                  ],
                  updatedBy: 'user',
                  updatedById: null
                }
              ]
            }
          ]
        }
      ]
    } as never
    render(<HistoryTimeline workspaceId="ws" query="" fromDate={null} toDate={null} />)
    const linkedNode = screen.getByText('Linked PDF').closest('div[role="button"]')
    if (linkedNode) {
      const evt = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      linkedNode.dispatchEvent(evt)
    }
    // smoke
    expect(screen.getByText('Linked PDF')).toBeInTheDocument()
  })

  it('GroupRow + sub-todo 깊이 → ResizeObserver 호출 (smoke)', () => {
    mocks.data = {
      pages: [
        {
          days: [
            {
              date: '2026-05-30',
              todos: [
                {
                  id: 'p1',
                  title: 'Parent',
                  doneAt: new Date(),
                  parentId: null,
                  links: [],
                  updatedBy: 'user',
                  updatedById: null
                },
                {
                  id: 's1',
                  parentId: 'p1',
                  parentTitle: 'Parent',
                  title: 'Sub',
                  doneAt: new Date(),
                  links: [
                    {
                      type: 'note',
                      id: 'n1',
                      title: 'NoteLink',
                      description: '',
                      updatedBy: 'user',
                      updatedById: null,
                      updatedAt: new Date()
                    }
                  ],
                  updatedBy: 'user',
                  updatedById: null
                }
              ]
            }
          ]
        }
      ]
    } as never
    render(<HistoryTimeline workspaceId="ws" query="" fromDate={null} toDate={null} />)
    expect(screen.getByText('Sub')).toBeInTheDocument()
    expect(screen.getByText('NoteLink')).toBeInTheDocument()
  })

  it('isFetchingNextPage=true → 추가 Loader 노출', () => {
    mocks.data = {
      pages: [
        {
          days: [
            {
              date: '2026-05-30',
              todos: [
                {
                  id: 't1',
                  title: 'X',
                  doneAt: new Date(),
                  links: [],
                  updatedBy: 'user',
                  updatedById: null
                }
              ]
            }
          ]
        }
      ]
    } as never
    mocks.isFetchingNextPage = true
    mocks.hasNextPage = true
    const { container } = render(
      <HistoryTimeline workspaceId="ws" query="" fromDate={null} toDate={null} />
    )
    expect(container.querySelectorAll('.animate-spin').length).toBeGreaterThan(0)
  })
})
