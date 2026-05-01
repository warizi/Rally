import { describe, expect, it, vi, beforeEach } from 'vitest'
import * as fs from 'fs'
import { folderService, readDirRecursive } from '../folder'
import { workspaceRepository } from '../../repositories/workspace'
import type { Workspace } from '../../repositories/workspace'
import { NotFoundError, ValidationError } from '../../lib/errors'
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'

// ─── Mock 선언 (vitest 자동 호이스팅) ─────────────────────────
vi.mock('fs')

vi.mock('../../repositories/workspace', () => ({
  workspaceRepository: { findById: vi.fn() }
}))

// ─── fs.Dirent mock 헬퍼 ─────────────────────────────────────
function makeDirent(name: string, opts: { isDir?: boolean; isSymlink?: boolean } = {}): fs.Dirent {
  const { isDir = true, isSymlink = false } = opts
  return {
    name,
    isSymbolicLink: () => isSymlink,
    isDirectory: () => isDir
  } as unknown as fs.Dirent
}

// ─── readdirSync 타입 헬퍼 ───────────────────────────────────
// fs.readdirSync는 복잡한 오버로드를 가지므로 mockImplementation 호출 시
// TypeScript가 잘못된 오버로드를 선택하는 것을 방지하기 위해 캐스팅 헬퍼 사용
function setReaddirImpl(fn: (p: fs.PathLike) => fs.Dirent[]): void {
  vi.mocked(fs.readdirSync).mockImplementation(fn as unknown as typeof fs.readdirSync)
}
function setReaddirReturn(entries: fs.Dirent[]): void {
  vi.mocked(fs.readdirSync).mockReturnValue(entries as unknown as ReturnType<typeof fs.readdirSync>)
}

// ─── Workspace mock 픽스처 ───────────────────────────────────
const mockWorkspace: Workspace = {
  id: 'ws-1',
  name: 'Test',
  path: '/test/workspace',
  createdAt: new Date(),
  updatedAt: new Date()
}

// ─── beforeEach: 기본 mock 설정 ──────────────────────────────
beforeEach(() => {
  vi.clearAllMocks() // 이전 테스트 호출 이력 초기화
  vi.mocked(workspaceRepository.findById).mockReturnValue(mockWorkspace)
  // ⚠️ accessSync 기본: ENOENT throw (경로 없음 = 사용 가능)
  // resolveNameConflict: accessSync 성공 → 충돌, throw → 사용 가능
  // undefined 반환 시 모든 경로가 "존재"로 판단 → resolveNameConflict 무한 루프
  vi.mocked(fs.accessSync).mockImplementation(() => {
    throw new Error('ENOENT: no such file or directory')
  })
  setReaddirReturn([])
  vi.mocked(fs.mkdirSync).mockReturnValue(undefined)
  vi.mocked(fs.renameSync).mockReturnValue(undefined)
  vi.mocked(fs.rmSync).mockReturnValue(undefined)
})

// ─── readDirRecursive ────────────────────────────────────────
describe('readDirRecursive', () => {
  it('빈 디렉토리면 빈 배열을 반환한다', () => {
    setReaddirReturn([])
    const result = readDirRecursive('/base', '')
    expect(result).toEqual([])
  })

  it('중첩 폴더를 재귀적으로 탐색한다', () => {
    setReaddirImpl((dirPath) => {
      if (String(dirPath) === '/base') return [makeDirent('src')]
      if (String(dirPath) === '/base/src') return [makeDirent('components')]
      return []
    })
    const result = readDirRecursive('/base', '')
    expect(result.map((e) => e.relativePath)).toEqual(['src', 'src/components'])
  })

  it('심볼릭 링크를 제외한다', () => {
    setReaddirReturn([makeDirent('link', { isSymlink: true })])
    const result = readDirRecursive('/base', '')
    expect(result).toHaveLength(0)
  })

  it('"." 으로 시작하는 폴더를 제외한다', () => {
    setReaddirImpl((dirPath) => {
      // 루트만 .hidden + visible 반환, 재귀 탐색(visible 하위)은 빈 배열
      if (String(dirPath) === '/base') return [makeDirent('.hidden'), makeDirent('visible')]
      return []
    })
    const result = readDirRecursive('/base', '')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('visible')
  })

  it('파일(isDirectory=false)을 제외한다', () => {
    setReaddirReturn([makeDirent('file.txt', { isDir: false })])
    const result = readDirRecursive('/base', '')
    expect(result).toHaveLength(0)
  })

  it('readdirSync가 throw하면 빈 배열을 반환한다', () => {
    setReaddirImpl(() => {
      throw new Error('EACCES: permission denied')
    })
    const result = readDirRecursive('/base', '')
    expect(result).toEqual([])
  })
})

