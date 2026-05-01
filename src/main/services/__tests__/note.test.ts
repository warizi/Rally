import { describe, expect, it, vi, beforeEach } from 'vitest'
import * as fs from 'fs'
import { noteService } from '../note'
import { workspaceRepository } from '../../repositories/workspace'
import type { Workspace } from '../../repositories/workspace'
import { folderRepository } from '../../repositories/folder'
import { NotFoundError, ValidationError } from '../../lib/errors'
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { noteRepository } from '../../repositories/note'
import { noteImageService } from '../note-image'

// ─── Mock 선언 (vitest 자동 호이스팅) ─────────────────────────
vi.mock('fs')

vi.mock('../../repositories/workspace', () => ({
  workspaceRepository: { findById: vi.fn() }
}))

vi.mock('../../repositories/folder', () => ({
  folderRepository: {
    findById: vi.fn(),
    findByRelativePath: vi.fn(),
    findByWorkspaceId: vi.fn().mockReturnValue([])
  }
}))

vi.mock('../note-image', () => ({
  noteImageService: {
    cleanupRemovedImages: vi.fn(),
    deleteAllImages: vi.fn()
  }
}))

// ─── fs.Dirent mock 헬퍼 (isFile() 필수 포함) ────────────────
// readMdFilesRecursive는 entry.isFile()을 호출 (fs-utils.ts:30)
// folder.service.test.ts의 makeDirent는 isFile()이 없으므로 주의
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
  vi.clearAllMocks()
  vi.mocked(workspaceRepository.findById).mockReturnValue(mockWorkspace)
  // accessSync 기본: throw ENOENT (resolveNameConflict에서 이름 사용 가능)
  vi.mocked(fs.accessSync).mockImplementation(() => {
    throw new Error('ENOENT: no such file or directory')
  })
  setReaddirReturn([])
  vi.mocked(fs.writeFileSync).mockReturnValue(undefined)
  vi.mocked(fs.renameSync).mockReturnValue(undefined)
  vi.mocked(fs.unlinkSync).mockReturnValue(undefined)
})

// ─── testDb 헬퍼 ─────────────────────────────────────────────
function insertTestWorkspace(): void {
  testDb
    .insert(schema.workspaces)
    .values({ ...mockWorkspace, createdAt: new Date(), updatedAt: new Date() })
    .onConflictDoNothing()
    .run()
}

