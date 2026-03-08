import path from 'path'
import { noteRepository } from '../../repositories/note'
import { csvFileRepository } from '../../repositories/csv-file'
import { pdfFileRepository } from '../../repositories/pdf-file'
import { imageFileRepository } from '../../repositories/image-file'
import {
  readMdFilesRecursiveAsync,
  readCsvFilesRecursiveAsync,
  readPdfFilesRecursiveAsync,
  readImageFilesRecursiveAsync,
  isImageFile
} from '../../lib/fs-utils'
import type { FileEntry } from '../../lib/fs-utils'

// ─── FileType Config ───────────────────────────────────────

export interface FileRow {
  id: string
  relativePath: string
  folderId: string | null
}

export interface FileRepository {
  findByRelativePath(workspaceId: string, relativePath: string): FileRow | undefined
  create(data: Record<string, unknown>): FileRow
  delete(id: string): void
  bulkDeleteByPrefix(workspaceId: string, prefix: string): void
  bulkUpdatePathPrefix(workspaceId: string, oldPrefix: string, newPrefix: string): void
  findByWorkspaceId(workspaceId: string): FileRow[]
  createMany(items: Record<string, unknown>[]): void
  deleteOrphans(workspaceId: string, existingPaths: string[]): void
  update(id: string, data: Record<string, unknown>): FileRow | undefined
}

export interface FileTypeConfig {
  /** 확장자 매칭 함수 */
  matchExtension: (fileName: string) => boolean
  /** 확장자 제거한 제목 추출 */
  extractTitle: (fileName: string) => string
  /** Repository 참조 */
  repository: FileRepository
  /** IPC push 채널명 */
  channelName: string
  /** entity-link에서 사용할 타입 문자열 */
  entityType: 'note' | 'csv' | 'pdf' | 'image'
  /** 이벤트 필터 (Image의 .images/ 제외 등) */
  skipFilter?: (relativePath: string) => boolean
  /** 비동기 fs 스캔 함수 */
  readFilesAsync: (absBase: string, parentRel: string) => Promise<FileEntry[]>
}

export const fileTypeConfigs: FileTypeConfig[] = [
  {
    matchExtension: (n) => n.endsWith('.md'),
    extractTitle: (n) => path.basename(n, '.md'),
    repository: noteRepository,
    channelName: 'note:changed',
    entityType: 'note',
    readFilesAsync: readMdFilesRecursiveAsync
  },
  {
    matchExtension: (n) => n.endsWith('.csv'),
    extractTitle: (n) => path.basename(n, '.csv'),
    repository: csvFileRepository,
    channelName: 'csv:changed',
    entityType: 'csv',
    readFilesAsync: readCsvFilesRecursiveAsync
  },
  {
    matchExtension: (n) => n.endsWith('.pdf'),
    extractTitle: (n) => path.basename(n, '.pdf'),
    repository: pdfFileRepository,
    channelName: 'pdf:changed',
    entityType: 'pdf',
    readFilesAsync: readPdfFilesRecursiveAsync
  },
  {
    matchExtension: isImageFile,
    extractTitle: (n) => path.basename(n, path.extname(n)),
    repository: imageFileRepository,
    channelName: 'image:changed',
    entityType: 'image',
    skipFilter: (rel) => rel.startsWith('.images/') || rel.includes('/.images/'),
    readFilesAsync: readImageFilesRecursiveAsync
  }
]
