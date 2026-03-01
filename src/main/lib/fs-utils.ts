import fs from 'fs'
import path from 'path'

export interface MdFileEntry {
  name: string // 파일명 (확장자 포함, "note.md")
  relativePath: string // '/' 구분자 ("docs/note.md")
}

/**
 * .md 파일 재귀 탐색
 * 숨김 파일·디렉토리(.으로 시작), 심볼릭 링크 제외
 */
export function readMdFilesRecursive(absBase: string, parentRel: string): MdFileEntry[] {
  const absDir = parentRel ? path.join(absBase, parentRel) : absBase
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true })
  } catch {
    return []
  }

  const result: MdFileEntry[] = []
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    if (entry.name.startsWith('.')) continue

    if (entry.isDirectory()) {
      const rel = parentRel ? `${parentRel}/${entry.name}` : entry.name
      result.push(...readMdFilesRecursive(absBase, rel))
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const rel = parentRel ? `${parentRel}/${entry.name}` : entry.name
      result.push({ name: entry.name, relativePath: rel })
    }
  }
  return result
}

/**
 * .md 파일 비동기 재귀 탐색
 * fs.promises.readdir 사용 → 이벤트 루프를 블로킹하지 않음
 * workspace-watcher의 reconciliation에서 사용
 */
export async function readMdFilesRecursiveAsync(
  absBase: string,
  parentRel: string
): Promise<MdFileEntry[]> {
  const absDir = parentRel ? path.join(absBase, parentRel) : absBase
  let entries: fs.Dirent[]
  try {
    entries = await fs.promises.readdir(absDir, { withFileTypes: true })
  } catch {
    return []
  }

  const result: MdFileEntry[] = []
  const subdirPromises: Promise<MdFileEntry[]>[] = []

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    if (entry.name.startsWith('.')) continue

    const rel = parentRel ? `${parentRel}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      subdirPromises.push(readMdFilesRecursiveAsync(absBase, rel))
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      result.push({ name: entry.name, relativePath: rel })
    }
  }

  const subResults = await Promise.all(subdirPromises)
  for (const sub of subResults) result.push(...sub)
  return result
}

// ── CSV ──────────────────────────────────────────

export interface CsvFileEntry {
  name: string
  relativePath: string
}

export function readCsvFilesRecursive(absBase: string, parentRel: string): CsvFileEntry[] {
  const absDir = parentRel ? path.join(absBase, parentRel) : absBase
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true })
  } catch {
    return []
  }

  const result: CsvFileEntry[] = []
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    if (entry.name.startsWith('.')) continue
    if (entry.isDirectory()) {
      const rel = parentRel ? `${parentRel}/${entry.name}` : entry.name
      result.push(...readCsvFilesRecursive(absBase, rel))
    } else if (entry.isFile() && entry.name.endsWith('.csv')) {
      const rel = parentRel ? `${parentRel}/${entry.name}` : entry.name
      result.push({ name: entry.name, relativePath: rel })
    }
  }
  return result
}

export async function readCsvFilesRecursiveAsync(
  absBase: string,
  parentRel: string
): Promise<CsvFileEntry[]> {
  const absDir = parentRel ? path.join(absBase, parentRel) : absBase
  let entries: fs.Dirent[]
  try {
    entries = await fs.promises.readdir(absDir, { withFileTypes: true })
  } catch {
    return []
  }

  const result: CsvFileEntry[] = []
  const subDirPromises: Promise<CsvFileEntry[]>[] = []
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    if (entry.name.startsWith('.')) continue
    if (entry.isDirectory()) {
      const rel = parentRel ? `${parentRel}/${entry.name}` : entry.name
      subDirPromises.push(readCsvFilesRecursiveAsync(absBase, rel))
    } else if (entry.isFile() && entry.name.endsWith('.csv')) {
      const rel = parentRel ? `${parentRel}/${entry.name}` : entry.name
      result.push({ name: entry.name, relativePath: rel })
    }
  }
  const subResults = await Promise.all(subDirPromises)
  return result.concat(...subResults)
}

// ── PDF ─────────────────────────────────────────

export interface PdfFileEntry {
  name: string
  relativePath: string
}

export function readPdfFilesRecursive(absBase: string, parentRel: string): PdfFileEntry[] {
  const absDir = parentRel ? path.join(absBase, parentRel) : absBase
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true })
  } catch {
    return []
  }

  const result: PdfFileEntry[] = []
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    if (entry.name.startsWith('.')) continue
    if (entry.isDirectory()) {
      const rel = parentRel ? `${parentRel}/${entry.name}` : entry.name
      result.push(...readPdfFilesRecursive(absBase, rel))
    } else if (entry.isFile() && entry.name.endsWith('.pdf')) {
      const rel = parentRel ? `${parentRel}/${entry.name}` : entry.name
      result.push({ name: entry.name, relativePath: rel })
    }
  }
  return result
}

export async function readPdfFilesRecursiveAsync(
  absBase: string,
  parentRel: string
): Promise<PdfFileEntry[]> {
  const absDir = parentRel ? path.join(absBase, parentRel) : absBase
  let entries: fs.Dirent[]
  try {
    entries = await fs.promises.readdir(absDir, { withFileTypes: true })
  } catch {
    return []
  }

  const result: PdfFileEntry[] = []
  const subDirPromises: Promise<PdfFileEntry[]>[] = []
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    if (entry.name.startsWith('.')) continue
    if (entry.isDirectory()) {
      const rel = parentRel ? `${parentRel}/${entry.name}` : entry.name
      subDirPromises.push(readPdfFilesRecursiveAsync(absBase, rel))
    } else if (entry.isFile() && entry.name.endsWith('.pdf')) {
      const rel = parentRel ? `${parentRel}/${entry.name}` : entry.name
      result.push({ name: entry.name, relativePath: rel })
    }
  }
  const subResults = await Promise.all(subDirPromises)
  return result.concat(...subResults)
}

/**
 * 이름 충돌 해결: "name (1)", "name (2)", ...
 * 노트의 경우 desiredName에 .md 포함하여 전달:
 *   resolveNameConflict(parentAbs, '새로운 노트.md') → '새로운 노트 (1).md'
 *
 * 알고리즘:
 *   - 이름에 확장자가 있으면 (예: "foo.md") → suffix를 확장자 앞에 삽입
 *   - 이름에 확장자가 없으면 (폴더용) → suffix를 끝에 붙임
 */
export function resolveNameConflict(parentAbs: string, desiredName: string): string {
  const extMatch = desiredName.match(/^(.*?)(\.[^.]+)$/)
  const base = extMatch ? extMatch[1] : desiredName
  const ext = extMatch ? extMatch[2] : ''

  let name = desiredName
  let n = 1
  while (true) {
    try {
      fs.accessSync(path.join(parentAbs, name))
      // 존재함 → suffix 증가
      name = `${base} (${n})${ext}`
      n++
    } catch {
      // 접근 불가 = 존재하지 않음 → 사용 가능
      return name
    }
  }
}