function insertTestFolder(id: string, relativePath: string): void {
  testDb
    .insert(schema.folders)
    .values({
      id,
      workspaceId: 'ws-1',
      relativePath,
      color: null,
      order: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .run()
}

function insertTestNote(
  id: string,
  relativePath: string,
  opts: { folderId?: string | null; title?: string; order?: number } = {}
): void {
  testDb
    .insert(schema.notes)
    .values({
      id,
      workspaceId: 'ws-1',
      folderId: opts.folderId ?? null,
      relativePath,
      title: opts.title ?? relativePath.replace(/\.md$/, ''),
      description: '',
      preview: '',
      order: opts.order ?? 0,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .run()
}

// ─── readByWorkspaceFromDb ────────────────────────────────────
describe('readByWorkspaceFromDb', () => {
  it('workspace not found → NotFoundError (fs 스캔 없음)', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => noteService.readByWorkspaceFromDb('ws-missing')).toThrow(NotFoundError)
    // readdirSync는 한 번도 호출되지 않아야 함
    expect(vi.mocked(fs.readdirSync)).not.toHaveBeenCalled()
  })

  it('DB rows만 반환 — fs.readdirSync 미호출', () => {
    insertTestWorkspace()
    insertTestNote('n1', 'a.md')
    insertTestNote('n2', 'b.md')
    const result = noteService.readByWorkspaceFromDb('ws-1')
    expect(result).toHaveLength(2)
    expect(result.map((n) => n.relativePath).sort()).toEqual(['a.md', 'b.md'])
    expect(vi.mocked(fs.readdirSync)).not.toHaveBeenCalled()
  })
})

// ─── readByWorkspace ─────────────────────────────────────────
describe('readByWorkspace', () => {
  it('workspace not found → NotFoundError', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => noteService.readByWorkspace('ws-missing')).toThrow(NotFoundError)
  })

  it('workspace 경로 접근 불가 → ValidationError', () => {
    // accessSync 기본 mock이 throw → ValidationError
    expect(() => noteService.readByWorkspace('ws-1')).toThrow(ValidationError)
  })

  it('fs에 파일 없음, DB 비어 있음 → 빈 배열 반환', () => {
    insertTestWorkspace()
    vi.mocked(fs.accessSync).mockReturnValueOnce(undefined) // workspace 경로 접근 성공
    setReaddirReturn([])
    const result = noteService.readByWorkspace('ws-1')
    expect(result).toEqual([])
  })

  it('fs에만 있는 .md 파일 → lazy upsert → DB에 insert 후 반환', () => {
    insertTestWorkspace()
    vi.mocked(fs.accessSync).mockReturnValueOnce(undefined)
    setReaddirReturn([makeDirent('note.md')])
    const result = noteService.readByWorkspace('ws-1')
    expect(result).toHaveLength(1)
    expect(result[0].relativePath).toBe('note.md')
    expect(result[0].folderId).toBeNull()
  })

  it('DB에만 있는 orphan row → 삭제 후 빈 배열 반환', () => {
    insertTestWorkspace()
    insertTestNote('n-orphan', 'ghost.md')
    vi.mocked(fs.accessSync).mockReturnValueOnce(undefined)
    setReaddirReturn([]) // fs에는 아무것도 없음
    const result = noteService.readByWorkspace('ws-1')
    expect(result).toHaveLength(0)
    expect(noteRepository.findById('n-orphan')).toBeUndefined()
  })

  it('이동 감지: fs 새 경로 + DB orphan의 basename 일치 → ID 보존, 경로 업데이트', () => {
    insertTestWorkspace()
    insertTestNote('n1', 'old/note.md')
    vi.mocked(fs.accessSync).mockReturnValueOnce(undefined)
    setReaddirImpl((dirPath) => {
      if (String(dirPath) === '/test/workspace') return [makeDirent('new', { isDir: true })]
      if (String(dirPath) === '/test/workspace/new') return [makeDirent('note.md')]
      return []
    })
    const result = noteService.readByWorkspace('ws-1')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('n1') // ID 보존
    expect(result[0].relativePath).toBe('new/note.md') // 새 경로
  })

  it('루트 노트(부모 디렉토리 없음) → folderId: null로 insert', () => {
    insertTestWorkspace()
    vi.mocked(fs.accessSync).mockReturnValueOnce(undefined)
    setReaddirReturn([makeDirent('root.md')])
    const result = noteService.readByWorkspace('ws-1')
    expect(result[0].folderId).toBeNull()
  })

  it('하위 디렉토리 노트 → DB에 해당 폴더 있으면 folderId 자동 설정', () => {
    // FK 제약: folderId로 insert되는 folder row가 testDb에 존재해야 함
    insertTestWorkspace()
    insertTestFolder('f-docs', 'docs')
    vi.mocked(folderRepository.findByWorkspaceId).mockReturnValue([
      {
        id: 'f-docs',
        workspaceId: 'ws-1',
        relativePath: 'docs',
        color: null,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ] as ReturnType<typeof folderRepository.findByWorkspaceId>)
    vi.mocked(fs.accessSync).mockReturnValueOnce(undefined)
    setReaddirImpl((dirPath) => {
      if (String(dirPath) === '/test/workspace') return [makeDirent('docs', { isDir: true })]
      if (String(dirPath) === '/test/workspace/docs') return [makeDirent('note.md')]
      return []
    })
    const result = noteService.readByWorkspace('ws-1')
    expect(result[0].folderId).toBe('f-docs')
  })
})

// ─── create ──────────────────────────────────────────────────
describe('create', () => {
  beforeEach(() => {
    insertTestWorkspace()
  })

  it('workspace not found → NotFoundError', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => noteService.create('ws-missing', null, 'note')).toThrow(NotFoundError)
  })

  it('folderId 있을 때 존재하지 않는 folder → NotFoundError', () => {
    vi.mocked(folderRepository.findById).mockReturnValue(undefined)
    expect(() => noteService.create('ws-1', 'ghost-folder', 'note')).toThrow(NotFoundError)
  })

  it('이름 빈 문자열 → "새로운 노트" fallback', () => {
    const result = noteService.create('ws-1', null, '')
    expect(result.title).toBe('새로운 노트')
  })

  it('루트에 생성 (folderId: null)', () => {
    const result = noteService.create('ws-1', null, '내 노트')
    expect(result.relativePath).toBe('내 노트.md')
    expect(result.folderId).toBeNull()
    expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
      expect.stringContaining('내 노트.md'),
      '',
      'utf-8'
    )
  })

  it('폴더 하위에 생성 — FK 제약: testDb에 folder row 필요', () => {
    // testDb에 folder row 미리 insert + folderRepository mock ID 일치
    insertTestFolder('f1', 'docs')
    vi.mocked(folderRepository.findById).mockReturnValue({
      id: 'f1',
      workspaceId: 'ws-1',
      relativePath: 'docs',
      color: null,
      order: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    } as ReturnType<typeof folderRepository.findById>)
    const result = noteService.create('ws-1', 'f1', '새 노트')
    expect(result.relativePath).toBe('docs/새 노트.md')
    expect(result.folderId).toBe('f1')
  })

  it('이름 충돌 시 "새로운 노트 (1).md" suffix 처리', () => {
    vi.mocked(fs.accessSync)
      .mockImplementationOnce(() => {}) // '새로운 노트.md' 존재 → 충돌
      .mockImplementationOnce(() => {
        throw new Error('ENOENT')
      }) // '새로운 노트 (1).md' 없음
    const result = noteService.create('ws-1', null, '새로운 노트')
    expect(result.title).toBe('새로운 노트 (1)')
  })

  it('order는 기존 siblings 중 max + 1', () => {
    // 루트 노트 2개 먼저 생성
    noteService.create('ws-1', null, 'first')
    noteService.create('ws-1', null, 'second')
    const result = noteService.create('ws-1', null, 'third')
    expect(result.order).toBe(2)
  })
})

