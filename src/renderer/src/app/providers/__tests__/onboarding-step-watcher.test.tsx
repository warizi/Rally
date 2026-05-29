/**
 * app/providers/onboarding-step-watcher.test.tsx
 *
 * notes/todos/tags length > 0 시 markChecklistStep 호출.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  notes: [] as unknown[],
  todos: [] as unknown[],
  tags: [] as unknown[],
  hydrated: true,
  workspaceId: 'ws-1' as string | null,
  markStep: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@entities/note', () => ({
  useNotesByWorkspace: () => ({ data: mocks.notes })
}))
vi.mock('@entities/todo', () => ({
  useTodosByWorkspace: () => ({ data: mocks.todos })
}))
vi.mock('@entities/tag', () => ({
  useTags: () => ({ data: mocks.tags })
}))
vi.mock('@shared/store/current-workspace', () => ({
  useCurrentWorkspaceStore: (sel: (s: { currentWorkspaceId: string | null }) => unknown) =>
    sel({ currentWorkspaceId: mocks.workspaceId })
}))
vi.mock('@shared/store/onboarding', () => ({
  useOnboardingStore: (
    sel: (s: { hydrated: boolean; markChecklistStep: typeof mocks.markStep }) => unknown
  ) => sel({ hydrated: mocks.hydrated, markChecklistStep: mocks.markStep })
}))

import { OnboardingStepWatcher } from '../onboarding-step-watcher'

beforeEach(() => {
  mocks.notes = []
  mocks.todos = []
  mocks.tags = []
  mocks.hydrated = true
  mocks.workspaceId = 'ws-1'
  mocks.markStep.mockClear().mockResolvedValue(undefined)
})

describe('OnboardingStepWatcher', () => {
  it('null 컴포넌트 (UI 미렌더)', () => {
    const { container } = render(<OnboardingStepWatcher />)
    expect(container.firstChild).toBeNull()
  })

  it('hydrated=false → markStep 호출 안 함', () => {
    mocks.hydrated = false
    mocks.notes = [{ id: 'n1' }]
    render(<OnboardingStepWatcher />)
    expect(mocks.markStep).not.toHaveBeenCalled()
  })

  it('notes > 0 → first_note 호출', () => {
    mocks.notes = [{ id: 'n1' }]
    render(<OnboardingStepWatcher />)
    expect(mocks.markStep).toHaveBeenCalledWith('first_note')
  })

  it('todos > 0 → first_todo 호출', () => {
    mocks.todos = [{ id: 't1' }]
    render(<OnboardingStepWatcher />)
    expect(mocks.markStep).toHaveBeenCalledWith('first_todo')
  })

  it('tags > 0 → add_tag 호출', () => {
    mocks.tags = [{ id: 'tag1' }]
    render(<OnboardingStepWatcher />)
    expect(mocks.markStep).toHaveBeenCalledWith('add_tag')
  })

  it('모두 비었음 → markStep 호출 안 함', () => {
    render(<OnboardingStepWatcher />)
    expect(mocks.markStep).not.toHaveBeenCalled()
  })

  it('3종 모두 > 0 → 3번 호출', () => {
    mocks.notes = [{ id: 'n' }]
    mocks.todos = [{ id: 't' }]
    mocks.tags = [{ id: 'tg' }]
    render(<OnboardingStepWatcher />)
    expect(mocks.markStep).toHaveBeenCalledTimes(3)
  })
})
