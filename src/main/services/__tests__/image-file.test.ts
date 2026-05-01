import { describe, expect, it, vi, beforeEach } from 'vitest'
import fs from 'fs'
import { imageFileService } from '../image-file'
import { imageFileRepository } from '../../repositories/image-file'
import { workspaceRepository } from '../../repositories/workspace'
import { folderRepository } from '../../repositories/folder'
import { entityLinkService } from '../entity-link'
import { NotFoundError } from '../../lib/errors'
import { getLeafSiblings, reindexLeafSiblings } from '../../lib/leaf-reindex'

vi.mock('../../repositories/workspace', () => ({
  workspaceRepository: { findById: vi.fn() }
}))

vi.mock('../../repositories/image-file', () => ({
  imageFileRepository: {
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

vi.mock('../entity-link', () => ({
  entityLinkService: { removeAllLinks: vi.fn() }
}))

vi.mock('fs')
vi.mock('nanoid', () => ({ nanoid: () => 'mock-id' }))
vi.mock('../../lib/fs-utils', () => ({
  resolveNameConflict: vi.fn((_dir: string, name: string) => name),
  readImageFilesRecursive: vi.fn(() => [])
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

const MOCK_IMAGE_ROW = {
  id: 'img-1',
  workspaceId: 'ws-1',
  folderId: null,
  relativePath: 'photo.png',
  title: 'photo',
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
  vi.mocked(imageFileRepository.findByWorkspaceId).mockReturnValue([MOCK_IMAGE_ROW])
  vi.mocked(imageFileRepository.findById).mockReturnValue(MOCK_IMAGE_ROW)
  vi.mocked(imageFileRepository.create).mockReturnValue(MOCK_IMAGE_ROW)
  vi.mocked(imageFileRepository.update).mockReturnValue(MOCK_IMAGE_ROW)
})

// ─── readByWorkspaceFromDb ──────────────────────────────────────

describe('readByWorkspaceFromDb', () => {
  it('정상 — repository 호출 후 ImageFileNode[] 반환', () => {
    const result = imageFileService.readByWorkspaceFromDb('ws-1')
    expect(imageFileRepository.findByWorkspaceId).toHaveBeenCalledWith('ws-1')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('img-1')
  })

  it('없는 workspaceId → NotFoundError', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => imageFileService.readByWorkspaceFromDb('bad')).toThrow(NotFoundError)
  })
})

// ─── import ─────────────────────────────────────────────────────

describe('import', () => {
  it('정상 가져오기 — fs.copyFileSync + repository.create 호출', () => {
    imageFileService.import('ws-1', null, '/source/photo.png')
    expect(fs.copyFileSync).toHaveBeenCalled()
    expect(imageFileRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'photo', relativePath: 'photo.png' })
    )
  })

  it('folderId 지정 — folderRepository.findById 호출, 경로에 폴더 포함', () => {
    vi.mocked(folderRepository.findById).mockReturnValue(MOCK_FOLDER)
    imageFileService.import('ws-1', 'folder-1', '/source/photo.png')
    expect(folderRepository.findById).toHaveBeenCalledWith('folder-1')
    expect(imageFileRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ folderId: 'folder-1', relativePath: 'docs/photo.png' })
    )
  })

  it('기존 siblings 있을 때 order=maxOrder+1', () => {
    vi.mocked(getLeafSiblings).mockReturnValue([{ id: 'x', kind: 'image', order: 2 }])
    imageFileService.import('ws-1', null, '/source/photo.png')
    expect(imageFileRepository.create).toHaveBeenCalledWith(expect.objectContaining({ order: 3 }))
  })

  it('없는 workspaceId → NotFoundError', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => imageFileService.import('bad', null, '/source/photo.png')).toThrow(NotFoundError)
  })

  it('없는 folderId → NotFoundError', () => {
    vi.mocked(folderRepository.findById).mockReturnValue(undefined)
    expect(() => imageFileService.import('ws-1', 'ghost', '/source/photo.png')).toThrow(
      NotFoundError
    )
  })
})

// ─── rename ─────────────────────────────────────────────────────

