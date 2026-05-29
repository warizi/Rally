/**
 * pages/image/ui/ImagePage.test.tsx
 *
 * NotePage 와 동일 패턴 — imageId/workspaceId 빈값/loading/error/success.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, type RenderResult } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'

function r(ui: ReactElement): RenderResult {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const mocks = vi.hoisted(() => ({
  workspaceId: 'ws-1' as string | null,
  data: undefined as { data: ArrayBuffer } | undefined,
  isLoading: false,
  isError: false,
  imageFiles: [] as Array<{ id: string; title: string }>,
  setTabError: vi.fn()
}))

vi.mock('@shared/store/current-workspace', () => ({
  useCurrentWorkspaceStore: (sel: (s: { currentWorkspaceId: string | null }) => unknown) =>
    sel({ currentWorkspaceId: mocks.workspaceId })
}))
vi.mock('@entities/image-file', () => ({
  useReadImageContent: () => ({
    data: mocks.data,
    isLoading: mocks.isLoading,
    isError: mocks.isError
  }),
  useImageFilesByWorkspace: () => ({ data: mocks.imageFiles })
}))
vi.mock('@/entities/tab-system', () => ({
  useTabStore: (sel: (s: { setTabError: typeof mocks.setTabError }) => unknown) =>
    sel({ setTabError: mocks.setTabError })
}))
vi.mock('@widgets/image-viewer', () => ({
  ImageHeader: ({ imageId }: { imageId: string }) => (
    <div data-testid="image-header" data-img={imageId} />
  ),
  ImageViewer: ({ title }: { title: string }) => (
    <div data-testid="image-viewer" data-title={title} />
  )
}))

import { ImagePage } from '../ImagePage'

beforeEach(() => {
  mocks.workspaceId = 'ws-1'
  mocks.data = { data: new ArrayBuffer(8) }
  mocks.isLoading = false
  mocks.isError = false
  mocks.imageFiles = []
  mocks.setTabError.mockClear()
})

describe('ImagePage', () => {
  it('imageId 없음 → "이미지 정보가 없습니다"', () => {
    r(<ImagePage params={{}} />)
    expect(screen.getByText('이미지 정보가 없습니다.')).toBeInTheDocument()
  })

  it('isLoading=true → ImageViewer 미렌더', () => {
    mocks.isLoading = true
    r(<ImagePage params={{ imageId: 'i-1' }} />)
    expect(screen.queryByTestId('image-viewer')).not.toBeInTheDocument()
  })

  it('isError + tabId → setTabError', () => {
    mocks.isError = true
    r(<ImagePage tabId="tab-1" params={{ imageId: 'i-1' }} />)
    expect(screen.getByText(/실패/)).toBeInTheDocument()
    expect(mocks.setTabError).toHaveBeenCalledWith('tab-1', true)
  })

  it('성공 → ImageViewer 렌더 + 제목 전달 (imageFiles 에서 찾음)', () => {
    mocks.imageFiles = [{ id: 'i-1', title: 'Sunset.png' }]
    r(<ImagePage params={{ imageId: 'i-1' }} />)
    const viewer = screen.getByTestId('image-viewer')
    expect(viewer).toHaveAttribute('data-title', 'Sunset.png')
  })

  it('성공 + imageFiles 에 없음 → 빈 제목', () => {
    mocks.imageFiles = []
    r(<ImagePage params={{ imageId: 'i-x' }} />)
    expect(screen.getByTestId('image-viewer')).toHaveAttribute('data-title', '')
  })
})
