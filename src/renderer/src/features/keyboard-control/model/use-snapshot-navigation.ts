/**
 * 탭 스냅샷 전환 hook — `cmd + shift` (유지) + `s` (클릭).
 *
 * 키맵 근거: `s` = snapshot mnemonic. macOS 브라우저 표준 `cmd+shift+t`
 * (닫은 탭 복원) 와 의미 충돌을 피하기 위해 `s` 사용.
 *
 * Lifecycle:
 * - 첫 s keydown: 현재 workspace 의 스냅샷 목록 캡처 → snapshot-nav-store.start
 *   (focusIndex = 0). 모드 = 'snapshot-nav'
 * - 이후 s keydown: next() — focusIndex 순환
 * - modifier 해제: focusIndex 스냅샷 apply → close() + mode clear
 */
import { useRef } from 'react'
import { useTabSnapshots, type TabSnapshot } from '@entities/tab-snapshot'
import { useCurrentWorkspaceStore } from '@/shared/store/current-workspace'
import { applyTabSnapshot } from '@/features/tab-snapshot/manage-tab-snapshot'
import { useGlobalHotkey } from './use-global-hotkey'
import { useKeyboardModeStore } from './keyboard-mode-store'
import { useSnapshotNavStore, type SnapshotNavItem } from './snapshot-nav-store'

export function useSnapshotNavigation(): void {
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId) ?? ''
  const { data: snapshots = [] } = useTabSnapshots(workspaceId)
  const setMode = useKeyboardModeStore((s) => s.setMode)
  const clearMode = useKeyboardModeStore((s) => s.clearMode)

  // ref 로 항상 최신 snapshots 캐싱 — onKeyDown / onDeactivate 클로저 stale 방지.
  const snapshotsRef = useRef<TabSnapshot[]>(snapshots)
  snapshotsRef.current = snapshots

  useGlobalHotkey({
    modifiers: { meta: true, shift: true },
    onKeyDown: (e) => {
      // 'KeyS' 으로 비교하면 한글 IME / 대소문자 차이 무시 가능.
      if (e.code !== 'KeyS') return
      e.preventDefault()
      const { open } = useSnapshotNavStore.getState()
      if (!open) {
        const items: SnapshotNavItem[] = snapshotsRef.current.map((s) => ({
          snapshotId: s.id,
          name: s.name,
          description: s.description
        }))
        if (items.length === 0) return
        useSnapshotNavStore.getState().start(items, 0)
        setMode('snapshot-nav')
      } else {
        useSnapshotNavStore.getState().next()
      }
    },
    onDeactivate: () => {
      const { open, focusIndex } = useSnapshotNavStore.getState()
      if (open) {
        const target = snapshotsRef.current[focusIndex]
        if (target) applyTabSnapshot(target)
      }
      useSnapshotNavStore.getState().close()
      clearMode('snapshot-nav')
    }
  })
}