// ─── rename ──────────────────────────────────────────────────
describe('rename', () => {
  beforeEach(() => {
    insertTestWorkspace()
  })

  it('workspace not found → NotFoundError', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => noteService.rename('ws-missing', 'n1', 'new')).toThrow(NotFoundError)
  })

  it('note not found → NotFoundError', () => {
    expect(() => noteService.rename('ws-1', 'ghost', 'new')).toThrow(NotFoundError)
  })

  it('같은 이름이면 no-op (fs.renameSync 미호출)', () => {
    insertTestNote('n1', 'note.md', { title: 'note' })
    noteService.rename('ws-1', 'n1', 'note')
    expect(vi.mocked(fs.renameSync)).not.toHaveBeenCalled()
  })

  it('정상 rename → fs.renameSync 호출 + DB 업데이트', () => {
    insertTestNote('n1', 'old-name.md', { title: 'old-name' })
    const result = noteService.rename('ws-1', 'n1', 'new-name')
    expect(result.title).toBe('new-name')
    expect(result.relativePath).toBe('new-name.md')
    expect(vi.mocked(fs.renameSync)).toHaveBeenCalledWith(
      expect.stringContaining('old-name.md'),
      expect.stringContaining('new-name.md')
    )
  })

  it('이름 충돌 시 suffix 부여', () => {
    insertTestNote('n1', 'my-note.md', { title: 'my-note' })
    vi.mocked(fs.accessSync)
      .mockImplementationOnce(() => {}) // 'new-name.md' 존재 → 충돌
      .mockImplementationOnce(() => {
        throw new Error('ENOENT')
      }) // 'new-name (1).md' 없음
    const result = noteService.rename('ws-1', 'n1', 'new-name')
    expect(result.title).toBe('new-name (1)')
  })
})

