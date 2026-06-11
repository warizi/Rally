import fs from 'fs'
import path from 'path'

// --- 통합 인터페이스 ---
export interface FileEntry {
  name: string // 파일명 (확장자 포함, "note.md")
  relativePath: string // '/' 구분자 ("docs/note.md")
}

// ─── 경로 정규화 (R-06) ────────────────────────────────────────
// macOS 는 NFD(자소 분해) 파일명이 유입될 수 있다 (Finder·HFS+ 디스크·마이그레이션).
// DB·이벤트·스캔 전 구간에서 NFC 로 통일해 바이트 단위 경로 비교 실패를 막는다.

/** 유니코드 NFC 정규화 — 모든 relativePath 는 이 형태로 저장·비교한다 */
export function toNfc(s: string): string {
  return s.normalize('NFC')
}

/** 워크스페이스 절대경로 → '/' 구분 NFC relativePath */
export function toWorkspaceRel(workspaceAbs: string, absPath: string): string {
  return toNfc(path.relative(workspaceAbs, absPath).replace(/\\/g, '/'))
}

/** rel 경로의 어느 세그먼트든 '.' 으로 시작하면 숨김 취급 (R-08 — 스캔과 이벤트 필터 통일) */
export function isHiddenRelPath(rel: string): boolean {
  return rel.split('/').some((seg) => seg.startsWith('.'))
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

    const name = toNfc(entry.name)
    const rel = parentRel ? `${parentRel}/${name}` : name
    if (entry.isDirectory()) {
      result.push(...readFilesRecursive(absBase, rel, matcher))
    } else if (entry.isFile() && matcher(name)) {
      result.push({ name, relativePath: rel })
    }
  }
  return result
}

/**
 * 파일 비동기 재귀 탐색
 * fs.promises.readdir 사용 → 이벤트 루프를 블로킹하지 않음
 * workspace-watcher의 reconciliation에서 사용
 *
 * onError: readdir 실패(권한 거부·EMFILE·미마운트 등)를 호출부에 알린다.
 * 반환값은 기존과 동일하게 "읽을 수 있었던 항목"만 — 단, onError 가 한 번이라도
 * 불렸다면 결과가 불완전하므로 호출부는 이를 삭제 판단에 쓰면 안 된다 (R-02).
 */
async function readFilesRecursiveAsync(
  absBase: string,
  parentRel: string,
  matcher: (name: string) => boolean,
  onError?: (err: unknown) => void
): Promise<FileEntry[]> {
  const absDir = parentRel ? path.join(absBase, parentRel) : absBase
  let entries: fs.Dirent[]
  try {
    entries = await fs.promises.readdir(absDir, { withFileTypes: true })
  } catch (err) {
    onError?.(err)
    return []
  }

  const result: FileEntry[] = []
  const subdirPromises: Promise<FileEntry[]>[] = []
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    if (entry.name.startsWith('.')) continue

    const name = toNfc(entry.name)
    const rel = parentRel ? `${parentRel}/${name}` : name
    if (entry.isDirectory()) {
      subdirPromises.push(readFilesRecursiveAsync(absBase, rel, matcher, onError))
    } else if (entry.isFile() && matcher(name)) {
      result.push({ name, relativePath: rel })
    }
  }

  const subResults = await Promise.all(subdirPromises)
  return result.concat(...subResults)
}

// ─── 단일 패스 워크스페이스 스캐너 (P1) ────────────────────────

export interface WorkspaceScan {
  /** 모든 디렉토리 (relativePath 오름차순 아님 — 발견 순) */
  folders: FileEntry[]
  /** 모든 파일 — 타입 필터링은 호출부(matchExtension/skipFilter) 책임 */
  files: FileEntry[]
  /** readdir 실패 수집 — 비어있지 않으면 결과가 불완전하므로 삭제 판단 금지 (R-02) */
  errors: unknown[]
}

