/**
 * widgets/canvas/ui/node-content/ImageNodeContent.test.tsx
 *
 * isLoading / data 없음 / 성공 + title fallback (imageFiles → refTitle).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  workspaceId: 'ws-1' as string | null,
  data: undefined as { data: ArrayBuffer } | undefined,
  isLoading: false,
  imageFiles: [] as Array<{ id: string; title: string }>
}))

vi.mock('@shared/store/current-workspace', () => ({
  useCurrentWorkspaceStore: (sel: (s: { currentWorkspaceId: string | null }) => unknown) =>
    sel({ currentWorkspaceId: mocks.workspaceId })
}))
vi.mock('@entities/image-file', () => ({
  useReadImageContent: () => ({ data: mocks.data, isLoading: mocks.isLoading }),
  useImageFilesByWorkspace: () => ({ data: mocks.imageFiles })
}))
vi.mock('@features/image/view-image', () => ({
  ImageViewer: ({ title }: { title: string }) => (
    <div data-testid="image-viewer" data-title={title} />
  )
}))

import { ImageNodeContent } from '../ImageNodeContent'
import type { NodeContentProps } from '../../../model/node-content-registry'

beforeEach(() => {
  mocks.workspaceId = 'ws-1'
  mocks.data = { data: new ArrayBuffer(8) }
  mocks.isLoading = false
  mocks.imageFiles = []
})

describe('ImageNodeContent', () => {
  it('isLoading → 메시지', () => {
    mocks.isLoading = true
    render(<ImageNodeContent {...({ refId: 'i-1' } as unknown as NodeContentProps)} />)
    expect(screen.getByText('불러오는 중...')).toBeInTheDocument()
  })

  it('data 없음 → "이미지를 불러올 수 없습니다."', () => {
    mocks.data = undefined
    render(<ImageNodeContent {...({ refId: 'i-1' } as unknown as NodeContentProps)} />)
    expect(screen.getByText('이미지를 불러올 수 없습니다.')).toBeInTheDocument()
  })

  it('imageFiles 에서 title 찾음', () => {
    mocks.imageFiles = [{ id: 'i-1', title: 'My Image' }]
    render(<ImageNodeContent {...({ refId: 'i-1' } as unknown as NodeContentProps)} />)
    expect(screen.getByTestId('image-viewer')).toHaveAttribute('data-title', 'My Image')
  })

  it('imageFiles 에 없음 → refTitle fallback', () => {
    mocks.imageFiles = []
    render(
      <ImageNodeContent
        {...({ refId: 'i-1', refTitle: 'Fallback' } as unknown as NodeContentProps)}
      />
    )
    expect(screen.getByTestId('image-viewer')).toHaveAttribute('data-title', 'Fallback')
  })
})
