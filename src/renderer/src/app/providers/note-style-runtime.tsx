import { useRuntimeNoteStyles } from '@shared/styles/use-runtime-note-styles'

/**
 * 앱 root 에 한 번 마운트되어, `<style id="rally-note-styles">` 를 동적으로 관리한다.
 *
 * - `useNoteStyle` (React Query) 의존이므로 QueryClientProvider 하위에 위치해야 한다.
 * - 렌더링은 없으며, 사이드이펙트만 수행.
 */
export function NoteStyleRuntime(): null {
  useRuntimeNoteStyles()
  return null
}
