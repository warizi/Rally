import { describe, expect, it, vi, beforeEach } from 'vitest'
import fs from 'fs'
import { pdfFileService } from '../pdf-file'
import { pdfFileRepository } from '../../repositories/pdf-file'
import { workspaceRepository } from '../../repositories/workspace'
import { folderRepository } from '../../repositories/folder'
import { NotFoundError } from '../../lib/errors'
import { reindexLeafSiblings } from '../../lib/leaf-reindex'

vi.mock('../../repositories/workspace', () => ({
  workspaceRepository: { findById: vi.fn() }
}))

vi.mock('../../repositories/pdf-file', () => ({
  pdfFileRepository: {
    findByWorkspaceId: vi.fn(),
    findById: vi.fn(),
    findByRelativePath: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    deleteOrphans: vi.fn(),
    delete: vi.fn()
  }
}))

vi.mock('../../repositories/folder', () => ({
  folderRepository: { findById: vi.fn(), findByRelativePath: vi.fn() }
}))

vi.mock('fs')
vi.mock('nanoid', () => ({ nanoid: () => 'mock-id' }))
vi.mock('../../lib/fs-utils', () => ({
  resolveNameConflict: vi.fn((_dir: string, name: string) => name),
  readPdfFilesRecursive: vi.fn(() => [])
}))
vi.mock('../../lib/leaf-reindex', () => ({
  getLeafSiblings: vi.fn(() => []),
  reindexLeafSiblings: vi.fn()
}))

const MOCK_WS = {
  id: 'ws-1',
  name: 'T',
  path: '/t',
  createdAt: new Date(),
  updatedAt: new Date()
}

const MOCK_PDF_ROW = {
  id: 'pdf-1',
  workspaceId: 'ws-1',
  folderId: null,
  relativePath: 'test.pdf',
  title: 'test',
  description: '',
  preview: '',
  order: 0,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  deletedAt: null,
  trashBatchId: null
}

const MOCK_FOLDER = {
  id: 'folder-1',
  workspaceId: 'ws-1',
  relativePath: 'docs',
  color: null,
  order: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  trashBatchId: null
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(workspaceRepository.findById).mockReturnValue(MOCK_WS)
  vi.mocked(pdfFileRepository.findByWorkspaceId).mockReturnValue([MOCK_PDF_ROW])
  vi.mocked(pdfFileRepository.findById).mockReturnValue(MOCK_PDF_ROW)
  vi.mocked(pdfFileRepository.create).mockReturnValue(MOCK_PDF_ROW)
  vi.mocked(pdfFileRepository.update).mockReturnValue(MOCK_PDF_ROW)
})

// ─── readByWorkspaceFromDb ──────────────────────────────────────

describe('readByWorkspaceFromDb', () => {
  it('정상 — repository 호출 후 PdfFileNode[] 반환', () => {
    const result = pdfFileService.readByWorkspaceFromDb('ws-1')
    expect(pdfFileRepository.findByWorkspaceId).toHaveBeenCalledWith('ws-1')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('pdf-1')
  })

  it('없는 workspaceId → NotFoundError', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => pdfFileService.readByWorkspaceFromDb('bad')).toThrow(NotFoundError)
  })
})

// ─── import ─────────────────────────────────────────────────────

describe('import', () => {
  it('정상 가져오기 — fs.copyFileSync + repository.create 호출', () => {
    pdfFileService.import('ws-1', null, '/source/test.pdf')
    expect(fs.copyFileSync).toHaveBeenCalled()
    expect(pdfFileRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'test', relativePath: 'test.pdf' })
    )
  })

  it('folderId 지정 — folderRepository.findById 호출, 경로에 폴더 포함', () => {
    vi.mocked(folderRepository.findById).mockReturnValue(MOCK_FOLDER)
    pdfFileService.import('ws-1', 'folder-1', '/source/test.pdf')
    expect(folderRepository.findById).toHaveBeenCalledWith('folder-1')
    expect(pdfFileRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ folderId: 'folder-1', relativePath: 'docs/test.pdf' })
    )
  })

  it('없는 workspaceId → NotFoundError', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => pdfFileService.import('bad', null, '/source/test.pdf')).toThrow(NotFoundError)
  })

  it('없는 folderId → NotFoundError', () => {
    vi.mocked(folderRepository.findById).mockReturnValue(undefined)
    expect(() => pdfFileService.import('ws-1', 'ghost', '/source/test.pdf')).toThrow(NotFoundError)
  })
})

// ─── rename ─────────────────────────────────────────────────────

describe('rename', () => {
  it('정상 이름 변경 — fs.renameSync + repository.update 호출', () => {
    pdfFileService.rename('ws-1', 'pdf-1', 'newname')
    expect(fs.renameSync).toHaveBeenCalled()
    expect(pdfFileRepository.update).toHaveBeenCalledWith(
      'pdf-1',
      expect.objectContaining({ title: 'newname', relativePath: 'newname.pdf' })
    )
  })

  it('동일 이름 (trim 후 비교) → 변경 없이 기존 객체 반환', () => {
    const result = pdfFileService.rename('ws-1', 'pdf-1', '  test  ')
    expect(fs.renameSync).not.toHaveBeenCalled()
    expect(pdfFileRepository.update).not.toHaveBeenCalled()
    expect(result.id).toBe('pdf-1')
  })

  it('없는 workspaceId → NotFoundError', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => pdfFileService.rename('bad', 'pdf-1', 'x')).toThrow(NotFoundError)
  })

  it('없는 pdfId → NotFoundError', () => {
    vi.mocked(pdfFileRepository.findById).mockReturnValue(undefined)
    expect(() => pdfFileService.rename('ws-1', 'ghost', 'x')).toThrow(NotFoundError)
  })
})

