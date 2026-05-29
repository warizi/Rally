/**
 * pages/trash/ui/TrashPage.test.tsx
 *
 * workspace 분기 + isLoading / empty / 항목 리스트 + 복구/영구삭제 mutation.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, type RenderResult } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@shared/ui/tooltip'
import type { ReactElement } from 'react'

const mocks = vi.hoisted(() => ({
  workspaceId: 'ws-1' as string | null,
  batches: [] as Array<{
    id: string
    rootEntityType: string
    rootTitle: string
    deletedAt: string
    childCount: number
  }>,
  isLoading: false,
  restoreMutate: vi.fn(),
  purgeMutate: vi.fn(),
  emptyMutate: vi.fn(),
  markStep: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@shared/store/current-workspace', () => ({
  useCurrentWorkspaceStore: (sel: (s: { currentWorkspaceId: string | null }) => unknown) =>
    sel({ currentWorkspaceId: mocks.workspaceId })
}))
vi.mock('@shared/store/onboarding', () => {
  // Zustand-like callable: useOnboardingStore(selector) + useOnboardingStore.getState()
  const store = (sel?: (s: { tipsShown: string[] }) => unknown): unknown =>
    sel ? sel({ tipsShown: [] }) : undefined
  ;(store as unknown as { getState: () => unknown }).getState = () => ({
    markChecklistStep: mocks.markStep,
    tipsShown: [],
    markTipShown: vi.fn()
  })
  return { useOnboardingStore: store }
})
vi.mock('@entities/trash', () => ({
  useTrashList: () => ({
    data: { batches: mocks.batches },
    isLoading: mocks.isLoading
  }),
  trashKindLabel: (k: string) => k
}))
vi.mock('@features/trash', () => ({
  useRestoreTrash: () => ({ mutate: mocks.restoreMutate, isPending: false }),
  usePurgeTrash: () => ({ mutate: mocks.purgeMutate, isPending: false }),
  useEmptyTrash: () => ({ mutate: mocks.emptyMutate, isPending: false })
}))

import { TrashPage } from '../TrashPage'

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
  mocks.batches = []
  mocks.isLoading = false
  mocks.restoreMutate.mockClear()
  mocks.purgeMutate.mockClear()
  mocks.emptyMutate.mockClear()
  mocks.markStep.mockClear().mockResolvedValue(undefined)
})

describe('TrashPage', () => {
  it('workspaceId 없음 → 안내 문구', () => {
    mocks.workspaceId = null
    r(<TrashPage />)
    expect(screen.getByText('워크스페이스를 선택해주세요')).toBeInTheDocument()
  })

  it('mount 시 markChecklistStep("view_trash") 호출', () => {
    r(<TrashPage />)
    expect(mocks.markStep).toHaveBeenCalledWith('view_trash')
  })

  it('isLoading=true → "불러오는 중…"', () => {
    mocks.isLoading = true
    r(<TrashPage />)
    expect(screen.getByText('불러오는 중…')).toBeInTheDocument()
  })

  it('isEmpty → "휴지통이 비어있습니다"', () => {
    r(<TrashPage />)
    expect(screen.getByText('휴지통이 비어있습니다')).toBeInTheDocument()
  })

  it('batches 있음 → 항목 노출 + 복구 버튼', () => {
    mocks.batches = [
      {
        id: 'b-1',
        rootEntityType: 'note',
        rootTitle: 'Note title',
        deletedAt: new Date().toISOString(),
        childCount: 0
      }
    ]
    r(<TrashPage />)
    expect(screen.getByText('Note title')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /복구/ })).toBeInTheDocument()
  })

  it('복구 클릭 → restoreM.mutate({workspaceId, batchId})', () => {
    mocks.batches = [
      {
        id: 'b-1',
        rootEntityType: 'note',
        rootTitle: 'X',
        deletedAt: new Date().toISOString(),
        childCount: 0
      }
    ]
    r(<TrashPage />)
    fireEvent.click(screen.getByRole('button', { name: /복구/ }))
    expect(mocks.restoreMutate).toHaveBeenCalledWith({ workspaceId: 'ws-1', batchId: 'b-1' })
  })

  it('childCount > 0 → "하위 N개" 노출', () => {
    mocks.batches = [
      {
        id: 'b-1',
        rootEntityType: 'folder',
        rootTitle: 'F',
        deletedAt: new Date().toISOString(),
        childCount: 5
      }
    ]
    r(<TrashPage />)
    expect(screen.getByText('하위 5개')).toBeInTheDocument()
  })

  it('빈 batches → "전체 비우기" 버튼 disabled', () => {
    r(<TrashPage />)
    expect(screen.getByRole('button', { name: /전체 비우기/ })).toBeDisabled()
  })

  it('rootTitle 빈값 → "(제목 없음)" fallback', () => {
    mocks.batches = [
      {
        id: 'b-1',
        rootEntityType: 'note',
        rootTitle: '',
        deletedAt: new Date().toISOString(),
        childCount: 0
      }
    ]
    r(<TrashPage />)
    expect(screen.getByText('(제목 없음)')).toBeInTheDocument()
  })
})
