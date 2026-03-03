import path from 'path'
import fs from 'fs'
import { nanoid } from 'nanoid'
import { NotFoundError, ValidationError } from '../lib/errors'
import { workspaceRepository } from '../repositories/workspace'
import { isImageFile } from '../lib/fs-utils'

const IMAGES_DIR = '.images'

function ensureImagesDir(workspacePath: string): string {
  const dir = path.join(workspacePath, IMAGES_DIR)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

function getWorkspacePath(workspaceId: string): string {
  const workspace = workspaceRepository.findById(workspaceId)
  if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)
  return workspace.path
}

export const noteImageService = {
  saveFromPath(workspaceId: string, sourcePath: string): string {
    const workspacePath = getWorkspacePath(workspaceId)

    if (!fs.existsSync(sourcePath)) {
      throw new NotFoundError(`Source file not found: ${sourcePath}`)
    }
    if (!isImageFile(sourcePath)) {
      throw new ValidationError(`Not a supported image format: ${sourcePath}`)
    }

    const ext = path.extname(sourcePath)
    const fileName = `${nanoid()}${ext}`
    const imagesDir = ensureImagesDir(workspacePath)
    const destPath = path.join(imagesDir, fileName)

    fs.copyFileSync(sourcePath, destPath)

    return `${IMAGES_DIR}/${fileName}`
  },

  saveFromBuffer(workspaceId: string, buffer: ArrayBuffer, ext: string): string {
    const workspacePath = getWorkspacePath(workspaceId)

    const normalizedExt = ext.startsWith('.') ? ext : `.${ext}`
    if (!isImageFile(`file${normalizedExt}`)) {
      throw new ValidationError(`Not a supported image format: ${normalizedExt}`)
    }

    const fileName = `${nanoid()}${normalizedExt}`
    const imagesDir = ensureImagesDir(workspacePath)
    const destPath = path.join(imagesDir, fileName)

    fs.writeFileSync(destPath, Buffer.from(buffer))

    return `${IMAGES_DIR}/${fileName}`
  },

  /** 마크다운에서 .images/ 참조 경로 추출 */
  extractImagePaths(markdown: string): string[] {
    const regex = /!\[.*?\]\((.images\/[^)]+)\)/g
    const paths: string[] = []
    let match: RegExpExecArray | null
    while ((match = regex.exec(markdown)) !== null) {
      paths.push(match[1])
    }
    return paths
  },

  /** 이미지 파일 삭제 (존재하지 않으면 무시) */
  deleteImage(workspaceId: string, relativePath: string): void {
    const workspacePath = getWorkspacePath(workspaceId)

    const normalized = path.normalize(relativePath)
    if (normalized.startsWith('..') || path.isAbsolute(normalized) || !normalized.startsWith(IMAGES_DIR)) {
      return
    }

    const absPath = path.join(workspacePath, normalized)
    try {
      fs.unlinkSync(absPath)
    } catch {
      // 이미 삭제되었거나 존재하지 않으면 무시
    }
  },

  /** old/new 마크다운 비교 후 제거된 이미지 파일 삭제 */
  cleanupRemovedImages(workspaceId: string, oldContent: string, newContent: string): void {
    const oldPaths = new Set(this.extractImagePaths(oldContent))
    const newPaths = new Set(this.extractImagePaths(newContent))

    for (const p of oldPaths) {
      if (!newPaths.has(p)) {
        this.deleteImage(workspaceId, p)
      }
    }
  },

  /** 마크다운의 모든 이미지 파일 삭제 (노트 삭제 시) */
  deleteAllImages(workspaceId: string, content: string): void {
    const paths = this.extractImagePaths(content)
    for (const p of paths) {
      this.deleteImage(workspaceId, p)
    }
  },

  readImage(workspaceId: string, relativePath: string): { data: Buffer } {
    const workspacePath = getWorkspacePath(workspaceId)

    const normalized = path.normalize(relativePath)
    if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
      throw new ValidationError(`Invalid image path: ${relativePath}`)
    }
    if (!normalized.startsWith(IMAGES_DIR)) {
      throw new ValidationError(`Image path must be under ${IMAGES_DIR}: ${relativePath}`)
    }

    const absPath = path.join(workspacePath, normalized)
    let data: Buffer
    try {
      data = fs.readFileSync(absPath)
    } catch {
      throw new NotFoundError(`Image file not found: ${relativePath}`)
    }

    return { data }
  }
}
