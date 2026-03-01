/** 자체 저장 중인 pdfId 추적 — watcher 이벤트와 구분하기 위해 사용 */
const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>()

export function markAsOwnWrite(pdfId: string): void {
  const prev = pendingWrites.get(pdfId)
  if (prev) clearTimeout(prev)
  const timer = setTimeout(() => pendingWrites.delete(pdfId), 2000)
  pendingWrites.set(pdfId, timer)
}

export function isOwnWrite(pdfId: string): boolean {
  return pendingWrites.has(pdfId)
}
