/** 자체 저장 중인 csvId 추적 — watcher 이벤트와 구분하기 위해 사용 */
const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>()

export function markAsOwnWrite(csvId: string): void {
  const prev = pendingWrites.get(csvId)
  if (prev) clearTimeout(prev)
  const timer = setTimeout(() => pendingWrites.delete(csvId), 2000)
  pendingWrites.set(csvId, timer)
}

export function isOwnWrite(csvId: string): boolean {
  return pendingWrites.has(csvId)
}