// ─── remove ──────────────────────────────────────────────────
describe('remove', () => {
  beforeEach(() => {
    insertTestWorkspace()
  })

  it('workspace not found → NotFoundError', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => noteService.remove('ws-missing', 'n1')).toThrow(NotFoundError)
  })

  it('note not found → NotFoundError', () => {
    expect(() => noteService.remove('ws-1', 'ghost')).toThrow(NotFoundError)
  })

  it('정상 삭제 → fs.unlinkSync 호출 + DB row 삭제', () => {
    insertTestNote('n1', 'to-delete.md')
    noteService.remove('ws-1', 'n1', { permanent: true })
    expect(vi.mocked(fs.unlinkSync)).toHaveBeenCalledWith(expect.stringContaining('to-delete.md'))
    expect(noteRepository.findById('n1')).toBeUndefined()
  })

  it('파일이 이미 외부에서 삭제된 경우 → graceful (DB만 정리)', () => {
    insertTestNote('n1', 'gone.md')
    vi.mocked(fs.unlinkSync).mockImplementationOnce(() => {
      throw new Error('ENOENT: no such file')
    })
    expect(() => noteService.remove('ws-1', 'n1', { permanent: true })).not.toThrow()
    expect(noteRepository.findById('n1')).toBeUndefined()
  })

  it('노트 삭제 시 deleteAllImages 호출', () => {
    insertTestNote('n1', 'note.md')
    const content = '![img](.images/photo.png)'
    vi.mocked(fs.readFileSync).mockReturnValueOnce(content as never)
    noteService.remove('ws-1', 'n1', { permanent: true })
    expect(noteImageService.deleteAllImages).toHaveBeenCalledWith('ws-1', content)
  })

  it('파일 읽기 실패 시 deleteAllImages 미호출, throw 없음', () => {
    insertTestNote('n1', 'note.md')
    vi.mocked(fs.readFileSync).mockImplementationOnce(() => {
      throw new Error('ENOENT')
    })
    expect(() => noteService.remove('ws-1', 'n1', { permanent: true })).not.toThrow()
    expect(noteImageService.deleteAllImages).not.toHaveBeenCalled()
  })
})

// ─── readContent ─────────────────────────────────────────────
describe('readContent', () => {
  beforeEach(() => {
    insertTestWorkspace()
  })

  it('정상 읽기 → 파일 내용 문자열 반환', () => {
    insertTestNote('n1', 'note.md')
    vi.mocked(fs.readFileSync).mockReturnValueOnce('# Hello World' as never)
    const result = noteService.readContent('ws-1', 'n1')
    expect(result).toBe('# Hello World')
  })

  it('파일 없음 (readFileSync throw) → NotFoundError', () => {
    insertTestNote('n1', 'note.md')
    vi.mocked(fs.readFileSync).mockImplementationOnce(() => {
      throw new Error('ENOENT: no such file')
    })
    expect(() => noteService.readContent('ws-1', 'n1')).toThrow(NotFoundError)
  })
})

// ─── writeContent ────────────────────────────────────────────
describe('writeContent', () => {
  beforeEach(() => {
    insertTestWorkspace()
  })

  it('fs.writeFileSync 호출 + DB preview 업데이트', () => {
    insertTestNote('n1', 'note.md')
    noteService.writeContent('ws-1', 'n1', 'hello world')
    expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
      expect.stringContaining('note.md'),
      'hello world',
      'utf-8'
    )
    expect(noteRepository.findById('n1')?.preview).toBe('hello world')
  })

  it('content 200자 초과 시 preview가 200자로 트런케이션', () => {
    insertTestNote('n1', 'note.md')
    const longContent = 'a'.repeat(300)
    noteService.writeContent('ws-1', 'n1', longContent)
    expect(noteRepository.findById('n1')?.preview).toBe('a'.repeat(200))
  })

  it('줄바꿈 포함 content → preview에서 \\s+가 단일 공백으로 정규화', () => {
    insertTestNote('n1', 'note.md')
    noteService.writeContent('ws-1', 'n1', 'hello\nworld')
    expect(noteRepository.findById('n1')?.preview).toBe('hello world')
  })

  it('이미지 제거 시 cleanupRemovedImages 호출', () => {
    insertTestNote('n1', 'note.md')
    const oldContent = '![img](.images/old.png)'
    const newContent = 'no image'
    vi.mocked(fs.readFileSync).mockReturnValueOnce(oldContent as never)
    noteService.writeContent('ws-1', 'n1', newContent)
    expect(noteImageService.cleanupRemovedImages).toHaveBeenCalledWith(
      'ws-1',
      oldContent,
      newContent
    )
  })

  it('파일 미존재 시 (최초 작성) cleanupRemovedImages 미호출', () => {
    insertTestNote('n1', 'note.md')
    vi.mocked(fs.readFileSync).mockImplementationOnce(() => {
      throw new Error('ENOENT')
    })
    noteService.writeContent('ws-1', 'n1', 'new content')
    expect(noteImageService.cleanupRemovedImages).not.toHaveBeenCalled()
  })
})

