/** Windows '\' → '/' 정규화 */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/')
}

/** relativePath에서 부모 디렉토리 relative path 추출 ("folder/note.md" → "folder") */
export function parentRelPath(relativePath: string): string | null {
  const parts = relativePath.split('/')
  if (parts.length <= 1) return null
  return parts.slice(0, -1).join('/')
}
