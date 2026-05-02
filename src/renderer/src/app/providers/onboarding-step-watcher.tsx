import { useEffect } from 'react'
import { useNotesByWorkspace } from '@entities/note'
import { useTodosByWorkspace } from '@entities/todo'
import { useTags } from '@entities/tag'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { useOnboardingStore } from '@shared/store/onboarding'

/**
 * 데이터 카운트 기반 체크리스트 step 자동 감지.
 * 액션 기반 step (canvas_node / link_items / connect_ai / view_trash) 은
 * 각 mutation onSuccess 또는 페이지 useEffect 에서 직접 markChecklistStep 호출.
 */
export function OnboardingStepWatcher(): null {
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId)
  const hydrated = useOnboardingStore((s) => s.hydrated)
  const markStep = useOnboardingStore((s) => s.markChecklistStep)

  const { data: notes = [] } = useNotesByWorkspace(workspaceId ?? '')
  const { data: todos = [] } = useTodosByWorkspace(workspaceId ?? null)
  const { data: tags = [] } = useTags(workspaceId ?? undefined)

  useEffect(() => {
    if (!hydrated) return
    if (notes.length > 0) markStep('first_note').catch(console.error)
  }, [hydrated, notes.length, markStep])

  useEffect(() => {
    if (!hydrated) return
    if (todos.length > 0) markStep('first_todo').catch(console.error)
  }, [hydrated, todos.length, markStep])

  useEffect(() => {
    if (!hydrated) return
    if (tags.length > 0) markStep('add_tag').catch(console.error)
  }, [hydrated, tags.length, markStep])

  return null
}
