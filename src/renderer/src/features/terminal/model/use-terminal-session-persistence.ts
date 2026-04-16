import { useEffect, useRef } from 'react'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { useTerminalStore } from './store'
import { useTerminalPanelStore } from '../terminal-panel-store'

// 워크스페이스 전환 시 모든 세션 스냅샷 DB 저장
async function saveAllSnapshots(): Promise<void> {
  const { sessions } = useTerminalStore.getState()
  await Promise.all(
    Object.values(sessions)
      .filter((s) => s.screenSnapshot != null)
      .map((s) => window.api.terminal.saveSnapshot(s.id, s.screenSnapshot!))
  )
}

// DB 세션 목록 → 스토어 + PTY 생성
// 복원 시: 기존 DB row.id를 terminal:create에 넘겨 PTY와 DB가 동일 ID 공유
async function loadAndApplySessions(workspaceId: string): Promise<void> {
  const res = await window.api.terminal.getSessions(workspaceId)
  if (!res.success || !res.data) return

  const rows = res.data
  if (rows.length === 0) {
    // 첫 방문: 워크스페이스 기본 경로로 세션 1개 신규 생성
    const wsRes = await window.api.workspace.getById(workspaceId)
    if (!wsRes.success || !wsRes.data) return
    const cwd = wsRes.data.path

    const res2 = await window.api.terminal.create({ workspaceId, cwd, cols: 80, rows: 24 })
    if (!res2.success || !res2.data) return

    useTerminalStore.getState().addSession({
      id: res2.data.id,
      name: 'zsh',
      cwd,
      shell: 'zsh',
      rows: 24,
      cols: 80,
      screenSnapshot: null,
      sortOrder: 0
    })
    return
  }

  // 기존 세션 복원: row.id를 id로 전달 → PTY 서비스가 동일 ID로 등록
  for (const row of rows) {
    const ptRes = await window.api.terminal.create({
      workspaceId,
      cwd: row.cwd,
      shell: row.shell,
      cols: row.cols,
      rows: row.rows,
      id: row.id
    })
    if (!ptRes.success || !ptRes.data) continue

    useTerminalStore.getState().addSession({
      id: row.id,
      name: row.name,
      cwd: row.cwd,
      shell: row.shell,
      rows: row.rows,
      cols: row.cols,
      screenSnapshot: row.screenSnapshot,
      sortOrder: row.sortOrder
    })
  }
}

let initialized = false

export function useTerminalSessionPersistence(): void {
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId)
  const prevWorkspaceIdRef = useRef<string | null>(null)

  // 워크스페이스 전환 처리
  useEffect(() => {
    if (!workspaceId) return

    const prevId = prevWorkspaceIdRef.current

    const handleSwitch = async (): Promise<void> => {
      if (prevId && prevId !== workspaceId && initialized) {
        await saveAllSnapshots()
        await window.api.terminal.destroyAll(prevId)
        useTerminalStore.getState().reset()
        // 기존 TerminalPanel.tsx 동작과 동일: 워크스페이스 전환 시 패널도 리셋
        useTerminalPanelStore.getState().reset()
      }

      await loadAndApplySessions(workspaceId)
      prevWorkspaceIdRef.current = workspaceId
      initialized = true
    }

    handleSwitch()
  }, [workspaceId])

  // 앱 종료 시 스냅샷 플러시 (fire-and-forget)
  useEffect(() => {
    const flush = (): void => {
      saveAllSnapshots()
    }
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, [])
}