describe('rename', () => {
  it('정상 이름 변경 — fs.renameSync + repository.update 호출', () => {
    imageFileService.rename('ws-1', 'img-1', 'newname')
    expect(fs.renameSync).toHaveBeenCalled()
    expect(imageFileRepository.update).toHaveBeenCalledWith(
      'img-1',
      expect.objectContaining({ title: 'newname', relativePath: 'newname.png' })
    )
  })

  it('동일 이름 (trim 후 비교) → 변경 없이 기존 객체 반환', () => {
    const result = imageFileService.rename('ws-1', 'img-1', '  photo  ')
    expect(fs.renameSync).not.toHaveBeenCalled()
    expect(imageFileRepository.update).not.toHaveBeenCalled()
    expect(result.id).toBe('img-1')
  })

  it('하위 폴더 내 이미지 rename — 폴더 경로 유지', () => {
    const folderImage = {
      ...MOCK_IMAGE_ROW,
      relativePath: 'docs/photo.png'
    }
    vi.mocked(imageFileRepository.findById).mockReturnValue(folderImage)
    imageFileService.rename('ws-1', 'img-1', 'newname')
    expect(imageFileRepository.update).toHaveBeenCalledWith(
      'img-1',
      expect.objectContaining({ relativePath: 'docs/newname.png' })
    )
  })

  it('없는 workspaceId → NotFoundError', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => imageFileService.rename('bad', 'img-1', 'x')).toThrow(NotFoundError)
  })

  it('없는 imageId → NotFoundError', () => {
    vi.mocked(imageFileRepository.findById).mockReturnValue(undefined)
    expect(() => imageFileService.rename('ws-1', 'ghost', 'x')).toThrow(NotFoundError)
  })
})

// ─── remove ─────────────────────────────────────────────────────

describe('remove', () => {
  it('정상 삭제, 호출 순서 검증', () => {
    const callOrder: string[] = []
    vi.mocked(fs.unlinkSync).mockImplementation(() => {
      callOrder.push('unlink')
    })
    vi.mocked(entityLinkService.removeAllLinks).mockImplementation(() => {
      callOrder.push('removeLinks')
    })
    vi.mocked(imageFileRepository.delete).mockImplementation(() => {
      callOrder.push('delete')
    })

    imageFileService.remove('ws-1', 'img-1')

    expect(callOrder).toEqual(['unlink', 'removeLinks', 'delete'])
    expect(entityLinkService.removeAllLinks).toHaveBeenCalledWith('image', 'img-1')
  })

  it('외부 삭제 (fs throw) — removeAllLinks + delete 모두 호출', () => {
    vi.mocked(fs.unlinkSync).mockImplementation(() => {
      throw new Error('ENOENT')
    })
    imageFileService.remove('ws-1', 'img-1')
    expect(entityLinkService.removeAllLinks).toHaveBeenCalledWith('image', 'img-1')
    expect(imageFileRepository.delete).toHaveBeenCalledWith('img-1')
  })

  it('없는 workspaceId → NotFoundError', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => imageFileService.remove('bad', 'img-1')).toThrow(NotFoundError)
  })

  it('없는 imageId → NotFoundError', () => {
    vi.mocked(imageFileRepository.findById).mockReturnValue(undefined)
    expect(() => imageFileService.remove('ws-1', 'ghost')).toThrow(NotFoundError)
  })
})

// ─── readContent ────────────────────────────────────────────────

describe('readContent', () => {
  it('정상 — fs.readFileSync 호출 후 { data: Buffer } 반환', () => {
    const buf = Buffer.from('fake-image-content')
    vi.mocked(fs.readFileSync).mockReturnValue(buf)

    const result = imageFileService.readContent('ws-1', 'img-1')
    expect(fs.readFileSync).toHaveBeenCalled()
    expect(result.data).toBe(buf)
  })

  it('없는 workspaceId → NotFoundError', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => imageFileService.readContent('bad', 'img-1')).toThrow(NotFoundError)
  })

  it('없는 imageId → NotFoundError', () => {
    vi.mocked(imageFileRepository.findById).mockReturnValue(undefined)
    expect(() => imageFileService.readContent('ws-1', 'ghost')).toThrow(NotFoundError)
  })

  it('파일 읽기 실패 (fs.readFileSync throw) → NotFoundError', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT')
    })
    expect(() => imageFileService.readContent('ws-1', 'img-1')).toThrow(NotFoundError)
  })
})

