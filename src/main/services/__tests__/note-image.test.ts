import { describe, expect, it, vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { noteImageService } from '../note-image'
import { workspaceRepository } from '../../repositories/workspace'
import { NotFoundError, ValidationError } from '../../lib/errors'

vi.mock('fs')
vi.mock('nanoid', () => ({ nanoid: () => 'mock-id' }))

vi.mock('../../repositories/workspace', () => ({
  workspaceRepository: { findById: vi.fn() }
}))

// isImageFile은 실제 구현 사용 (단순 확장자 체크)
// fs-utils 모킹하지 않음

const MOCK_WS = {
  id: 'ws-1',
  name: 'T',
  path: '/test/workspace',
  createdAt: new Date(),
  updatedAt: new Date()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(workspaceRepository.findById).mockReturnValue(MOCK_WS)
  vi.mocked(fs.existsSync).mockReturnValue(true)
})

// ─── saveFromPath ───────────────────────────────────────────

describe('saveFromPath', () => {
  it('정상 이미지 파일 저장 → .images/{nanoid}.{ext} 반환', () => {
    const result = noteImageService.saveFromPath('ws-1', '/source/photo.png')
    expect(result).toBe('.images/mock-id.png')
    expect(fs.copyFileSync).toHaveBeenCalledWith(
      '/source/photo.png',
      path.join('/test/workspace', '.images', 'mock-id.png')
    )
  })

  it('.images/ 폴더 미존재 시 mkdirSync 호출', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      if (String(p).endsWith('.images')) return false
      return true
    })
    noteImageService.saveFromPath('ws-1', '/source/photo.png')
    expect(fs.mkdirSync).toHaveBeenCalledWith(
      path.join('/test/workspace', '.images'),
      { recursive: true }
    )
  })

  it('.images/ 폴더 이미 존재 시 mkdirSync 미호출', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    noteImageService.saveFromPath('ws-1', '/source/photo.png')
    expect(fs.mkdirSync).not.toHaveBeenCalled()
  })

  it('소스 파일 미존재 → NotFoundError', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      if (String(p) === '/source/missing.png') return false
      return true
    })
    expect(() => noteImageService.saveFromPath('ws-1', '/source/missing.png')).toThrow(
      NotFoundError
    )
  })

  it('지원하지 않는 확장자 → ValidationError', () => {
    expect(() => noteImageService.saveFromPath('ws-1', '/source/doc.txt')).toThrow(ValidationError)
  })

  it('잘못된 workspaceId → NotFoundError', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => noteImageService.saveFromPath('bad', '/source/photo.png')).toThrow(NotFoundError)
  })
})

// ─── saveFromBuffer ─────────────────────────────────────────

describe('saveFromBuffer', () => {
  it('정상 ArrayBuffer 저장 → .images/mock-id.png', () => {
    const buf = new ArrayBuffer(8)
    const result = noteImageService.saveFromBuffer('ws-1', buf, 'png')
    expect(result).toBe('.images/mock-id.png')
  })

  it('점 포함 확장자 (.jpg) → 정규화', () => {
    const buf = new ArrayBuffer(8)
    const result = noteImageService.saveFromBuffer('ws-1', buf, '.jpg')
    expect(result).toBe('.images/mock-id.jpg')
  })

  it('지원하지 않는 확장자 → ValidationError', () => {
    const buf = new ArrayBuffer(8)
    expect(() => noteImageService.saveFromBuffer('ws-1', buf, 'txt')).toThrow(ValidationError)
  })

  it('fs.writeFileSync에 Buffer.from(buffer) 전달', () => {
    const buf = new ArrayBuffer(8)
    noteImageService.saveFromBuffer('ws-1', buf, 'png')
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join('/test/workspace', '.images', 'mock-id.png'),
      Buffer.from(buf)
    )
  })
})

// ─── readImage ──────────────────────────────────────────────

describe('readImage', () => {
  it('정상 읽기 → { data: Buffer } 반환', () => {
    const buf = Buffer.from('fake-image')
    vi.mocked(fs.readFileSync).mockReturnValue(buf)
    const result = noteImageService.readImage('ws-1', '.images/abc.png')
    expect(result.data).toBe(buf)
    expect(fs.readFileSync).toHaveBeenCalledWith(
      path.join('/test/workspace', '.images', 'abc.png')
    )
  })

  it('path traversal (../secret.txt) → ValidationError', () => {
    expect(() => noteImageService.readImage('ws-1', '../secret.txt')).toThrow(ValidationError)
  })

  it('.images/ 내부 path traversal (.images/../secret.txt) → ValidationError', () => {
    // path.normalize('.images/../secret.txt') → 'secret.txt' (.. 해소)
    // 'secret.txt'.startsWith('.images') → false → ValidationError
    expect(() => noteImageService.readImage('ws-1', '.images/../secret.txt')).toThrow(
      ValidationError
    )
  })

  it('절대 경로 (/etc/passwd) → ValidationError', () => {
    expect(() => noteImageService.readImage('ws-1', '/etc/passwd')).toThrow(ValidationError)
  })

  it('.images/ 외 경로 (photos/img.png) → ValidationError', () => {
    expect(() => noteImageService.readImage('ws-1', 'photos/img.png')).toThrow(ValidationError)
  })

  it('파일 미존재 → NotFoundError', () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT')
    })
    expect(() => noteImageService.readImage('ws-1', '.images/missing.png')).toThrow(NotFoundError)
  })
})

