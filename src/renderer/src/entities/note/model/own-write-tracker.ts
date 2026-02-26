/** 자체 저장 중인 noteId 추적 — watcher 이벤트와 구분하기 위해 사용 */
const pendingWrites = new Set<string>()

export function markAsOwnWrite(noteId: string): void {
  pendingWrites.add(noteId)
  // IPC 왕복 + chokidar 지연을 고려해 2초 후 자동 해제
  setTimeout(() => pendingWrites.delete(noteId), 2000)
}

export function isOwnWrite(noteId: string): boolean {
  return pendingWrites.has(noteId)
}
