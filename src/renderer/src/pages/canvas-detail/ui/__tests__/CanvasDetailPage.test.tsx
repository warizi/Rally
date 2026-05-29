/**
 * pages/canvas-detail/ui/CanvasDetailPage.test.tsx
 *
 * canvasId 없음 → "캔버스를 찾을 수 없습니다" / 정상 → CanvasBoard 렌더.
 * onTitleChange/onDescriptionChange → updateCanvas + setTabTitle.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, type RenderResult } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@shared/ui/tooltip'
import type { ReactElement } from 'react'

const mocks = vi.hoisted(() => ({
  canvas: null as null | {
    id: string
    title: string
    description: string | null
    workspaceId: string
    createdBy: string
    createdById: string | null
    createdAt: Date
    updatedBy: string
    updatedById: string | null
    updatedAt: Date
  },
  isLoading: false,
  updateCanvas: vi.fn(),
  setTabTitle: vi.fn()
}))

vi.mock('@entities/canvas', () => ({
  useCanvasById: () => ({ data: mocks.canvas, isLoading: mocks.isLoading }),
  useUpdateCanvas: () => ({ mutate: mocks.updateCanvas })
}))
vi.mock('@/entities/tab-system', () => ({
  useTabStore: (sel: (s: { setTabTitle: typeof mocks.setTabTitle }) => unknown) =>
    sel({ setTabTitle: mocks.setTabTitle })
}))
vi.mock('@/widgets/entity-link', () => ({
  LinkedEntityPopoverButton: () => <div data-testid="link-popover" />
}))
vi.mock('@/widgets/tag', () => ({
  TagList: () => <div data-testid="tag-list" />
}))
vi.mock('@widgets/canvas/ui/CanvasBoard', () => ({
  CanvasBoard: ({ canvasId }: { canvasId: string }) => (
    <div data-testid="canvas-board" data-cv={canvasId} />
  )
}))

import { CanvasDetailPage } from '../CanvasDetailPage'

function r(ui: ReactElement): RenderResult {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  mocks.canvas = {
    id: 'cv-1',
    title: 'My Canvas',
    description: 'desc',
    workspaceId: 'ws-1',
    createdBy: 'user',
    createdById: null,
    createdAt: new Date('2026-01-01'),
    updatedBy: 'user',
    updatedById: null,
    updatedAt: new Date('2026-01-02')
  }
  mocks.isLoading = false
  mocks.updateCanvas.mockClear()
  mocks.setTabTitle.mockClear()
})

describe('CanvasDetailPage', () => {
  it('canvasId 없음 → "캔버스를 찾을 수 없습니다"', () => {
    r(<CanvasDetailPage params={{}} />)
    expect(screen.getByText('캔버스를 찾을 수 없습니다')).toBeInTheDocument()
  })

  it('canvas 데이터 정상 → CanvasBoard 렌더 + canvasId 전달', () => {
    r(<CanvasDetailPage params={{ canvasId: 'cv-1' }} />)
    expect(screen.getByTestId('canvas-board')).toHaveAttribute('data-cv', 'cv-1')
  })

  it('canvas 데이터 정상 → 링크 popover 버튼 노출', () => {
    r(<CanvasDetailPage params={{ canvasId: 'cv-1' }} />)
    expect(screen.getByTestId('link-popover')).toBeInTheDocument()
    expect(screen.getByTestId('tag-list')).toBeInTheDocument()
  })

  it('canvas 데이터 없음 (loading 중) → CanvasBoard 는 여전히 렌더 (canvasId 있으면)', () => {
    mocks.canvas = null
    mocks.isLoading = true
    r(<CanvasDetailPage params={{ canvasId: 'cv-1' }} />)
    expect(screen.getByTestId('canvas-board')).toBeInTheDocument()
    // LinkedEntityPopoverButton 은 canvas 없으면 미렌더 (undefined buttons)
    expect(screen.queryByTestId('link-popover')).not.toBeInTheDocument()
  })
})
