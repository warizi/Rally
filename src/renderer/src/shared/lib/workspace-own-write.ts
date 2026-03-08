/**
 * 워크스페이스 레벨 자체 변경 추적
 * 앱 내부에서 파일시스템을 변경할 때 표시 → folder watcher가 외부 변경으로 오인하지 않도록 방지
 */
const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>()

export function markWorkspaceOwnWrite(workspaceId: string): void {
  const prev = pendingWrites.get(workspaceId)
  if (prev) clearTimeout(prev)
  const timer = setTimeout(() => pendingWrites.delete(workspaceId), 2000)
  pendingWrites.set(workspaceId, timer)
}

export function isWorkspaceOwnWrite(workspaceId: string): boolean {
  return pendingWrites.has(workspaceId)
}
