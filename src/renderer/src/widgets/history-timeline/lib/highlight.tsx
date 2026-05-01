import { JSX } from 'react'

/** 검색어 매칭 부분을 mark로 감싸 하이라이트 (case-insensitive) */
export function HighlightText({
  text,
  query
}: {
  text: string
  query: string
}): JSX.Element | string {
  if (!query) return text
  const q = query.trim()
  if (!q) return text
  const lower = text.toLowerCase()
  const queryLower = q.toLowerCase()
  const idx = lower.indexOf(queryLower)
  if (idx < 0) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 dark:bg-yellow-800/60 rounded px-0.5 text-foreground">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  )
}
