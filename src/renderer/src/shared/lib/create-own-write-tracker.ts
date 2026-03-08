/** 자체 저장 추적기 팩토리 — watcher 이벤트와 구분하기 위해 사용 */
export function createOwnWriteTracker(timeoutMs = 2000): {
  markAsOwnWrite(id: string): void
  isOwnWrite(id: string): boolean
} {
  const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>()

  return {
    markAsOwnWrite(id: string): void {
      const prev = pendingWrites.get(id)
      if (prev) clearTimeout(prev)
      const timer = setTimeout(() => pendingWrites.delete(id), timeoutMs)
      pendingWrites.set(id, timer)
    },
    isOwnWrite(id: string): boolean {
      return pendingWrites.has(id)
    }
  }
}
