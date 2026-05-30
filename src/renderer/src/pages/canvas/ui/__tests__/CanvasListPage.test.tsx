/**
 * pages/canvas/ui/CanvasListPage.test.tsx
 *
 * empty / 검색 / 카드 클릭 → openTab.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, type RenderResult } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@shared/ui/tooltip'
import type { ReactElement } from 'react'

const mocks = vi.hoisted(() => ({
  workspaceId: 'ws-1' as string | null,
  canvases: [] as Array<{
    id: string
    title: string
    updatedBy: string
    updatedById: string | null
    updatedAt: Date
  }>,
  isLoading: false,
  createMutate: vi.fn(),
  openTab: vi.fn(),
  closeTabByPathname: vi.fn(),
  navigateTab: vi.fn(),
  tabs: {} as Record<string, { searchParams?: Record<string, string> }>,
  pane: { id: 'main' } as { id: string } | undefined
}))

vi.mock('@shared/store/current-workspace', () => ({
  useCurrentWorkspaceStore: (sel: (s: { currentWorkspaceId: string | null }) => unknown) =>
    sel({ currentWorkspaceId: mocks.workspaceId })
}))
vi.mock('@/entities/tab-system', () => ({
  useTabStore: (sel: unknown) => {
    if (typeof sel === 'function') {
      return (sel as (s: unknown) => unknown)({
        openTab: mocks.openTab,
        closeTabByPathname: mocks.closeTabByPathname,
        navigateTab: mocks.navigateTab,
        tabs: mocks.tabs
      })
    }
    return undefined
  },
  selectPaneByTabId: () => () => mocks.pane
}))
vi.mock('@entities/canvas', () => ({
  useCanvasesByWorkspace: () => ({ data: mocks.canvases, isLoading: mocks.isLoading }),
  useCreateCanvas: () => ({ mutate: mocks.createMutate, isPending: false })
}))
vi.mock('@/widgets/entity-link', () => ({
  PanePickerSubmenu: () => <div data-testid="pane-picker" />
}))
vi.mock('@features/canvas/create-canvas/ui/CreateCanvasDialog', () => ({
  CreateCanvasDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="create-dialog" /> : null
}))
vi.mock('@features/canvas/delete-canvas/ui/DeleteCanvasDialog', () => ({
  DeleteCanvasDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="delete-dialog" /> : null
}))

import { CanvasListPage } from '../CanvasListPage'

function r(ui: ReactElement): RenderResult {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  mocks.workspaceId = 'ws-1'
  mocks.canvases = []
  mocks.isLoading = false
  mocks.createMutate.mockClear()
  mocks.openTab.mockClear()
  mocks.closeTabByPathname.mockClear()
  mocks.navigateTab.mockClear()
  mocks.tabs = {}
  mocks.pane = { id: 'main' }
})

describe('CanvasListPage', () => {
  it('빈 목록 + isLoading=false → "캔버스가 없습니다"', () => {
    r(<CanvasListPage />)
    expect(screen.getByText('캔버스가 없습니다')).toBeInTheDocument()
  })

  it('isLoading=true → "캔버스가 없습니다" 미노출', () => {
    mocks.isLoading = true
    r(<CanvasListPage />)
    expect(screen.queryByText('캔버스가 없습니다')).not.toBeInTheDocument()
  })

  it('canvases 있음 → 제목 노출', () => {
    mocks.canvases = [
      { id: 'cv-1', title: 'My Canvas', updatedBy: 'u', updatedById: null, updatedAt: new Date() }
    ]
    r(<CanvasListPage />)
    expect(screen.getByText('My Canvas')).toBeInTheDocument()
  })

  it('canvas 카드 클릭 → openTab(canvas-detail)', () => {
    mocks.canvases = [
      { id: 'cv-1', title: 'X', updatedBy: 'u', updatedById: null, updatedAt: new Date() }
    ]
    r(<CanvasListPage />)
    fireEvent.click(screen.getByText('X'))
    expect(mocks.openTab).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'canvas-detail', title: 'X' }),
      'main'
    )
  })

  it('"새 캔버스" 버튼 클릭 → CreateCanvasDialog 노출', () => {
    r(<CanvasListPage />)
    fireEvent.click(screen.getByRole('button', { name: /새 캔버스/ }))
    expect(screen.getByTestId('create-dialog')).toBeInTheDocument()
  })

  it('검색 입력 → state 갱신 (placeholder/value 동기화)', () => {
    r(<CanvasListPage />)
    const input = screen.getByPlaceholderText('캔버스 검색...')
    fireEvent.change(input, { target: { value: 'foo' } })
    expect(input).toHaveValue('foo')
  })

  it('여러 캔버스 → 모두 노출', () => {
    mocks.canvases = [
      { id: 'cv-1', title: 'Canvas A', updatedBy: 'u', updatedById: null, updatedAt: new Date() },
      { id: 'cv-2', title: 'Canvas B', updatedBy: 'u', updatedById: null, updatedAt: new Date() },
      { id: 'cv-3', title: 'Canvas C', updatedBy: 'u', updatedById: null, updatedAt: new Date() }
    ]
    r(<CanvasListPage />)
    expect(screen.getByText('Canvas A')).toBeInTheDocument()
    expect(screen.getByText('Canvas B')).toBeInTheDocument()
    expect(screen.getByText('Canvas C')).toBeInTheDocument()
  })

  it('debounced 검색 → query 변경 후 250ms 후 적용 (smoke)', () => {
    mocks.canvases = [
      { id: 'cv-1', title: 'Apple', updatedBy: 'u', updatedById: null, updatedAt: new Date() },
      { id: 'cv-2', title: 'Banana', updatedBy: 'u', updatedById: null, updatedAt: new Date() }
    ]
    r(<CanvasListPage />)
    const input = screen.getByPlaceholderText('캔버스 검색...')
    fireEvent.change(input, { target: { value: 'apple' } })
    // 둘 다 처음에는 노출 (debounce 적용 전)
    expect(input).toHaveValue('apple')
  })

  it('workspaceId=null → 안내 메시지 (smoke 렌더)', () => {
    mocks.workspaceId = null
    r(<CanvasListPage />)
    // 안내 메시지: 캔버스가 없습니다 (workspaceId null 이라 useQuery 비활성화 → data=[])
    expect(screen.getByText('캔버스가 없습니다')).toBeInTheDocument()
  })
})
