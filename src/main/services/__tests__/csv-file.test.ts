import { describe, expect, it, vi, beforeEach } from 'vitest'
import fs from 'fs'
import chardet from 'chardet'
import iconv from 'iconv-lite'
import { csvFileService } from '../csv-file'
import { csvFileRepository } from '../../repositories/csv-file'
import { workspaceRepository } from '../../repositories/workspace'
import { folderRepository } from '../../repositories/folder'
import { NotFoundError } from '../../lib/errors'
import { reindexLeafSiblings } from '../../lib/leaf-reindex'

vi.mock('../../repositories/workspace', () => ({
  workspaceRepository: { findById: vi.fn() }
}))

vi.mock('../../repositories/csv-file', () => ({
  csvFileRepository: {
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
vi.mock('chardet')
vi.mock('iconv-lite')
vi.mock('nanoid', () => ({ nanoid: () => 'mock-id' }))
vi.mock('../../lib/fs-utils', () => ({
  resolveNameConflict: vi.fn((_dir: string, name: string) => name),
  readCsvFilesRecursive: vi.fn(() => [])
}))
vi.mock('../../lib/leaf-reindex', () => ({
  getLeafSiblings: vi.fn(() => []),
  reindexLeafSiblings: vi.fn()
}))

const MOCK_WS = { id: 'ws-1', name: 'T', path: '/t', createdAt: new Date(), updatedAt: new Date() }

const MOCK_CSV_ROW = {
  id: 'csv-1',
  workspaceId: 'ws-1',
  folderId: null,
  relativePath: 'test.csv',
  title: 'test',
  description: '',
  preview: '',
  columnWidths: null,
  order: 0,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01')
}

const MOCK_FOLDER = {
  id: 'folder-1',
  workspaceId: 'ws-1',
  relativePath: 'docs',
  color: null,
  order: 0,
  createdAt: new Date(),
  updatedAt: new Date()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(workspaceRepository.findById).mockReturnValue(MOCK_WS)
  vi.mocked(csvFileRepository.findByWorkspaceId).mockReturnValue([MOCK_CSV_ROW])
  vi.mocked(csvFileRepository.findById).mockReturnValue(MOCK_CSV_ROW)
  vi.mocked(csvFileRepository.create).mockReturnValue(MOCK_CSV_ROW)
  vi.mocked(csvFileRepository.update).mockReturnValue(MOCK_CSV_ROW)
})

// ─── readByWorkspaceFromDb ──────────────────────────────────────

describe('readByWorkspaceFromDb', () => {
  it('정상 — repository 호출 후 CsvFileNode[] 반환', () => {
    const result = csvFileService.readByWorkspaceFromDb('ws-1')
    expect(csvFileRepository.findByWorkspaceId).toHaveBeenCalledWith('ws-1')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('csv-1')
  })

  it('없는 workspaceId → NotFoundError', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => csvFileService.readByWorkspaceFromDb('bad')).toThrow(NotFoundError)
  })
})

// ─── create ─────────────────────────────────────────────────────

describe('create', () => {
  it('정상 생성 — fs.writeFileSync + repository.create 호출', () => {
    csvFileService.create('ws-1', null, 'mycsv')
    expect(fs.writeFileSync).toHaveBeenCalled()
    expect(csvFileRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'mycsv', relativePath: 'mycsv.csv' })
    )
  })

  it('folderId 지정 — folderRepository.findById 호출', () => {
    vi.mocked(folderRepository.findById).mockReturnValue(MOCK_FOLDER)
    csvFileService.create('ws-1', 'folder-1', 'mycsv')
    expect(folderRepository.findById).toHaveBeenCalledWith('folder-1')
    expect(csvFileRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ folderId: 'folder-1' })
    )
  })

  it("빈 문자열 name → 기본 이름 '새로운 테이블' 사용", () => {
    csvFileService.create('ws-1', null, '')
    expect(csvFileRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: '새로운 테이블' })
    )
  })

  it('없는 workspaceId → NotFoundError', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => csvFileService.create('bad', null, 'x')).toThrow(NotFoundError)
  })

  it('없는 folderId → NotFoundError', () => {
    vi.mocked(folderRepository.findById).mockReturnValue(undefined)
    expect(() => csvFileService.create('ws-1', 'ghost', 'x')).toThrow(NotFoundError)
  })
})

// ─── rename ─────────────────────────────────────────────────────

