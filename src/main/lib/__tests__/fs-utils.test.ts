import { describe, expect, it, vi, beforeEach } from 'vitest'
import * as fs from 'fs'
import { readMdFilesRecursive, readMdFilesRecursiveAsync, resolveNameConflict } from '../fs-utils'

// ─── Mock 선언 (vitest 자동 호이스팅) ─────────────────────────
// fs.promises.readdir는 auto-mock 대상이 아니므로 factory로 명시 포함
vi.mock('fs', () => {
  const readdirSync = vi.fn()
  const accessSync = vi.fn()
  const readdir = vi.fn()
  const mod = { readdirSync, accessSync, promises: { readdir } }
  return { ...mod, default: mod }
})

// ─── fs.Dirent mock 헬퍼 (isFile() 필수 포함) ────────────────
function makeDirent(
  name: string,
  opts: { isDir?: boolean; isFile?: boolean; isSymlink?: boolean } = {}
): fs.Dirent {
  const { isDir = false, isFile = !isDir, isSymlink = false } = opts
  return {
    name,
    isSymbolicLink: () => isSymlink,
    isDirectory: () => isDir,
    isFile: () => isFile
  } as unknown as fs.Dirent
}

// ─── readdirSync 타입 헬퍼 ───────────────────────────────────
function setReaddirImpl(fn: (p: fs.PathLike) => fs.Dirent[]): void {
  vi.mocked(fs.readdirSync).mockImplementation(fn as unknown as typeof fs.readdirSync)
}

function setReaddirReturn(entries: fs.Dirent[]): void {
  vi.mocked(fs.readdirSync).mockReturnValue(entries as unknown as ReturnType<typeof fs.readdirSync>)
}

