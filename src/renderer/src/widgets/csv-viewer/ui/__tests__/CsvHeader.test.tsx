/**
 * widgets/csv-viewer/ui/CsvHeader.test.tsx
 *
 * 제목/설명 노출 + encoding 표시 + isCsvEffectivelyEmpty 분기.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, type RenderResult } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@shared/ui/tooltip'
import type { ReactElement } from 'react'

const mocks = vi.hoisted(() => ({
  csv: undefined as
    | undefined
    | {
        id: string
        title: string
        description: string | null
        createdBy: string
        createdById: string | null
        createdAt: Date
        updatedBy: string
        updatedById: string | null
        updatedAt: Date
      },
  content: '' as string,
  columnWidths: null as string | null,
  renameMutate: vi.fn(),
  updateMetaMutate: vi.fn(),
  writeContentMutate: vi.fn(),
  setTabTitle: vi.fn()
}))

vi.mock('@entities/csv-file', () => ({
  useCsvFilesByWorkspace: () => ({ data: mocks.csv ? [mocks.csv] : [] }),
  useReadCsvContent: () => ({
    data: mocks.csv ? { content: mocks.content, columnWidths: mocks.columnWidths } : undefined
  }),
  useRenameCsvFile: () => ({ mutate: mocks.renameMutate }),
  useUpdateCsvMeta: () => ({ mutate: mocks.updateMetaMutate }),
  useWriteCsvContent: () => ({ mutate: mocks.writeContentMutate })
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
vi.mock('@/widgets/template', () => ({
  TemplateButton: ({ hasContent }: { hasContent: boolean }) => (
    <div data-testid="template-button" data-has={String(hasContent)} />
  )
}))
vi.mock('@shared/hooks/use-tab-header-collapsed-setting', () => ({
  useTabHeaderCollapsedSetting: () => ({ collapsed: false, setCollapsed: vi.fn() })
}))

import { CsvHeader } from '../CsvHeader'

function r(ui: ReactElement): RenderResult {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  mocks.csv = {
    id: 'csv-1',
    title: 'My CSV',
    description: 'description',
    createdBy: 'u',
    createdById: null,
    createdAt: new Date(),
    updatedBy: 'u',
    updatedById: null,
    updatedAt: new Date()
  }
  mocks.content = 'header1,header2\nval1,val2\n'
  mocks.columnWidths = null
  mocks.renameMutate.mockClear()
  mocks.updateMetaMutate.mockClear()
  mocks.writeContentMutate.mockClear()
  mocks.setTabTitle.mockClear()
})

describe('CsvHeader', () => {
  it('csv 정보 + TemplateButton/LinkPopover/TagList 렌더 (smoke)', () => {
    r(<CsvHeader workspaceId="ws-1" csvId="csv-1" />)
    expect(screen.getByTestId('template-button')).toBeInTheDocument()
    expect(screen.getByTestId('link-popover')).toBeInTheDocument()
    expect(screen.getByTestId('tag-list')).toBeInTheDocument()
  })

  it('encoding prop 있으면 노출', () => {
    r(<CsvHeader workspaceId="ws-1" csvId="csv-1" encoding="UTF-8" />)
    expect(screen.getByText('UTF-8')).toBeInTheDocument()
  })

  it('encoding 없으면 미노출', () => {
    r(<CsvHeader workspaceId="ws-1" csvId="csv-1" />)
    expect(screen.queryByText('UTF-8')).not.toBeInTheDocument()
  })

  it('데이터 있음 → TemplateButton hasContent=true', () => {
    r(<CsvHeader workspaceId="ws-1" csvId="csv-1" />)
    expect(screen.getByTestId('template-button')).toHaveAttribute('data-has', 'true')
  })

  it('빈 데이터 (헤더만) → hasContent=false', () => {
    mocks.content = 'h1,h2'
    r(<CsvHeader workspaceId="ws-1" csvId="csv-1" />)
    expect(screen.getByTestId('template-button')).toHaveAttribute('data-has', 'false')
  })

  it('cell 모두 비어있는 행 → hasContent=false', () => {
    mocks.content = 'h1,h2\n  ,  \n'
    r(<CsvHeader workspaceId="ws-1" csvId="csv-1" />)
    expect(screen.getByTestId('template-button')).toHaveAttribute('data-has', 'false')
  })

  it('csv null → 제목 빈값', () => {
    mocks.csv = undefined
    r(<CsvHeader workspaceId="ws-1" csvId="csv-1" />)
    // 제목은 ''
    expect(screen.queryByText('My CSV')).not.toBeInTheDocument()
  })
})
