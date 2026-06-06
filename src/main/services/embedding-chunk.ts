/**
 * 노트 본문(.md)을 임베딩 청크로 분할.
 *
 * 전략:
 * 1) heading(`#`~`######`) 경계로 1차 섹션 분할 — heading은 해당 섹션 컨텍스트로 유지
 * 2) 섹션이 너무 길면 문단(\n\n) 단위로 2차 분할 (대략 문자 길이 기준)
 * 3) 제목 부스팅: 각 청크 앞에 노트 제목 + 상위 heading 경로를 prepend
 * 4) Rally 임베드 구문 `![[domain:id|meta]]` 는 노이즈 → 제거 (링크는 graph edge로 별도 활용)
 *
 * 토큰이 아닌 문자 길이 근사를 사용 (한국어는 토큰≈문자에 가까워 보수적으로 잡음).
 */

export interface NoteChunk {
  index: number
  text: string
}

// e5-small max 512토큰. 한국어/혼합 안전 마진으로 문자 기준 상한을 보수적으로 설정.
const MAX_CHARS = 1200
const EMBED_SYNTAX = /!\[\[[^\]]+\]\]/g
const HEADING_RE = /^(#{1,6})\s+(.*)$/

interface Section {
  headingPath: string[]
  body: string
}

function stripEmbeds(md: string): string {
  return md.replace(EMBED_SYNTAX, ' ')
}

/** heading 경계로 섹션 분할. heading 경로(상위 제목들)를 함께 보존. */
function splitSections(md: string): Section[] {
  const lines = md.split('\n')
  const sections: Section[] = []
  const headingStack: { level: number; text: string }[] = []
  let buffer: string[] = []

  const flush = (): void => {
    const body = buffer.join('\n').trim()
    if (body) {
      sections.push({ headingPath: headingStack.map((h) => h.text), body })
    }
    buffer = []
  }

  for (const line of lines) {
    const m = line.match(HEADING_RE)
    if (m) {
      flush()
      const level = m[1].length
      const text = m[2].trim()
      // 같거나 더 깊은 레벨은 스택에서 제거 후 현재 heading push
      while (headingStack.length && headingStack[headingStack.length - 1].level >= level) {
        headingStack.pop()
      }
      headingStack.push({ level, text })
    } else {
      buffer.push(line)
    }
  }
  flush()
  return sections
}

/** 긴 본문을 문단 단위로 MAX_CHARS 이하 조각으로 묶는다. */
function packParagraphs(body: string): string[] {
  if (body.length <= MAX_CHARS) return [body]
  const paras = body.split(/\n{2,}/)
  const out: string[] = []
  let cur = ''
  for (const p of paras) {
    if (!cur) {
      cur = p
    } else if (cur.length + p.length + 2 <= MAX_CHARS) {
      cur = `${cur}\n\n${p}`
    } else {
      out.push(cur)
      cur = p
    }
    // 단일 문단이 상한을 넘으면 강제로 잘라 넣는다.
    while (cur.length > MAX_CHARS) {
      out.push(cur.slice(0, MAX_CHARS))
      cur = cur.slice(MAX_CHARS)
    }
  }
  if (cur.trim()) out.push(cur)
  return out
}

/**
 * 노트를 임베딩용 청크 배열로 변환.
 * @param title 노트 제목 (제목 부스팅에 사용)
 * @param content 노트 본문 마크다운
 */
export function chunkNote(title: string, content: string): NoteChunk[] {
  const cleaned = stripEmbeds(content || '')
  const sections = splitSections(cleaned)

  const chunks: NoteChunk[] = []
  let index = 0
  for (const section of sections) {
    const pieces = packParagraphs(section.body)
    for (const piece of pieces) {
      // 제목 부스팅: [노트제목 > 상위heading] 본문
      const pathLabel = [title, ...section.headingPath].filter(Boolean).join(' > ')
      const text = pathLabel ? `[${pathLabel}] ${piece}` : piece
      chunks.push({ index: index++, text: text.trim() })
    }
  }

  // 본문이 비어 제목만 있는 경우에도 검색되도록 제목 청크 1개 생성.
  if (chunks.length === 0 && title.trim()) {
    chunks.push({ index: 0, text: title.trim() })
  }
  return chunks
}

/**
 * 짧은 엔티티(todo/schedule/csv/canvas)용 단일 청크 텍스트 조립.
 * 빈 필드는 제외하고 합친다.
 */
export function composeShortText(parts: (string | null | undefined)[]): string {
  return parts
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join('\n')
}