// ─── beforeEach: 기본 mock 설정 ──────────────────────────────
beforeEach(() => {
  vi.clearAllMocks()
  // accessSync 기본: throw ENOENT (이름 사용 가능 = resolveNameConflict에서 충돌 없음)
  vi.mocked(fs.accessSync).mockImplementation(() => {
    throw new Error('ENOENT: no such file or directory')
  })
  setReaddirReturn([])
  // async readdir 기본: 빈 배열 반환 (각 테스트에서 override 가능)
  ;(fs.promises.readdir as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([])
})

// ─── readMdFilesRecursive ─────────────────────────────────────
describe('readMdFilesRecursive', () => {
  it('빈 디렉토리면 빈 배열을 반환한다', () => {
    setReaddirReturn([])
    expect(readMdFilesRecursive('/base', '')).toEqual([])
  })

  it('.md 파일만 수집하고 .txt, .ts는 제외한다', () => {
    setReaddirReturn([makeDirent('note.md'), makeDirent('readme.txt'), makeDirent('index.ts')])
    const result = readMdFilesRecursive('/base', '')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('note.md')
  })

  it('하위 디렉토리를 재귀 탐색하여 relativePath를 올바르게 구성한다', () => {
    setReaddirImpl((dirPath) => {
      if (String(dirPath) === '/base') return [makeDirent('docs', { isDir: true })]
      if (String(dirPath) === '/base/docs') return [makeDirent('note.md')]
      return []
    })
    const result = readMdFilesRecursive('/base', '')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('note.md')
    expect(result[0].relativePath).toBe('docs/note.md')
  })

  it('name은 파일명만, relativePath는 전체 경로를 포함한다', () => {
    setReaddirReturn([makeDirent('my-note.md')])
    const result = readMdFilesRecursive('/base', 'sub')
    expect(result[0].name).toBe('my-note.md')
    expect(result[0].relativePath).toBe('sub/my-note.md')
  })

  it('"." 으로 시작하는 파일을 제외한다', () => {
    setReaddirReturn([makeDirent('.hidden.md')])
    expect(readMdFilesRecursive('/base', '')).toHaveLength(0)
  })

  it('"." 으로 시작하는 디렉토리는 내부를 탐색하지 않는다', () => {
    setReaddirReturn([makeDirent('.git', { isDir: true })])
    const result = readMdFilesRecursive('/base', '')
    expect(result).toHaveLength(0)
    // 루트 1회만 호출 (하위 탐색 없음)
    expect(vi.mocked(fs.readdirSync)).toHaveBeenCalledTimes(1)
  })

  it('심볼릭 링크를 제외한다', () => {
    setReaddirReturn([makeDirent('linked.md', { isSymlink: true })])
    expect(readMdFilesRecursive('/base', '')).toHaveLength(0)
  })

  it('readdirSync가 throw하면 빈 배열을 반환한다 (graceful)', () => {
    setReaddirImpl(() => {
      throw new Error('EACCES: permission denied')
    })
    expect(readMdFilesRecursive('/base', '')).toEqual([])
  })
})

// ─── readMdFilesRecursiveAsync ────────────────────────────────
describe('readMdFilesRecursiveAsync', () => {
  // factory mock의 vi.fn()을 직접 조작 (vi.spyOn 불필요)
  type ReaddirMock = ReturnType<typeof vi.fn>
  const readdirMock = (): ReaddirMock => fs.promises.readdir as unknown as ReaddirMock

  function setReaddirAsyncImpl(fn: (p: fs.PathLike) => Promise<fs.Dirent[]>): void {
    readdirMock().mockImplementation(fn as unknown as (...args: unknown[]) => unknown)
  }

  function setReaddirAsyncReturn(entries: fs.Dirent[]): void {
    readdirMock().mockResolvedValue(
      entries as unknown as Awaited<ReturnType<typeof fs.promises.readdir>>
    )
  }

  it('빈 디렉토리면 빈 배열을 반환한다', async () => {
    setReaddirAsyncReturn([])
    expect(await readMdFilesRecursiveAsync('/base', '')).toEqual([])
  })

  it('.md 파일만 수집하고 .txt, .ts는 제외한다', async () => {
    setReaddirAsyncReturn([makeDirent('note.md'), makeDirent('readme.txt'), makeDirent('index.ts')])
    const result = await readMdFilesRecursiveAsync('/base', '')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('note.md')
  })

  it('하위 디렉토리를 재귀 탐색하여 relativePath를 올바르게 구성한다', async () => {
    setReaddirAsyncImpl(async (dirPath) => {
      if (String(dirPath) === '/base') return [makeDirent('docs', { isDir: true })]
      if (String(dirPath) === '/base/docs') return [makeDirent('note.md')]
      return []
    })
    const result = await readMdFilesRecursiveAsync('/base', '')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('note.md')
    expect(result[0].relativePath).toBe('docs/note.md')
  })

  it('"." 으로 시작하는 파일을 제외한다', async () => {
    setReaddirAsyncReturn([makeDirent('.hidden.md')])
    expect(await readMdFilesRecursiveAsync('/base', '')).toHaveLength(0)
  })

  it('"." 으로 시작하는 디렉토리는 내부를 탐색하지 않는다', async () => {
    setReaddirAsyncReturn([makeDirent('.git', { isDir: true })])
    const result = await readMdFilesRecursiveAsync('/base', '')
    expect(result).toHaveLength(0)
  })

  it('심볼릭 링크를 제외한다', async () => {
    setReaddirAsyncReturn([makeDirent('linked.md', { isSymlink: true })])
    expect(await readMdFilesRecursiveAsync('/base', '')).toHaveLength(0)
  })

  it('readdir가 throw하면 빈 배열을 반환한다 (graceful)', async () => {
    setReaddirAsyncImpl(async () => {
      throw new Error('EACCES: permission denied')
    })
    expect(await readMdFilesRecursiveAsync('/base', '')).toEqual([])
  })

  it('sync 버전과 동일한 결과를 반환한다', async () => {
    // sync mock
    vi.mocked(fs.readdirSync).mockImplementation(((dirPath: fs.PathLike) => {
      if (String(dirPath) === '/base') return [makeDirent('docs', { isDir: true })]
      if (String(dirPath) === '/base/docs') return [makeDirent('a.md'), makeDirent('b.md')]
      return []
    }) as unknown as typeof fs.readdirSync)

    // async mock (동일한 트리)
    setReaddirAsyncImpl(async (dirPath) => {
      if (String(dirPath) === '/base') return [makeDirent('docs', { isDir: true })]
      if (String(dirPath) === '/base/docs') return [makeDirent('a.md'), makeDirent('b.md')]
      return []
    })

    const syncResult = readMdFilesRecursive('/base', '')
    const asyncResult = await readMdFilesRecursiveAsync('/base', '')

    expect(asyncResult.map((e) => e.relativePath).sort()).toEqual(
      syncResult.map((e) => e.relativePath).sort()
    )
  })
})

// ─── resolveNameConflict ──────────────────────────────────────
describe('resolveNameConflict', () => {
  it('충돌 없으면 입력 이름 그대로 반환한다', () => {
    // accessSync 기본: throw ENOENT → 이름 사용 가능
    expect(resolveNameConflict('/base', '새로운 노트.md')).toBe('새로운 노트.md')
  })

  it('.md 없는 이름 충돌 시 "name (1)" suffix를 추가한다 (폴더용)', () => {
    vi.mocked(fs.accessSync)
      .mockImplementationOnce(() => {}) // 'docs' 존재 → 충돌
      .mockImplementationOnce(() => {
        throw new Error('ENOENT')
      }) // 'docs (1)' 없음
    expect(resolveNameConflict('/base', 'docs')).toBe('docs (1)')
  })

  it('.md 있는 이름 충돌 시 "name (1).md" — 확장자 앞에 suffix 삽입 (노트용)', () => {
    vi.mocked(fs.accessSync)
      .mockImplementationOnce(() => {}) // '새로운 노트.md' 존재 → 충돌
      .mockImplementationOnce(() => {
        throw new Error('ENOENT')
      }) // '새로운 노트 (1).md' 없음
    expect(resolveNameConflict('/base', '새로운 노트.md')).toBe('새로운 노트 (1).md')
  })

  it('연속 충돌 시 (1), (2), (3) 순으로 증가한다', () => {
    vi.mocked(fs.accessSync)
      .mockImplementationOnce(() => {}) // 'note.md' 존재
      .mockImplementationOnce(() => {}) // 'note (1).md' 존재
      .mockImplementationOnce(() => {}) // 'note (2).md' 존재
      .mockImplementationOnce(() => {
        throw new Error('ENOENT')
      }) // 'note (3).md' 없음
    expect(resolveNameConflict('/base', 'note.md')).toBe('note (3).md')
  })
})