// ─── extractImagePaths ──────────────────────────────────────

describe('extractImagePaths', () => {
  it('이미지 참조 2개 → 2개 경로 반환', () => {
    const md = '![a](.images/a.png) text ![b](.images/b.jpg)'
    const result = noteImageService.extractImagePaths(md)
    expect(result).toEqual(['.images/a.png', '.images/b.jpg'])
  })

  it('이미지 참조 없는 마크다운 → 빈 배열', () => {
    const md = '# Hello\n\nSome text without images'
    expect(noteImageService.extractImagePaths(md)).toEqual([])
  })

  it('외부 URL 이미지 → 빈 배열', () => {
    const md = '![photo](https://example.com/img.png)'
    expect(noteImageService.extractImagePaths(md)).toEqual([])
  })

  it('빈 문자열 → 빈 배열', () => {
    expect(noteImageService.extractImagePaths('')).toEqual([])
  })

  it('title 속성 포함 → 현재 regex 미매칭 (title 미지원)', () => {
    // regex: /!\[.*?\]\((\.images\/[^)"\s]+)\)/g
    // 경로 뒤 공백+"title" 때문에 \) 매칭 실패 → 빈 배열
    const md = '![alt](.images/photo.png "title text")'
    const result = noteImageService.extractImagePaths(md)
    expect(result).toEqual([])
  })
})

// ─── deleteImage ────────────────────────────────────────────

describe('deleteImage', () => {
  it('정상 삭제 → fs.unlinkSync 호출', () => {
    noteImageService.deleteImage('ws-1', '.images/abc.png')
    expect(fs.unlinkSync).toHaveBeenCalledWith(
      path.join('/test/workspace', '.images', 'abc.png')
    )
  })

  it('path traversal (../file) → no-op', () => {
    noteImageService.deleteImage('ws-1', '../secret.txt')
    expect(fs.unlinkSync).not.toHaveBeenCalled()
  })

  it('.images/ 내부 path traversal (.images/../secret.txt) → no-op', () => {
    // path.normalize('.images/../secret.txt') → 'secret.txt'
    // !startsWith('.images') → return (no-op)
    noteImageService.deleteImage('ws-1', '.images/../secret.txt')
    expect(fs.unlinkSync).not.toHaveBeenCalled()
  })

  it('절대 경로 (/etc/passwd) → no-op', () => {
    noteImageService.deleteImage('ws-1', '/etc/passwd')
    expect(fs.unlinkSync).not.toHaveBeenCalled()
  })

  it('.images/ 외 경로 → no-op', () => {
    noteImageService.deleteImage('ws-1', 'photos/img.png')
    expect(fs.unlinkSync).not.toHaveBeenCalled()
  })

  it('이미 삭제된 파일 (ENOENT) → throw 없음', () => {
    vi.mocked(fs.unlinkSync).mockImplementation(() => {
      throw new Error('ENOENT')
    })
    expect(() => noteImageService.deleteImage('ws-1', '.images/gone.png')).not.toThrow()
  })
})

// ─── cleanupRemovedImages ───────────────────────────────────

describe('cleanupRemovedImages', () => {
  it('old 2개, new 1개 → 제거된 1개만 삭제', () => {
    const old = '![a](.images/a.png) ![b](.images/b.png)'
    const now = '![a](.images/a.png)'
    noteImageService.cleanupRemovedImages('ws-1', old, now)
    expect(fs.unlinkSync).toHaveBeenCalledTimes(1)
    expect(fs.unlinkSync).toHaveBeenCalledWith(
      path.join('/test/workspace', '.images', 'b.png')
    )
  })

  it('old와 new 동일 → unlinkSync 미호출', () => {
    const md = '![a](.images/a.png)'
    noteImageService.cleanupRemovedImages('ws-1', md, md)
    expect(fs.unlinkSync).not.toHaveBeenCalled()
  })

  it('old에 2개, new에 전부 제거 → unlinkSync 2회', () => {
    const old = '![a](.images/a.png) ![b](.images/b.png)'
    const now = 'no images'
    noteImageService.cleanupRemovedImages('ws-1', old, now)
    expect(fs.unlinkSync).toHaveBeenCalledTimes(2)
  })
})

// ─── deleteAllImages ────────────────────────────────────────

describe('deleteAllImages', () => {
  it('이미지 3개 → unlinkSync 3회 호출', () => {
    const md = '![a](.images/a.png) ![b](.images/b.jpg) ![c](.images/c.gif)'
    noteImageService.deleteAllImages('ws-1', md)
    expect(fs.unlinkSync).toHaveBeenCalledTimes(3)
  })

  it('이미지 없는 마크다운 → unlinkSync 미호출', () => {
    noteImageService.deleteAllImages('ws-1', '# No images here')
    expect(fs.unlinkSync).not.toHaveBeenCalled()
  })
})