describe('rename', () => {
  it('정상 이름 변경 — fs.renameSync + repository.update 호출', () => {
    csvFileService.rename('ws-1', 'csv-1', 'newname')
    expect(fs.renameSync).toHaveBeenCalled()
    expect(csvFileRepository.update).toHaveBeenCalledWith(
      'csv-1',
      expect.objectContaining({ title: 'newname', relativePath: 'newname.csv' })
    )
  })

  it('동일 이름 (trim 후 비교) → 변경 없이 기존 객체 반환', () => {
    const result = csvFileService.rename('ws-1', 'csv-1', '  test  ')
    expect(fs.renameSync).not.toHaveBeenCalled()
    expect(csvFileRepository.update).not.toHaveBeenCalled()
    expect(result.id).toBe('csv-1')
  })

  it('없는 workspaceId → NotFoundError', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => csvFileService.rename('bad', 'csv-1', 'x')).toThrow(NotFoundError)
  })

  it('없는 csvId → NotFoundError', () => {
    vi.mocked(csvFileRepository.findById).mockReturnValue(undefined)
    expect(() => csvFileService.rename('ws-1', 'ghost', 'x')).toThrow(NotFoundError)
  })
})

// ─── remove ─────────────────────────────────────────────────────

describe('remove', () => {
  it('정상 삭제 — fs.unlinkSync + repository.delete 호출', () => {
    csvFileService.remove('ws-1', 'csv-1')
    expect(fs.unlinkSync).toHaveBeenCalled()
    expect(csvFileRepository.delete).toHaveBeenCalledWith('csv-1')
  })

  it('외부 삭제 (fs 에러) — repository.delete만 호출 (에러 무시)', () => {
    vi.mocked(fs.unlinkSync).mockImplementation(() => {
      throw new Error('ENOENT')
    })
    csvFileService.remove('ws-1', 'csv-1')
    expect(csvFileRepository.delete).toHaveBeenCalledWith('csv-1')
  })

  it('없는 workspaceId → NotFoundError', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => csvFileService.remove('bad', 'csv-1')).toThrow(NotFoundError)
  })

  it('없는 csvId → NotFoundError', () => {
    vi.mocked(csvFileRepository.findById).mockReturnValue(undefined)
    expect(() => csvFileService.remove('ws-1', 'ghost')).toThrow(NotFoundError)
  })
})

// ─── readContent ────────────────────────────────────────────────

describe('readContent', () => {
  it('정상 — 인코딩 감지 + iconv 디코딩', () => {
    const buf = Buffer.from('a,b,c')
    vi.mocked(fs.readFileSync).mockReturnValue(buf)
    vi.mocked(chardet.detect).mockReturnValue('EUC-KR')
    vi.mocked(iconv.decode).mockReturnValue('decoded-content')

    const result = csvFileService.readContent('ws-1', 'csv-1')
    expect(chardet.detect).toHaveBeenCalledWith(buf)
    expect(iconv.decode).toHaveBeenCalledWith(buf, 'EUC-KR')
    expect(result.content).toBe('decoded-content')
    expect(result.encoding).toBe('EUC-KR')
    expect(result.columnWidths).toBeNull()
  })

  it("빈 파일 (length=0) → content='', encoding='UTF-8' 반환", () => {
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.alloc(0))
    const result = csvFileService.readContent('ws-1', 'csv-1')
    expect(result.content).toBe('')
    expect(result.encoding).toBe('UTF-8')
    expect(chardet.detect).not.toHaveBeenCalled()
  })

  it('BOM 포함 파일 → BOM 제거', () => {
    const buf = Buffer.from('data')
    vi.mocked(fs.readFileSync).mockReturnValue(buf)
    vi.mocked(chardet.detect).mockReturnValue('UTF-8')
    vi.mocked(iconv.decode).mockReturnValue('\uFEFFcontent-with-bom')

    const result = csvFileService.readContent('ws-1', 'csv-1')
    expect(result.content).toBe('content-with-bom')
  })

  it('chardet.detect → null 반환 시 UTF-8 폴백', () => {
    const buf = Buffer.from('fallback')
    vi.mocked(fs.readFileSync).mockReturnValue(buf)
    vi.mocked(chardet.detect).mockReturnValue(null)
    vi.mocked(iconv.decode).mockReturnValue('fallback-decoded')

    const result = csvFileService.readContent('ws-1', 'csv-1')
    expect(iconv.decode).toHaveBeenCalledWith(buf, 'UTF-8')
    expect(result.encoding).toBe('UTF-8')
  })

  it('없는 workspaceId → NotFoundError', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => csvFileService.readContent('bad', 'csv-1')).toThrow(NotFoundError)
  })

  it('없는 csvId → NotFoundError', () => {
    vi.mocked(csvFileRepository.findById).mockReturnValue(undefined)
    expect(() => csvFileService.readContent('ws-1', 'ghost')).toThrow(NotFoundError)
  })

  it('파일 읽기 실패 (fs.readFileSync throw) → NotFoundError', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT')
    })
    expect(() => csvFileService.readContent('ws-1', 'csv-1')).toThrow(NotFoundError)
  })
})