// ─── remove ─────────────────────────────────────────────────────

describe('remove', () => {
  it('정상 삭제 — fs.unlinkSync + repository.delete 호출', () => {
    pdfFileService.remove('ws-1', 'pdf-1')
    expect(fs.unlinkSync).toHaveBeenCalled()
    expect(pdfFileRepository.delete).toHaveBeenCalledWith('pdf-1')
  })

  it('외부 삭제 (fs 에러) — repository.delete만 호출 (에러 무시)', () => {
    vi.mocked(fs.unlinkSync).mockImplementation(() => {
      throw new Error('ENOENT')
    })
    pdfFileService.remove('ws-1', 'pdf-1')
    expect(pdfFileRepository.delete).toHaveBeenCalledWith('pdf-1')
  })

  it('없는 workspaceId → NotFoundError', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => pdfFileService.remove('bad', 'pdf-1')).toThrow(NotFoundError)
  })

  it('없는 pdfId → NotFoundError', () => {
    vi.mocked(pdfFileRepository.findById).mockReturnValue(undefined)
    expect(() => pdfFileService.remove('ws-1', 'ghost')).toThrow(NotFoundError)
  })
})

// ─── readContent ────────────────────────────────────────────────

describe('readContent', () => {
  it('정상 — fs.readFileSync 호출 후 { data: Buffer } 반환', () => {
    const buf = Buffer.from('fake-pdf-content')
    vi.mocked(fs.readFileSync).mockReturnValue(buf)

    const result = pdfFileService.readContent('ws-1', 'pdf-1')
    expect(fs.readFileSync).toHaveBeenCalled()
    expect(result.data).toBe(buf)
  })

  it('없는 workspaceId → NotFoundError', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => pdfFileService.readContent('bad', 'pdf-1')).toThrow(NotFoundError)
  })

  it('없는 pdfId → NotFoundError', () => {
    vi.mocked(pdfFileRepository.findById).mockReturnValue(undefined)
    expect(() => pdfFileService.readContent('ws-1', 'ghost')).toThrow(NotFoundError)
  })

  it('파일 읽기 실패 (fs.readFileSync throw) → NotFoundError', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT')
    })
    expect(() => pdfFileService.readContent('ws-1', 'pdf-1')).toThrow(NotFoundError)
  })
})

// ─── move ───────────────────────────────────────────────────────

describe('move', () => {
  it('같은 폴더 이동 — fs.renameSync 미호출, reindexLeafSiblings만 호출', () => {
    // pdf.folderId=null, targetFolderId=null → 같은 폴더
    pdfFileService.move('ws-1', 'pdf-1', null, 0)
    expect(fs.renameSync).not.toHaveBeenCalled()
    expect(pdfFileRepository.update).not.toHaveBeenCalled()
    expect(reindexLeafSiblings).toHaveBeenCalled()
  })

  it('다른 폴더 이동 — fs.renameSync + repository.update + reindexLeafSiblings 호출', () => {
    vi.mocked(folderRepository.findById).mockReturnValue(MOCK_FOLDER)
    pdfFileService.move('ws-1', 'pdf-1', 'folder-1', 0)
    expect(fs.renameSync).toHaveBeenCalled()
    expect(pdfFileRepository.update).toHaveBeenCalledWith(
      'pdf-1',
      expect.objectContaining({ folderId: 'folder-1' })
    )
    expect(reindexLeafSiblings).toHaveBeenCalled()
  })

  it('없는 workspaceId → NotFoundError', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => pdfFileService.move('bad', 'pdf-1', null, 0)).toThrow(NotFoundError)
  })

  it('없는 pdfId → NotFoundError', () => {
    vi.mocked(pdfFileRepository.findById).mockReturnValue(undefined)
    expect(() => pdfFileService.move('ws-1', 'ghost', null, 0)).toThrow(NotFoundError)
  })

  it('없는 targetFolderId → NotFoundError', () => {
    vi.mocked(folderRepository.findById).mockReturnValue(undefined)
    expect(() => pdfFileService.move('ws-1', 'pdf-1', 'ghost-folder', 0)).toThrow(NotFoundError)
  })
})

// ─── updateMeta ─────────────────────────────────────────────────

describe('updateMeta', () => {
  it('description 업데이트 — repository.update 호출', () => {
    pdfFileService.updateMeta('ws-1', 'pdf-1', { description: '설명' })
    expect(pdfFileRepository.update).toHaveBeenCalledWith(
      'pdf-1',
      expect.objectContaining({ description: '설명' })
    )
  })

  it('없는 pdfId → NotFoundError', () => {
    vi.mocked(pdfFileRepository.findById).mockReturnValue(undefined)
    expect(() => pdfFileService.updateMeta('ws-1', 'ghost', { description: 'x' })).toThrow(
      NotFoundError
    )
  })
})

// ─── toPdfFileNode Date 변환 ────────────────────────────────────

describe('toPdfFileNode Date 변환', () => {
  it('createdAt/updatedAt number → Date 인스턴스 변환 확인', () => {
    const numericRow = {
      ...MOCK_PDF_ROW,
      createdAt: 1700000000000 as unknown as Date,
      updatedAt: 1700000000000 as unknown as Date
    }
    vi.mocked(pdfFileRepository.findByWorkspaceId).mockReturnValue([numericRow])
    const result = pdfFileService.readByWorkspaceFromDb('ws-1')
    expect(result[0].createdAt).toBeInstanceOf(Date)
    expect(result[0].updatedAt).toBeInstanceOf(Date)
  })
})
