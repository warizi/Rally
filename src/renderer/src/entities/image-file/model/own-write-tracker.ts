const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>()

export function markAsOwnWrite(imageId: string): void {
  const prev = pendingWrites.get(imageId)
  if (prev) clearTimeout(prev)
  const timer = setTimeout(() => pendingWrites.delete(imageId), 2000)
  pendingWrites.set(imageId, timer)
}

export function isOwnWrite(imageId: string): boolean {
  return pendingWrites.has(imageId)
}