// ─── writeContent ───────────────────────────────────────────────

describe('writeContent', () => {
  it('정상 — fs.writeFileSync + preview 업데이트 (첫 3줄, 200자 제한)', () => {
    const content = 'line1\nline2\nline3\nline4'
    csvFileService.writeContent('ws-1', 'csv-1', content)
    expect(fs.writeFileSync).toHaveBeenCalled()
    expect(csvFileRepository.update).toHaveBeenCalledWith(
      'csv-1',
      expect.objectContaining({ preview: 'line1 | line2 | line3' })
    )
  })

  it('없는 workspaceId → NotFoundError', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => csvFileService.writeContent('bad', 'csv-1', 'x')).toThrow(NotFoundError)
  })

  it('없는 csvId → NotFoundError', () => {
    vi.mocked(csvFileRepository.findById).mockReturnValue(undefined)
    expect(() => csvFileService.writeContent('ws-1', 'ghost', 'x')).toThrow(NotFoundError)
  })
})

// ─── move ───────────────────────────────────────────────────────

describe('move', () => {
  it('같은 폴더 이동 — fs.renameSync 미호출, reindexLeafSiblings만 호출', () => {
    // csv.folderId=null, targetFolderId=null → 같은 폴더
    csvFileService.move('ws-1', 'csv-1', null, 0)
    expect(fs.renameSync).not.toHaveBeenCalled()
    expect(csvFileRepository.update).not.toHaveBeenCalled()
    expect(reindexLeafSiblings).toHaveBeenCalled()
  })

  it('다른 폴더 이동 — fs.renameSync + repository.update + reindexLeafSiblings 호출', () => {
    vi.mocked(folderRepository.findById).mockReturnValue(MOCK_FOLDER)
    csvFileService.move('ws-1', 'csv-1', 'folder-1', 0)
    expect(fs.renameSync).toHaveBeenCalled()
    expect(csvFileRepository.update).toHaveBeenCalledWith(
      'csv-1',
      expect.objectContaining({ folderId: 'folder-1' })
    )
    expect(reindexLeafSiblings).toHaveBeenCalled()
  })

  it('없는 workspaceId → NotFoundError', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => csvFileService.move('bad', 'csv-1', null, 0)).toThrow(NotFoundError)
  })

  it('없는 csvId → NotFoundError', () => {
    vi.mocked(csvFileRepository.findById).mockReturnValue(undefined)
    expect(() => csvFileService.move('ws-1', 'ghost', null, 0)).toThrow(NotFoundError)
  })

  it('없는 targetFolderId → NotFoundError', () => {
    vi.mocked(folderRepository.findById).mockReturnValue(undefined)
    expect(() => csvFileService.move('ws-1', 'csv-1', 'ghost-folder', 0)).toThrow(NotFoundError)
  })
})

// ─── updateMeta ─────────────────────────────────────────────────

describe('updateMeta', () => {
  it('description 업데이트 — repository.update 호출', () => {
    csvFileService.updateMeta('ws-1', 'csv-1', { description: '설명' })
    expect(csvFileRepository.update).toHaveBeenCalledWith(
      'csv-1',
      expect.objectContaining({ description: '설명' })
    )
  })

  it('columnWidths 업데이트 — repository.update 호출', () => {
    csvFileService.updateMeta('ws-1', 'csv-1', { columnWidths: '[100,200]' })
    expect(csvFileRepository.update).toHaveBeenCalledWith(
      'csv-1',
      expect.objectContaining({ columnWidths: '[100,200]' })
    )
  })

  it('없는 csvId → NotFoundError', () => {
    vi.mocked(csvFileRepository.findById).mockReturnValue(undefined)
    expect(() => csvFileService.updateMeta('ws-1', 'ghost', { description: 'x' })).toThrow(
      NotFoundError
    )
  })
})

// ─── toCsvFileNode Date 변환 ────────────────────────────────────

describe('toCsvFileNode Date 변환', () => {
  it('createdAt/updatedAt number → Date 인스턴스 변환 확인', () => {
    const numericRow = {
      ...MOCK_CSV_ROW,
      createdAt: 1700000000000 as unknown as Date,
      updatedAt: 1700000000000 as unknown as Date
    }
    vi.mocked(csvFileRepository.findByWorkspaceId).mockReturnValue([numericRow])
    const result = csvFileService.readByWorkspaceFromDb('ws-1')
    expect(result[0].createdAt).toBeInstanceOf(Date)
    expect(result[0].updatedAt).toBeInstanceOf(Date)
  })
})