// ─── readTree ────────────────────────────────────────────────
describe('readTree', () => {
  it('workspace가 없으면 NotFoundError를 던진다', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => folderService.readTree('ws-missing')).toThrow(NotFoundError)
  })

  it('workspace 경로에 접근할 수 없으면 ValidationError를 던진다', () => {
    // 첫 번째 accessSync: workspace 경로 체크 → throw
    vi.mocked(fs.accessSync).mockImplementationOnce(() => {
      throw new Error('EACCES')
    })
    expect(() => folderService.readTree('ws-1')).toThrow(ValidationError)
  })

  it('fs 폴더가 DB에 없으면 lazy upsert 후 트리를 반환한다', () => {
    // workspace path 접근 성공
    vi.mocked(fs.accessSync).mockReturnValueOnce(undefined)
    // fs에 3개 폴더: a, a/b, c
    setReaddirImpl((dirPath) => {
      if (String(dirPath) === '/test/workspace') return [makeDirent('a'), makeDirent('c')]
      if (String(dirPath) === '/test/workspace/a') return [makeDirent('b')]
      return []
    })

    // DB에 workspace FK가 있어야 folderRepository.createMany 가능
    testDb
      .insert(schema.workspaces)
      .values({ ...mockWorkspace, createdAt: new Date(), updatedAt: new Date() })
      .onConflictDoNothing()
      .run()

    const result = folderService.readTree('ws-1')
    // fs에서 a, a/b, c 3개 → tree 루트는 a와 c
    expect(result).toHaveLength(2)
    const nodeA = result.find((n) => n.name === 'a')
    expect(nodeA).toBeDefined()
    expect(nodeA?.children).toHaveLength(1)
    expect(nodeA?.children[0].name).toBe('b')
  })

  it('DB에만 있고 fs에 없는 orphan row를 삭제한다', () => {
    // workspace path 접근 성공
    vi.mocked(fs.accessSync).mockReturnValueOnce(undefined)
    // fs는 완전히 비어 있음
    setReaddirReturn([])

    testDb
      .insert(schema.workspaces)
      .values({ ...mockWorkspace, createdAt: new Date(), updatedAt: new Date() })
      .onConflictDoNothing()
      .run()
    // DB에 orphan row 직접 insert
    testDb
      .insert(schema.folders)
      .values({
        id: 'orphan-1',
        workspaceId: 'ws-1',
        relativePath: 'ghost',
        color: null,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .run()

    const result = folderService.readTree('ws-1')
    // orphan 삭제 후 트리 비어 있어야 함
    expect(result).toHaveLength(0)
    const remaining = testDb
      .select()
      .from(schema.folders)
      .where(
        (schema.folders as typeof schema.folders & { workspaceId: unknown }).workspaceId
          ? undefined
          : undefined
      )
      .all()
    // folders 테이블에서 ws-1 폴더 없어야 함
    expect(remaining.filter((r) => r.workspaceId === 'ws-1')).toHaveLength(0)
  })
})

// ─── create ──────────────────────────────────────────────────
describe('create', () => {
  beforeEach(() => {
    testDb
      .insert(schema.workspaces)
      .values({ ...mockWorkspace, createdAt: new Date(), updatedAt: new Date() })
      .onConflictDoNothing()
      .run()
    // workspace path 접근: mkdirSync 전에 resolveNameConflict가 accessSync 호출
    // 기본 mock은 ENOENT throw → 이름 사용 가능
  })

  it('루트 폴더를 생성한다', () => {
    const result = folderService.create('ws-1', null, 'docs')
    expect(result.name).toBe('docs')
    expect(result.relativePath).toBe('docs')
    expect(result.children).toEqual([])
  })

  it('하위 폴더를 생성한다', () => {
    const parent = folderService.create('ws-1', null, 'src')
    const child = folderService.create('ws-1', parent.id, 'components')
    expect(child.relativePath).toBe('src/components')
  })

  it('parent가 없으면 NotFoundError를 던진다', () => {
    expect(() => folderService.create('ws-1', 'ghost-parent', 'x')).toThrow(NotFoundError)
  })

  it('이름 충돌 시 "(1)" suffix를 붙인다', () => {
    vi.mocked(fs.accessSync)
      .mockImplementationOnce(() => {}) // 첫 번째: 'docs' 경로 존재 → 충돌
      .mockImplementationOnce(() => {
        throw new Error('ENOENT')
      }) // 두 번째: 'docs (1)' 없음 → 사용 가능
    const result = folderService.create('ws-1', null, 'docs')
    expect(result.name).toBe('docs (1)')
  })

  it('같은 충돌이 반복되면 "(2)", "(3)" 순서로 증가한다', () => {
    vi.mocked(fs.accessSync)
      .mockImplementationOnce(() => {}) // 'docs' 존재
      .mockImplementationOnce(() => {}) // 'docs (1)' 존재
      .mockImplementationOnce(() => {
        throw new Error('ENOENT')
      }) // 'docs (2)' 없음
    const result = folderService.create('ws-1', null, 'docs')
    expect(result.name).toBe('docs (2)')
  })
})

