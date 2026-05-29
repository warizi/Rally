/**
 * widgets/dashboard/ui/FileOverviewCard.test.tsx
 *
 * csv/pdf/image 3종 entity hook mock + 합계 0 일 때 empty / 아니면 3섹션 + 클릭.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  csv: [] as Array<{ id: string; title: string; createdAt: Date }>,
  pdf: [] as Array<{ id: string; title: string; createdAt: Date }>,
  image: [] as Array<{ id: string; title: string; createdAt: Date }>,
  openTab: vi.fn()
}))

vi.mock('@entities/csv-file', () => ({
  useCsvFilesByWorkspace: () => ({ data: mocks.csv, isLoading: false })
}))
vi.mock('@entities/pdf-file', () => ({
  usePdfFilesByWorkspace: () => ({ data: mocks.pdf, isLoading: false })
}))
vi.mock('@entities/image-file', () => ({
  useImageFilesByWorkspace: () => ({ data: mocks.image, isLoading: false })
}))
vi.mock('@/entities/tab-system', () => ({
  useTabStore: (sel: (s: { openTab: typeof mocks.openTab }) => unknown) =>
    sel({ openTab: mocks.openTab })
}))

import { FileOverviewCard } from '../FileOverviewCard'

beforeEach(() => {
  mocks.csv = []
  mocks.pdf = []
  mocks.image = []
  mocks.openTab.mockClear()
})

describe('FileOverviewCard', () => {
  it('파일 모두 0 → "파일이 없습니다" + 탐색기 열기', () => {
    render(<FileOverviewCard workspaceId="ws-1" />)
    expect(screen.getByText('파일이 없습니다')).toBeInTheDocument()
  })

  it('각 도메인 개수 노출', () => {
    mocks.csv = [{ id: 'c1', title: 'a.csv', createdAt: new Date() }]
    mocks.pdf = [{ id: 'p1', title: 'b.pdf', createdAt: new Date() }]
    mocks.image = [
      { id: 'i1', title: 'c.png', createdAt: new Date() },
      { id: 'i2', title: 'd.png', createdAt: new Date() }
    ]
    render(<FileOverviewCard workspaceId="ws-1" />)
    expect(screen.getByText('CSV')).toBeInTheDocument()
    expect(screen.getByText('PDF')).toBeInTheDocument()
    expect(screen.getByText('이미지')).toBeInTheDocument()
    // 각 도메인 카운트
    expect(screen.getByText('a.csv')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('csv 파일 클릭 → openTab(csv)', () => {
    mocks.csv = [{ id: 'c1', title: 'x.csv', createdAt: new Date() }]
    render(<FileOverviewCard workspaceId="ws-1" />)
    fireEvent.click(screen.getByText('x.csv'))
    expect(mocks.openTab).toHaveBeenCalledWith(expect.objectContaining({ type: 'csv' }))
  })

  it('탐색기 버튼 → openTab(folder)', () => {
    mocks.csv = [{ id: 'c', title: 'x', createdAt: new Date() }]
    render(<FileOverviewCard workspaceId="ws-1" />)
    fireEvent.click(screen.getByRole('button', { name: '탐색기' }))
    expect(mocks.openTab).toHaveBeenCalledWith(expect.objectContaining({ type: 'folder' }))
  })
})
