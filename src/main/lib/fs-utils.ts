import fs from 'fs'
import path from 'path'

// --- 통합 인터페이스 ---
export interface FileEntry {
  name: string // 파일명 (확장자 포함, "note.md")
  relativePath: string // '/' 구분자 ("docs/note.md")
}

// 기존 타입별 인터페이스는 FileEntry의 alias로 유지 (호출부 변경 없음)
export type MdFileEntry = FileEntry
export type CsvFileEntry = FileEntry
export type PdfFileEntry = FileEntry
export type ImageFileEntry = FileEntry

// --- 제네릭 내부 함수 (export하지 않음) ---

/**
 * 파일 재귀 탐색 (동기)
 * 숨김 파일·디렉토리(.으로 시작), 심볼릭 링크 제외
 */
function readFilesRecursive(
  absBase: string,
  parentRel: string,
  matcher: (name: string) => boolean
): FileEntry[] {
  const absDir = parentRel ? path.join(absBase, parentRel) : absBase
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true })
  } catch {
    return []
  }

  const result: FileEntry[] = []
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    if (entry.name.startsWith('.')) continue

    const rel = parentRel ? `${parentRel}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      result.push(...readFilesRecursive(absBase, rel, matcher))
    } else if (entry.isFile() && matcher(entry.name)) {
      result.push({ name: entry.name, relativePath: rel })
    }
  }
  return result
}

/**
 * 파일 비동기 재귀 탐색
 * fs.promises.readdir 사용 → 이벤트 루프를 블로킹하지 않음
 * workspace-watcher의 reconciliation에서 사용
 */
async function readFilesRecursiveAsync(
  absBase: string,
  parentRel: string,
  matcher: (name: string) => boolean
): Promise<FileEntry[]> {
  const absDir = parentRel ? path.join(absBase, parentRel) : absBase
  let entries: fs.Dirent[]
  try {
    entries = await fs.promises.readdir(absDir, { withFileTypes: true })
  } catch {
    return []
  }

  const result: FileEntry[] = []
  const subdirPromises: Promise<FileEntry[]>[] = []
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    if (entry.name.startsWith('.')) continue

    const rel = parentRel ? `${parentRel}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      subdirPromises.push(readFilesRecursiveAsync(absBase, rel, matcher))
    } else if (entry.isFile() && matcher(entry.name)) {
      result.push({ name: entry.name, relativePath: rel })
    }
  }

  const subResults = await Promise.all(subdirPromises)
  return result.concat(...subResults)
}

// --- 기존 export 함수 (wrapper) ---

export const readMdFilesRecursive = (abs: string, rel: string): MdFileEntry[] =>
  readFilesRecursive(abs, rel, (n) => n.endsWith('.md'))

export const readMdFilesRecursiveAsync = (abs: string, rel: string): Promise<MdFileEntry[]> =>
  readFilesRecursiveAsync(abs, rel, (n) => n.endsWith('.md'))

export const readCsvFilesRecursive = (abs: string, rel: string): CsvFileEntry[] =>
  readFilesRecursive(abs, rel, (n) => n.endsWith('.csv'))

export const readCsvFilesRecursiveAsync = (abs: string, rel: string): Promise<CsvFileEntry[]> =>
  readFilesRecursiveAsync(abs, rel, (n) => n.endsWith('.csv'))

export const readPdfFilesRecursive = (abs: string, rel: string): PdfFileEntry[] =>
  readFilesRecursive(abs, rel, (n) => n.endsWith('.pdf'))

export const readPdfFilesRecursiveAsync = (abs: string, rel: string): Promise<PdfFileEntry[]> =>
  readFilesRecursiveAsync(abs, rel, (n) => n.endsWith('.pdf'))

export const readImageFilesRecursive = (abs: string, rel: string): ImageFileEntry[] =>
  readFilesRecursive(abs, rel, isImageFile)

export const readImageFilesRecursiveAsync = (abs: string, rel: string): Promise<ImageFileEntry[]> =>
  readFilesRecursiveAsync(abs, rel, isImageFile)

// ─── Image helpers ────────────────────────────────────

export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg']

export function isImageFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  return IMAGE_EXTENSIONS.includes(ext)
}

// ─── Name conflict ────────────────────────────────────

/**
 * 이름 충돌 해결: "name (1)", "name (2)", ...
 * 노트의 경우 desiredName에 .md 포함하여 전달:
 *   resolveNameConflict(parentAbs, '새로운 노트.md') → '새로운 노트 (1).md'
 *
 * 알고리즘:
 *   - treatAsFolder=true → suffix를 항상 끝에 붙임 (폴더 이름에 `.`가 있어도 분리하지 않음)
 *   - 그 외 이름에 확장자가 있으면 (예: "foo.md") → suffix를 확장자 앞에 삽입
 *   - 그 외 확장자가 없으면 → suffix를 끝에 붙임
 */
export function resolveNameConflict(
  parentAbs: string,
  desiredName: string,
  options: { treatAsFolder?: boolean } = {}
): string {
  const extMatch = options.treatAsFolder ? null : desiredName.match(/^(.*?)(\.[^.]+)$/)
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
