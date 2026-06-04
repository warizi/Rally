/**
 * Codex (~/.codex/config.toml) 의 MCP 서버 엔트리만 surgical 하게 읽고/쓰는 헬퍼.
 *
 * Codex 는 Claude 와 달리 설정이 TOML 이다. 외부 TOML 의존성을 추가하는 대신,
 * `[mcp_servers.<key>]` + `[mcp_servers.<key>.env]` 테이블 블록만 교체/삭제하여
 * 사용자의 나머지 설정(모델·프로필·주석·포맷)을 그대로 보존한다.
 *
 * Codex 의 stdio MCP 서버 설정 형식:
 *   [mcp_servers.rally]
 *   command = "/path/to/Rally"
 *   args = ["/path/to/dist-mcp/index.js"]
 *
 *   [mcp_servers.rally.env]
 *   ELECTRON_RUN_AS_NODE = "1"
 *   MCP_AUTH_TOKEN = "..."
 *
 * CLI 와 Desktop(IDE 확장) 이 동일한 config.toml 을 공유하므로 한 번 등록하면 둘 다 적용된다.
 */

export interface CodexMcpEntry {
  command: string
  args: string[]
  env: Record<string, string>
}

interface Block {
  /** 점(.)으로 분리된 테이블 경로. 예: ['mcp_servers','rally','env'] */
  segs: string[]
  lines: string[]
}

interface SplitResult {
  preamble: string[]
  blocks: Block[]
}

/** TOML basic-string 직렬화 (역슬래시/따옴표/제어문자 이스케이프) — Windows 경로의 `\` 안전 처리 */
function tomlString(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
  return `"${escaped}"`
}

/** TOML 스칼라 토큰(따옴표 문자열/리터럴/베어)을 평문으로 파싱 */
function parseTomlString(token: string): string {
  const raw = token.trim()
  if (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) {
    return raw
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\')
  }
  if (raw.startsWith("'") && raw.endsWith("'") && raw.length >= 2) {
    // 리터럴 문자열 — 이스케이프 없음
    return raw.slice(1, -1)
  }
  return raw
}

/** 테이블 헤더 라인(`[a.b]`)을 점-분리 세그먼트로. 배열 테이블(`[[...]]`)·비헤더는 null */
function parseHeader(line: string): string[] | null {
  const m = line.match(/^\s*\[([^[\]]+)\]\s*$/)
  if (!m) return null
  const inner = m[1]
  const segs: string[] = []
  let i = 0
  while (i < inner.length) {
    // 선행 공백/점 스킵
    while (i < inner.length && (inner[i] === ' ' || inner[i] === '\t' || inner[i] === '.')) i++
    if (i >= inner.length) break
    const quote = inner[i] === '"' || inner[i] === "'" ? inner[i] : null
    if (quote) {
      i++
      let seg = ''
      while (i < inner.length && inner[i] !== quote) {
        seg += inner[i]
        i++
      }
      i++ // 닫는 따옴표
      segs.push(seg)
    } else {
      let seg = ''
      while (i < inner.length && inner[i] !== '.' && inner[i] !== ' ' && inner[i] !== '\t') {
        seg += inner[i]
        i++
      }
      segs.push(seg)
    }
  }
  return segs.length ? segs : null
}

/** 파일을 preamble(첫 헤더 이전 라인) + 테이블 블록 목록으로 분리 */
function splitBlocks(toml: string): SplitResult {
  const lines = toml.split('\n')
  const preamble: string[] = []
  const blocks: Block[] = []
  let current: Block | null = null
  for (const line of lines) {
    const segs = parseHeader(line)
    if (segs) {
      current = { segs, lines: [line] }
      blocks.push(current)
    } else if (current) {
      current.lines.push(line)
    } else {
      preamble.push(line)
    }
  }
  return { preamble, blocks }
}

function isServerBlock(segs: string[], key: string): boolean {
  return segs[0] === 'mcp_servers' && segs[1] === key
}

function isMainBlock(segs: string[], key: string): boolean {
  return isServerBlock(segs, key) && segs.length === 2
}

function isEnvBlock(segs: string[], key: string): boolean {
  return isServerBlock(segs, key) && segs.length === 3 && segs[2] === 'env'
}

/** 블록 본문에서 `name = <스칼라>` 의 우변 원시 토큰을 추출 */
function findAssignment(lines: string[], name: string): string | null {
  const re = new RegExp(`^\\s*${name}\\s*=\\s*(.+?)\\s*$`)
  for (const line of lines) {
    const m = line.match(re)
    if (m) return m[1]
  }
  return null
}

