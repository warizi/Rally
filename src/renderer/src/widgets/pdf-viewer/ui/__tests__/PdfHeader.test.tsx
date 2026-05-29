/**
 * widgets/pdf-viewer/ui/PdfHeader.test.tsx
 *
 * ImageHeader 와 동일 패턴.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, type RenderResult } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@shared/ui/tooltip'
import type { ReactElement } from 'react'

const mocks = vi.hoisted(() => ({
  pdfFiles: [] as Array<{
    id: string
    title: string
    description: string | null
    createdBy: string
    createdById: string | null
    createdAt: Date
    updatedBy: string
    updatedById: string | null
    updatedAt: Date
  }>
}))

vi.mock('@entities/pdf-file', () => ({
  usePdfFilesByWorkspace: () => ({ data: mocks.pdfFiles }),
  useRenamePdfFile: () => ({ mutate: vi.fn() }),
  useUpdatePdfMeta: () => ({ mutate: vi.fn() })
}))
vi.mock('@/entities/tab-system', () => ({
  useTabStore: (sel: (s: { setTabTitle: () => void }) => unknown) => sel({ setTabTitle: vi.fn() })
}))
vi.mock('@/widgets/entity-link', () => ({
  LinkedEntityPopoverButton: () => <div data-testid="link-popover" />
}))
vi.mock('@/widgets/tag', () => ({ TagList: () => <div data-testid="tag-list" /> }))
vi.mock('@shared/hooks/use-tab-header-collapsed-setting', () => ({
  useTabHeaderCollapsedSetting: () => ({ collapsed: false, setCollapsed: vi.fn() })
}))

import { PdfHeader } from '../PdfHeader'

function r(ui: ReactElement): RenderResult {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  mocks.pdfFiles = [
    {
      id: 'p-1',
      title: 'My PDF',
      description: '',
      createdBy: 'u',
      createdById: null,
      createdAt: new Date(),
      updatedBy: 'u',
      updatedById: null,
      updatedAt: new Date()
    }
  ]
})

describe('PdfHeader', () => {
  it('LinkPopover + TagList 슬롯 렌더', () => {
    r(<PdfHeader workspaceId="ws-1" pdfId="p-1" />)
    expect(screen.getByTestId('link-popover')).toBeInTheDocument()
    expect(screen.getByTestId('tag-list')).toBeInTheDocument()
  })
})
