/**
 * widgets/dashboard/ui/RecentCanvasCard.test.tsx
 *
 * useCanvasesByWorkspace mock + 최신순 5개 + click → openTab.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  canvases: [] as Array<{ id: string; title: string; updatedAt: Date; description: string | null }>,
  openTab: vi.fn()
}))

vi.mock('@entities/canvas', () => ({
  useCanvasesByWorkspace: () => ({ data: mocks.canvases, isLoading: false })
}))
vi.mock('@/entities/tab-system', () => ({
  useTabStore: (sel: (s: { openTab: typeof mocks.openTab }) => unknown) =>
    sel({ openTab: mocks.openTab })
}))

import { RecentCanvasCard } from '../RecentCanvasCard'

beforeEach(() => {
  mocks.canvases = []
  mocks.openTab.mockClear()
})

describe('RecentCanvasCard', () => {
  it('빈 목록 → "캔버스가 없습니다" + 캔버스 만들기 버튼', () => {
    render(<RecentCanvasCard workspaceId="ws-1" />)
    expect(screen.getByText('캔버스가 없습니다')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '캔버스 만들기' })).toBeInTheDocument()
  })

  it('canvas 클릭 → openTab(canvas-detail)', () => {
    mocks.canvases = [{ id: 'cv1', title: 'My Canvas', updatedAt: new Date(), description: null }]
    render(<RecentCanvasCard workspaceId="ws-1" />)
    fireEvent.click(screen.getByText('My Canvas'))
    expect(mocks.openTab).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'canvas-detail', title: 'My Canvas' })
    )
  })

  it('description 있으면 노출', () => {
    mocks.canvases = [
      {
        id: 'cv1',
        title: 'CV',
        updatedAt: new Date(),
        description: '캔버스 설명입니다'
      }
    ]
    render(<RecentCanvasCard workspaceId="ws-1" />)
    expect(screen.getByText('캔버스 설명입니다')).toBeInTheDocument()
  })

  it('최신순 정렬 + 최대 5개', () => {
    const old = new Date('2026-01-01')
    const newD = new Date('2026-05-01')
    mocks.canvases = Array.from({ length: 7 }, (_, i) => ({
      id: `cv${i}`,
      title: `Title ${i}`,
      updatedAt: i === 0 ? old : newD,
      description: null
    }))
    render(<RecentCanvasCard workspaceId="ws-1" />)
    // 첫 번째 (가장 오래된 cv0) 은 잘려야 함
    expect(screen.queryByText('Title 0')).not.toBeInTheDocument()
    // 나머지 일부는 노출
    expect(screen.getByText('Title 1')).toBeInTheDocument()
  })

  it('"모두 보기" 클릭 → openTab(canvas)', () => {
    mocks.canvases = [{ id: 'cv1', title: 'X', updatedAt: new Date(), description: null }]
    render(<RecentCanvasCard workspaceId="ws-1" />)
    fireEvent.click(screen.getByRole('button', { name: '모두 보기' }))
    expect(mocks.openTab).toHaveBeenCalledWith(expect.objectContaining({ type: 'canvas' }))
  })

  it('canvas 개수 Badge 노출', () => {
    mocks.canvases = Array.from({ length: 3 }, (_, i) => ({
      id: `cv${i}`,
      title: `T${i}`,
      updatedAt: new Date(),
      description: null
    }))
    render(<RecentCanvasCard workspaceId="ws-1" />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})