// ─── move ────────────────────────────────────────────────────
describe('move', () => {
  beforeEach(() => {
    insertTestWorkspace()
  })

  it('workspace not found → NotFoundError', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => noteService.move('ws-missing', 'n1', null, 0)).toThrow(NotFoundError)
  })

  it('note not found → NotFoundError', () => {
    expect(() => noteService.move('ws-1', 'ghost', null, 0)).toThrow(NotFoundError)
  })

  it('targetFolderId 제공 시 해당 folder not found → NotFoundError', () => {
    insertTestNote('n1', 'note.md')
    vi.mocked(folderRepository.findById).mockReturnValue(undefined)
    expect(() => noteService.move('ws-1', 'n1', 'ghost-folder', 0)).toThrow(NotFoundError)
  })

  it('다른 폴더로 이동 → fs.renameSync 호출 + DB folderId, relativePath 업데이트', () => {
    // FK 제약: targetFolderId에 해당하는 folder row가 testDb에 존재해야 함
    insertTestNote('n1', 'note.md')
    insertTestFolder('f2', 'dest')
    vi.mocked(folderRepository.findById).mockReturnValue({
      id: 'f2',
      workspaceId: 'ws-1',
      relativePath: 'dest',
      color: null,
      order: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    } as ReturnType<typeof folderRepository.findById>)
    const result = noteService.move('ws-1', 'n1', 'f2', 0)
    expect(result.folderId).toBe('f2')
    expect(result.relativePath).toBe('dest/note.md')
    expect(vi.mocked(fs.renameSync)).toHaveBeenCalled()
  })

  it('같은 폴더 내 순서 변경 → fs.renameSync 미호출', () => {
    insertTestNote('n1', 'note.md', { folderId: null, order: 1 })
    insertTestNote('n2', 'other.md', { folderId: null, order: 0 })
    // 같은 폴더(null) 내에서 index 0으로 이동
    noteService.move('ws-1', 'n1', null, 0)
    expect(vi.mocked(fs.renameSync)).not.toHaveBeenCalled()
  })

  it('siblings reindex 수행', () => {
    insertTestNote('n1', 'a.md', { folderId: null, order: 0 })
    insertTestNote('n2', 'b.md', { folderId: null, order: 1 })
    // n2를 index 0으로 이동 → [n2(order:0), n1(order:1)]
    noteService.move('ws-1', 'n2', null, 0)
    const n1 = noteRepository.findById('n1')
    const n2 = noteRepository.findById('n2')
    expect(n2?.order).toBe(0)
    expect(n1?.order).toBe(1)
  })
})

// ─── updateMeta ──────────────────────────────────────────────
describe('updateMeta', () => {
  beforeEach(() => {
    insertTestWorkspace()
  })

  it('description을 변경한다', () => {
    insertTestNote('n1', 'note.md')
    const result = noteService.updateMeta('ws-1', 'n1', { description: 'new desc' })
    expect(result.description).toBe('new desc')
  })

  it('note not found → NotFoundError', () => {
    expect(() => noteService.updateMeta('ws-1', 'ghost', { description: 'x' })).toThrow(
      NotFoundError
    )
  })
})