// ─── rename ──────────────────────────────────────────────────
describe('rename', () => {
  beforeEach(() => {
    testDb
      .insert(schema.workspaces)
      .values({ ...mockWorkspace, createdAt: new Date(), updatedAt: new Date() })
      .onConflictDoNothing()
      .run()
  })

  it('정상적으로 이름을 변경한다', () => {
    // accessSync default: ENOENT throw (이름 사용 가능)
    const created = folderService.create('ws-1', null, 'old-name')
    const result = folderService.rename('ws-1', created.id, 'new-name')
    expect(result.name).toBe('new-name')
    expect(result.relativePath).toBe('new-name')
  })

  it('같은 이름이면 no-op으로 동일 폴더를 반환한다', () => {
    const created = folderService.create('ws-1', null, 'same')
    const result = folderService.rename('ws-1', created.id, 'same')
    expect(result.name).toBe('same')
    expect(vi.mocked(fs.renameSync)).not.toHaveBeenCalled()
  })

  it('"a" → "x" rename 시 "a/b" → "x/b"로 하위 전체 경로가 업데이트된다', () => {
    const parent = folderService.create('ws-1', null, 'a')
    const child = folderService.create('ws-1', parent.id, 'b')

    // rename 호출 시 resolveNameConflict가 accessSync 호출 → ENOENT throw (이름 사용 가능)
    folderService.rename('ws-1', parent.id, 'x')

    // DB에서 직접 확인
    const folders = testDb.select().from(schema.folders).all()
    const paths = folders.map((f) => f.relativePath)
    expect(paths).toContain('x')
    expect(paths).toContain('x/b')
    expect(paths).not.toContain('a')
    expect(paths).not.toContain('a/b')

    // child id가 여전히 존재하는지 확인
    const childRow = folders.find((f) => f.id === child.id)
    expect(childRow?.relativePath).toBe('x/b')
  })
})

// ─── remove ──────────────────────────────────────────────────
describe('remove', () => {
  beforeEach(() => {
    testDb
      .insert(schema.workspaces)
      .values({ ...mockWorkspace, createdAt: new Date(), updatedAt: new Date() })
      .onConflictDoNothing()
      .run()
  })

  it('fs.rmSync를 호출하고 DB row를 삭제한다', () => {
    const folder = folderService.create('ws-1', null, 'to-delete')
    folderService.remove('ws-1', folder.id, { permanent: true })

    expect(vi.mocked(fs.rmSync)).toHaveBeenCalledWith(
      expect.stringContaining('to-delete'),
      expect.objectContaining({ recursive: true, force: true })
    )
    const remaining = testDb.select().from(schema.folders).all()
    expect(remaining.filter((f) => f.id === folder.id)).toHaveLength(0)
  })
})

// ─── move ────────────────────────────────────────────────────
describe('move', () => {
  beforeEach(() => {
    testDb
      .insert(schema.workspaces)
      .values({ ...mockWorkspace, createdAt: new Date(), updatedAt: new Date() })
      .onConflictDoNothing()
      .run()
  })

  it('다른 부모로 이동 후 siblings reindex를 수행한다', () => {
    const parent1 = folderService.create('ws-1', null, 'parent1')
    const parent2 = folderService.create('ws-1', null, 'parent2')
    const child = folderService.create('ws-1', parent1.id, 'child')

    // child를 parent2로 이동
    const result = folderService.move('ws-1', child.id, parent2.id, 0)
    expect(result.relativePath).toBe('parent2/child')
  })

  it('자기 자신의 하위로 이동하면 ValidationError를 던진다', () => {
    const parent = folderService.create('ws-1', null, 'a')
    const child = folderService.create('ws-1', parent.id, 'b')
    // "a"를 "a/b" 하위로 이동 시도
    expect(() => folderService.move('ws-1', parent.id, child.id, 0)).toThrow(ValidationError)
  })
})

// ─── updateMeta ──────────────────────────────────────────────
describe('updateMeta', () => {
  beforeEach(() => {
    testDb
      .insert(schema.workspaces)
      .values({ ...mockWorkspace, createdAt: new Date(), updatedAt: new Date() })
      .onConflictDoNothing()
      .run()
  })

  it('color를 변경한다', () => {
    const folder = folderService.create('ws-1', null, 'colored')
    const result = folderService.updateMeta('ws-1', folder.id, { color: '#ff0000' })
    expect(result.color).toBe('#ff0000')
  })

  it('없는 id면 NotFoundError를 던진다', () => {
    expect(() => folderService.updateMeta('ws-1', 'ghost', { color: null })).toThrow(NotFoundError)
  })
})