/** 단일 라인 TOML 문자열 배열 `["a", "b"]` 파싱 (Codex/우리 출력 형식 한정) */
function parseStringArray(token: string): string[] {
  const t = token.trim()
  if (!t.startsWith('[') || !t.endsWith(']')) return []
  const inner = t.slice(1, -1).trim()
  if (!inner) return []
  const out: string[] = []
  let i = 0
  while (i < inner.length) {
    while (i < inner.length && (inner[i] === ' ' || inner[i] === ',' || inner[i] === '\t')) i++
    if (i >= inner.length) break
    const quote = inner[i] === '"' || inner[i] === "'" ? inner[i] : null
    if (quote) {
      let tok = quote
      i++
      while (i < inner.length) {
        if (inner[i] === '\\' && quote === '"') {
          tok += inner[i] + (inner[i + 1] ?? '')
          i += 2
          continue
        }
        tok += inner[i]
        if (inner[i] === quote) {
          i++
          break
        }
        i++
      }
      out.push(parseTomlString(tok))
    } else {
      let tok = ''
      while (i < inner.length && inner[i] !== ',') {
        tok += inner[i]
        i++
      }
      out.push(parseTomlString(tok))
    }
  }
  return out
}

/** `[mcp_servers.<key>.env]` 서브테이블 라인들에서 환경변수 맵 파싱 */
function parseEnvTable(lines: string[]): Record<string, string> {
  const env: Record<string, string> = {}
  for (const line of lines) {
    const m = line.match(/^\s*([A-Za-z0-9_-]+|"[^"]+"|'[^']+')\s*=\s*(.+?)\s*$/)
    if (!m) continue
    const key = parseTomlString(m[1])
    env[key] = parseTomlString(m[2])
  }
  return env
}

/** 인라인 테이블 `env = { A = "1", B = "2" }` 파싱 (서브테이블이 없을 때 폴백) */
function parseInlineEnv(token: string): Record<string, string> {
  const env: Record<string, string> = {}
  const t = token.trim()
  if (!t.startsWith('{') || !t.endsWith('}')) return env
  const inner = t.slice(1, -1)
  for (const part of inner.split(',')) {
    const m = part.match(/^\s*([A-Za-z0-9_-]+|"[^"]+"|'[^']+')\s*=\s*(.+?)\s*$/)
    if (!m) continue
    env[parseTomlString(m[1])] = parseTomlString(m[2])
  }
  return env
}

/** 엔트리를 TOML 텍스트로 직렬화 (끝에 개행 없음) */
export function serializeEntry(key: string, entry: CodexMcpEntry): string {
  const header = `mcp_servers.${key}`
  const lines: string[] = [`[${header}]`]
  lines.push(`command = ${tomlString(entry.command)}`)
  lines.push(`args = [${entry.args.map(tomlString).join(', ')}]`)
  const envKeys = Object.keys(entry.env)
  if (envKeys.length) {
    lines.push('')
    lines.push(`[${header}.env]`)
    for (const k of envKeys) {
      lines.push(`${k} = ${tomlString(entry.env[k])}`)
    }
  }
  return lines.join('\n')
}

/** config.toml 텍스트에서 `<key>` MCP 서버 엔트리를 읽는다. 없으면 null */
export function readEntry(toml: string, key: string): CodexMcpEntry | null {
  const { blocks } = splitBlocks(toml)
  const main = blocks.find((b) => isMainBlock(b.segs, key))
  if (!main) return null

  const commandTok = findAssignment(main.lines, 'command')
  const argsTok = findAssignment(main.lines, 'args')
  const command = commandTok ? parseTomlString(commandTok) : ''
  const args = argsTok ? parseStringArray(argsTok) : []

  const envBlock = blocks.find((b) => isEnvBlock(b.segs, key))
  let env: Record<string, string> = {}
  if (envBlock) {
    env = parseEnvTable(envBlock.lines.slice(1))
  } else {
    const inlineTok = findAssignment(main.lines, 'env')
    if (inlineTok) env = parseInlineEnv(inlineTok)
  }

  return { command, args, env }
}

/** `<key>` 의 main + .env 블록을 모두 제거한 새 텍스트 반환 (나머지 보존) */
export function removeEntry(toml: string, key: string): string {
  const { preamble, blocks } = splitBlocks(toml)
  const kept = blocks.filter((b) => !isServerBlock(b.segs, key))
  const lines = [...preamble, ...kept.flatMap((b) => b.lines)]
  return lines.join('\n')
}

/** `<key>` 엔트리를 삽입/교체한 새 텍스트 반환 (기존 동일 키는 제거 후 말미에 추가) */
export function upsertEntry(toml: string, key: string, entry: CodexMcpEntry): string {
  const cleaned = removeEntry(toml, key).replace(/\s*$/, '')
  const block = serializeEntry(key, entry)
  if (cleaned === '') return `${block}\n`
  return `${cleaned}\n\n${block}\n`
}