/**
 * 폴더+파일을 한 번의 순회로 수집한다.
 * - 동시성 제한 워커 큐: 무제한 Promise.all fan-out 의 fd 고갈(EMFILE)을 방지 (R-02)
 * - 숨김(.)·심볼릭 링크 제외, NFC 정규화 — 기존 read*RecursiveAsync 와 동일 규칙
 * - 기존 "타입별 4회 전체 순회"를 1회로 대체해 lstat/추가 비용을 상쇄
 */
export async function scanWorkspaceAsync(
  absBase: string,
  options: { concurrency?: number } = {}
): Promise<WorkspaceScan> {
  const concurrency = options.concurrency ?? 64
  const folders: FileEntry[] = []
  const files: FileEntry[] = []
  const errors: unknown[] = []
  const queue: string[] = ['']
  let active = 0

  await new Promise<void>((resolve) => {
    const processDir = async (parentRel: string): Promise<void> => {
      const absDir = parentRel ? path.join(absBase, parentRel) : absBase
      let entries: fs.Dirent[]
      try {
        entries = await fs.promises.readdir(absDir, { withFileTypes: true })
      } catch (err) {
        errors.push(err)
        return
      }
      for (const entry of entries) {
        if (entry.isSymbolicLink()) continue
        if (entry.name.startsWith('.')) continue
        const name = toNfc(entry.name)
        const rel = parentRel ? `${parentRel}/${name}` : name
        if (entry.isDirectory()) {
          folders.push({ name, relativePath: rel })
          queue.push(rel)
        } else if (entry.isFile()) {
          files.push({ name, relativePath: rel })
        }
      }
    }

    const pump = (): void => {
      if (queue.length === 0 && active === 0) {
        resolve()
        return
      }
      while (active < concurrency && queue.length > 0) {
        const rel = queue.shift()!
        active++
        void processDir(rel).finally(() => {
          active--
          pump()
        })
      }
    }
    pump()
  })

  return { folders, files, errors }
}

// --- 기존 export 함수 (wrapper) ---

/** onError: 하위 디렉토리 readdir 실패 통지 — 전달 시 결과 불완전 여부를 판단할 수 있다 */
export type ScanErrorHandler = (err: unknown) => void

export const readMdFilesRecursive = (abs: string, rel: string): MdFileEntry[] =>
  readFilesRecursive(abs, rel, (n) => n.endsWith('.md'))

export const readMdFilesRecursiveAsync = (
  abs: string,
  rel: string,
  onError?: ScanErrorHandler
): Promise<MdFileEntry[]> => readFilesRecursiveAsync(abs, rel, (n) => n.endsWith('.md'), onError)

export const readCsvFilesRecursive = (abs: string, rel: string): CsvFileEntry[] =>
  readFilesRecursive(abs, rel, (n) => n.endsWith('.csv'))

export const readCsvFilesRecursiveAsync = (
  abs: string,
  rel: string,
  onError?: ScanErrorHandler
): Promise<CsvFileEntry[]> => readFilesRecursiveAsync(abs, rel, (n) => n.endsWith('.csv'), onError)

export const readPdfFilesRecursive = (abs: string, rel: string): PdfFileEntry[] =>
  readFilesRecursive(abs, rel, (n) => n.endsWith('.pdf'))

export const readPdfFilesRecursiveAsync = (
  abs: string,
  rel: string,
  onError?: ScanErrorHandler
): Promise<PdfFileEntry[]> => readFilesRecursiveAsync(abs, rel, (n) => n.endsWith('.pdf'), onError)

export const readImageFilesRecursive = (abs: string, rel: string): ImageFileEntry[] =>
  readFilesRecursive(abs, rel, isImageFile)

export const readImageFilesRecursiveAsync = (
  abs: string,
  rel: string,
  onError?: ScanErrorHandler
): Promise<ImageFileEntry[]> => readFilesRecursiveAsync(abs, rel, isImageFile, onError)

// ─── Image helpers ────────────────────────────────────

export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg']

export function isImageFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  return IMAGE_EXTENSIONS.includes(ext)
}

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml'
}

/** 파일 경로 확장자로 image MIME 추론. 알 수 없으면 application/octet-stream. */
export function getImageMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  return IMAGE_MIME_BY_EXT[ext] ?? 'application/octet-stream'
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
