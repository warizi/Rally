/**
 * features/image/view-image/ui/ImageViewer.test.tsx
 *
 * imageData 비었음 → 안내 텍스트. 있음 → TransformWrapper + img + Toolbar.
 * IMAGE_EXTERNAL_CHANGED_EVENT 발생 시 invalidateQueries 호출.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn()
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries })
}))

vi.mock('react-zoom-pan-pinch', () => ({
  TransformWrapper: ({
    children
  }: {
    children: (props: {
      zoomIn: () => void
      zoomOut: () => void
      resetTransform: () => void
    }) => React.ReactNode
  }) => (
    <div data-testid="transform-wrapper">
      {children({ zoomIn: vi.fn(), zoomOut: vi.fn(), resetTransform: vi.fn() })}
    </div>
  ),
  TransformComponent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="transform-component">{children}</div>
  )
}))

vi.mock('@entities/image-file', () => ({
  IMAGE_EXTERNAL_CHANGED_EVENT: 'image-external-changed'
}))

vi.mock('../ImageToolbar', () => ({
  ImageToolbar: ({ scale }: { scale: number }) => (
    <div data-testid="image-toolbar">scale:{scale}</div>
  )
}))

import { ImageViewer } from '../ImageViewer'

beforeEach(() => {
  mocks.invalidateQueries.mockReset()
  global.URL.createObjectURL = vi.fn(() => 'blob:mock')
  global.URL.revokeObjectURL = vi.fn()
})

describe('ImageViewer', () => {
  it('imageData 빈 ArrayBuffer → 안내 메시지', () => {
    render(<ImageViewer imageId="i1" imageData={new ArrayBuffer(0)} title="X" />)
    expect(screen.getByText('이미지를 불러올 수 없습니다.')).toBeInTheDocument()
  })

  it('imageData 있음 → TransformWrapper + img 렌더', () => {
    render(<ImageViewer imageId="i1" imageData={new ArrayBuffer(10)} title="My Image" />)
    expect(screen.getByTestId('transform-wrapper')).toBeInTheDocument()
    const img = screen.getByAltText('My Image') as HTMLImageElement
    expect(img.src).toBe('blob:mock')
  })

  it('ImageToolbar 렌더 + scale 0인 초기값 → scale state', () => {
    render(<ImageViewer imageId="i1" imageData={new ArrayBuffer(10)} title="X" />)
    expect(screen.getByTestId('image-toolbar')).toHaveTextContent('scale:1')
  })

  it('IMAGE_EXTERNAL_CHANGED_EVENT (matching id) → invalidateQueries', () => {
    render(<ImageViewer imageId="i1" imageData={new ArrayBuffer(10)} title="X" />)
    act(() => {
      window.dispatchEvent(new CustomEvent('image-external-changed', { detail: { imageId: 'i1' } }))
    })
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['image', 'content', 'i1']
    })
  })

  it('IMAGE_EXTERNAL_CHANGED_EVENT (다른 id) → invalidateQueries 호출 안 함', () => {
    render(<ImageViewer imageId="i1" imageData={new ArrayBuffer(10)} title="X" />)
    act(() => {
      window.dispatchEvent(
        new CustomEvent('image-external-changed', { detail: { imageId: 'other' } })
      )
    })
    expect(mocks.invalidateQueries).not.toHaveBeenCalled()
  })
})
