import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

export type AuthorKind = 'user' | 'ai'

export function formatAuthor(by: AuthorKind, byId: string | null): string {
  if (by === 'user') return '사용자'
  return byId ? `AI (${byId})` : 'AI'
}

export function formatAuthorRelativeTime(at: Date | string | number): string {
  const date = at instanceof Date ? at : new Date(at)
  return formatDistanceToNow(date, { locale: ko, addSuffix: true })
}

export function formatAuthorTooltip(
  by: AuthorKind,
  byId: string | null,
  at?: Date | string | number,
  action: 'created' | 'updated' = 'updated'
): string {
  const author = formatAuthor(by, byId)
  if (!at) return author
  const relative = formatAuthorRelativeTime(at)
  const verb = action === 'created' ? '생성' : '수정'
  return `${author}가 ${relative} ${verb}`
}