// ─── move ───────────────────────────────────────────────────────

describe('move', () => {
  it('같은 폴더 (null→null) — fs.renameSync 미호출, reindexLeafSiblings만 호출', () => {
    imageFileService.move('ws-1', 'img-1', null, 0)
    expect(fs.renameSync).not.toHaveBeenCalled()
    expect(imageFileRepository.update).not.toHaveBeenCalled()
    expect(reindexLeafSiblings).toHaveBeenCalled()
  })

  it('루트→폴더 (null→folder-1) — fs.renameSync + repository.update + reindexLeafSiblings 호출', () => {
    vi.mocked(folderRepository.findById).mockReturnValue(MOCK_FOLDER)
    imageFileService.move('ws-1', 'img-1', 'folder-1', 0)
    expect(fs.renameSync).toHaveBeenCalled()
    expect(imageFileRepository.update).toHaveBeenCalledWith(
      'img-1',
      expect.objectContaining({ folderId: 'folder-1', relativePath: 'docs/photo.png' })
    )
    expect(reindexLeafSiblings).toHaveBeenCalled()
  })

  it('폴더→루트 (folder-1→null) — relativePath에서 폴더 prefix 제거', () => {
    const folderImage = {
      ...MOCK_IMAGE_ROW,
      folderId: 'folder-1',
      relativePath: 'docs/photo.png'
    }
    vi.mocked(imageFileRepository.findById).mockReturnValue(folderImage)

    imageFileService.move('ws-1', 'img-1', null, 0)

    expect(imageFileRepository.update).toHaveBeenCalledWith(
      'img-1',
      expect.objectContaining({ folderId: null, relativePath: 'photo.png' })
    )
  })

  it('없는 workspaceId → NotFoundError', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => imageFileService.move('bad', 'img-1', null, 0)).toThrow(NotFoundError)
  })

  it('없는 imageId → NotFoundError', () => {
    vi.mocked(imageFileRepository.findById).mockReturnValue(undefined)
    expect(() => imageFileService.move('ws-1', 'ghost', null, 0)).toThrow(NotFoundError)
  })

  it('없는 targetFolderId → NotFoundError', () => {
    vi.mocked(folderRepository.findById).mockReturnValue(undefined)
    expect(() => imageFileService.move('ws-1', 'img-1', 'ghost-folder', 0)).toThrow(NotFoundError)
  })
})

// ─── updateMeta ─────────────────────────────────────────────────

describe('updateMeta', () => {
  it('description 업데이트 — repository.update 호출', () => {
    imageFileService.updateMeta('ws-1', 'img-1', { description: '설명' })
    expect(imageFileRepository.update).toHaveBeenCalledWith(
      'img-1',
      expect.objectContaining({ description: '설명' })
    )
  })

  it('없는 imageId → NotFoundError', () => {
    vi.mocked(imageFileRepository.findById).mockReturnValue(undefined)
    expect(() => imageFileService.updateMeta('ws-1', 'ghost', { description: 'x' })).toThrow(
      NotFoundError
    )
  })
})

// ─── toImageFileNode Date 변환 ────────────────────────────────────

describe('toImageFileNode Date 변환', () => {
  it('createdAt/updatedAt number → Date 인스턴스 변환 확인', () => {
    const numericRow = {
      ...MOCK_IMAGE_ROW,
      createdAt: 1700000000000 as unknown as Date,
      updatedAt: 1700000000000 as unknown as Date
    }
    vi.mocked(imageFileRepository.findByWorkspaceId).mockReturnValue([numericRow])
    const result = imageFileService.readByWorkspaceFromDb('ws-1')
    expect(result[0].createdAt).toBeInstanceOf(Date)
    expect(result[0].updatedAt).toBeInstanceOf(Date)
  })
})
