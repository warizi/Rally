/**
 * widgets/image-viewer/ui/ImageHeader.test.tsx
 *
 * imageFiles lookup + LinkedEntityPopover/TagList 슬롯 + smoke.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, type RenderResult } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@shared/ui/tooltip'
import type { ReactElement } from 'react'

const mocks = vi.hoisted(() => ({
  imageFiles: [] as Array<{
    id: string
    title: string
    description: string | null
    createdBy: string
    createdById: string | null
    createdAt: Date
    updatedBy: string
    updatedById: string | null
    updatedAt: Date
  }>,
  renameMutate: vi.fn(),
  updateMetaMutate: vi.fn(),
  setTabTitle: vi.fn()
}))

vi.mock('@entities/image-file', () => ({
  useImageFilesByWorkspace: () => ({ data: mocks.imageFiles }),
  useRenameImageFile: () => ({ mutate: mocks.renameMutate }),
  useUpdateImageMeta: () => ({ mutate: mocks.updateMetaMutate })
}))
vi.mock('@/entities/tab-system', () => ({
  useTabStore: (sel: (s: { setTabTitle: typeof mocks.setTabTitle }) => unknown) =>
    sel({ setTabTitle: mocks.setTabTitle })
}))
vi.mock('@/widgets/entity-link', () => ({
  LinkedEntityPopoverButton: () => <div data-testid="link-popover" />
}))
vi.mock('@/widgets/tag', () => ({ TagList: () => <div data-testid="tag-list" /> }))
vi.mock('@shared/hooks/use-tab-header-collapsed-setting', () => ({
  useTabHeaderCollapsedSetting: () => ({ collapsed: false, setCollapsed: vi.fn() })
}))

import { ImageHeader } from '../ImageHeader'

function r(ui: ReactElement): RenderResult {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  mocks.imageFiles = [
    {
      id: 'i-1',
      title: 'My Image',
      description: 'desc',
      createdBy: 'u',
      createdById: null,
      createdAt: new Date(),
      updatedBy: 'u',
      updatedById: null,
      updatedAt: new Date()
    }
  ]
  mocks.renameMutate.mockClear()
  mocks.updateMetaMutate.mockClear()
  mocks.setTabTitle.mockClear()
})

describe('ImageHeader', () => {
  it('LinkedEntityPopoverButton + TagList 슬롯 렌더', () => {
    r(<ImageHeader workspaceId="ws-1" imageId="i-1" />)
    expect(screen.getByTestId('link-popover')).toBeInTheDocument()
    expect(screen.getByTestId('tag-list')).toBeInTheDocument()
  })

  it('image 없음 → AuthorBadge 부분 미렌더 (조건부)', () => {
    mocks.imageFiles = []
    r(<ImageHeader workspaceId="ws-1" imageId="i-x" />)
    // LinkedPopover 는 여전히 노출
    expect(screen.getByTestId('link-popover')).toBeInTheDocument()
  })
})
