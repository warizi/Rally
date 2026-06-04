import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

export type AuthorKind = 'user' | 'ai'

/** byId(= x-mcp-client-name) 에 특정 키워드가 포함되면 친근한 표시명으로 매핑 */
const KNOWN_AI_CLIENTS: { match: string; label: string }[] = [
  { match: 'claude', label: 'Claude' },
  { match: 'codex', label: 'Codex' },
  { match: 'chatgpt', label: 'ChatGPT' },
  { match: 'openai', label: 'OpenAI' }
]

export function formatAuthor(by: AuthorKind, byId: string | null): string {
  if (by === 'user') return '사용자'
  if (!byId) return 'AI'
  const id = byId.toLowerCase()
  const known = KNOWN_AI_CLIENTS.find((c) => id.includes(c.match))
  return known ? known.label : `AI (${byId})`
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
