import { NotFoundError, ValidationError } from '../lib/errors'
import { workspaceRepository } from '../repositories/workspace'
import { folderRepository } from '../repositories/folder'
import { noteService } from './note'
import { csvFileService } from './csv-file'
import { canvasService } from './canvas'
import { todoService } from './todo'

export type WorkspaceItemKind = 'folder' | 'note' | 'table' | 'canvas'

export interface ListWorkspaceItemsOptions {
  /** 특정 폴더 하위만 조회 (없으면 워크스페이스 전체) */
  folderId?: string | null
  /** folderId 지정 시: true=하위 모든 depth, false=직접 자식만 (default: false) */
  recursive?: boolean
  /** 종류 필터. 미지정 시 전부 */
  types?: WorkspaceItemKind[]
  /** lite projection: preview/relativePath/folderPath/description 제거 (default: false) */
  summary?: boolean
  /** updatedAt 이후 항목만 (canvas 제외 — folder는 createdAt 기반 X, 모든 도메인이 updatedAt 보유) */
  updatedAfter?: Date
  /** 종류별 row 자르기 (default: 500). 큰 워크스페이스 보호용. */
  limit?: number
  /** 종류별 offset (default: 0) */
  offset?: number
}

interface FolderEntry {
  id: string
  relativePath: string
  order: number
}

interface NoteEntry {
  id: string
  title: string
  folderId: string | null
  updatedAt: string
  relativePath?: string
  preview?: string | null
  folderPath?: string | null
}

interface TableEntry {
  id: string
  title: string
  folderId: string | null
  updatedAt: string
  relativePath?: string
  description?: string | null
  preview?: string | null
  folderPath?: string | null
}

interface CanvasEntry {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  description?: string | null
}

export interface ListWorkspaceItemsResult {
  workspace: { id: string; name: string; path: string }
  folders: FolderEntry[]
  notes: NoteEntry[]
  tables: TableEntry[]
  canvases: CanvasEntry[]
  todos: { active: number; completed: number; total: number }
  meta: {
    summary: boolean
    folderId: string | null
    recursive: boolean
    types: WorkspaceItemKind[] | null
    limit: number
    offset: number
    counts: { folders: number; notes: number; tables: number; canvases: number }
    hasMore: { folders: boolean; notes: boolean; tables: boolean; canvases: boolean }
  }
}

const DEFAULT_LIMIT = 500
const MAX_LIMIT = 1000

function shouldInclude(types: WorkspaceItemKind[] | undefined, kind: WorkspaceItemKind): boolean {
  return !types || types.includes(kind)
}

export const workspaceItemsService = {
  list(workspaceId: string, options: ListWorkspaceItemsOptions = {}): ListWorkspaceItemsResult {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const {
      folderId = null,
      recursive = false,
      types,
      summary = false,
      updatedAfter,
      limit = DEFAULT_LIMIT,
      offset = 0
    } = options

    if (limit < 1 || limit > MAX_LIMIT) {
      throw new ValidationError(`limit must be between 1 and ${MAX_LIMIT}`)
    }
    if (offset < 0) throw new ValidationError('offset must be >= 0')
    if (types && types.length === 0) {
      throw new ValidationError('types must not be empty when provided')
    }

    // ── 폴더 스코프 결정 ─────────────────────────────────────
    const allFolders = folderRepository.findByWorkspaceId(workspaceId)
    let scopedFolderIds: Set<string> | null = null
    let scopedPathPrefix: string | null = null

    if (folderId) {
      const target = allFolders.find((f) => f.id === folderId)
      if (!target) throw new NotFoundError(`Folder not found: ${folderId}`)
      scopedPathPrefix = target.relativePath

      if (recursive) {
        // prefix 기준 모든 후손
        scopedFolderIds = new Set(
          allFolders
            .filter(
              (f) =>
                f.relativePath === target.relativePath ||
                f.relativePath.startsWith(`${target.relativePath}/`)
            )
            .map((f) => f.id)
        )
      } else {
        // 직접 자식만 (target.id를 folderId로 갖는 항목)
        scopedFolderIds = new Set([target.id])
      }
    }

    const folderMap = new Map(allFolders.map((f) => [f.id, f.relativePath]))

    // ── folders ──────────────────────────────────────────────
    let folders: FolderEntry[] = []
    let foldersTotal = 0
    if (shouldInclude(types, 'folder')) {
      let pool = allFolders
      if (folderId && scopedPathPrefix !== null) {
        if (recursive) {
          pool = pool.filter(
            (f) =>
              f.relativePath !== scopedPathPrefix &&
              f.relativePath.startsWith(`${scopedPathPrefix}/`)
          )
        } else {
          // 직접 자식 폴더 = relativePath가 prefix/segment 한 단계인 것
          const prefix = `${scopedPathPrefix}/`
          pool = pool.filter(
            (f) =>
              f.relativePath.startsWith(prefix) &&
              !f.relativePath.slice(prefix.length).includes('/')
          )
        }
      }
      if (updatedAfter) {
        pool = pool.filter((f) => f.updatedAt instanceof Date && f.updatedAt >= updatedAfter)
      }
      foldersTotal = pool.length
      folders = pool.slice(offset, offset + limit).map((f) => ({
        id: f.id,
        relativePath: f.relativePath,
        order: f.order
      }))
    }

    // ── notes ────────────────────────────────────────────────
    let notes: NoteEntry[] = []
    let notesTotal = 0
    if (shouldInclude(types, 'note')) {
      let pool = noteService.readByWorkspaceFromDb(workspaceId)
      if (scopedFolderIds) {
        pool = pool.filter((n) => n.folderId !== null && scopedFolderIds!.has(n.folderId))
      }
      if (updatedAfter) pool = pool.filter((n) => n.updatedAt >= updatedAfter)
      notesTotal = pool.length
      notes = pool.slice(offset, offset + limit).map((n) => {
        const base: NoteEntry = {
          id: n.id,
          title: n.title,
          folderId: n.folderId,
          updatedAt: n.updatedAt.toISOString()
        }
        if (!summary) {
          base.relativePath = n.relativePath
          base.preview = n.preview
          base.folderPath = n.folderId ? (folderMap.get(n.folderId) ?? null) : null
        }
        return base
      })
    }

    // ── tables ───────────────────────────────────────────────
    let tables: TableEntry[] = []
    let tablesTotal = 0
    if (shouldInclude(types, 'table')) {
      let pool = csvFileService.readByWorkspaceFromDb(workspaceId)
      if (scopedFolderIds) {
        pool = pool.filter((t) => t.folderId !== null && scopedFolderIds!.has(t.folderId))
      }
      if (updatedAfter) pool = pool.filter((t) => t.updatedAt >= updatedAfter)
      tablesTotal = pool.length
      tables = pool.slice(offset, offset + limit).map((t) => {
        const base: TableEntry = {
          id: t.id,
          title: t.title,
          folderId: t.folderId,
          updatedAt: t.updatedAt.toISOString()
        }
        if (!summary) {
          base.relativePath = t.relativePath
          base.description = t.description
          base.preview = t.preview
          base.folderPath = t.folderId ? (folderMap.get(t.folderId) ?? null) : null
        }
        return base
      })
    }

    // ── canvases ─────────────────────────────────────────────
    let canvases: CanvasEntry[] = []
    let canvasesTotal = 0
    if (shouldInclude(types, 'canvas')) {
      // canvas는 folder 소속 개념이 없음 — folderId 스코프 시 빈 결과
      if (!scopedFolderIds) {
        let pool = canvasService.findByWorkspace(workspaceId)
        if (updatedAfter) pool = pool.filter((c) => c.updatedAt >= updatedAfter)
        canvasesTotal = pool.length
        canvases = pool.slice(offset, offset + limit).map((c) => {
          const base: CanvasEntry = {
            id: c.id,
            title: c.title,
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString()
          }
          if (!summary) base.description = c.description
          return base
        })
      }
    }

    // todos는 항상 카운트만 (types 필터에서 제외 — 별도 list_todos 도구 사용)
    const todoCounts = todoService.countByWorkspace(workspaceId)

    return {
      workspace: { id: workspace.id, name: workspace.name, path: workspace.path },
      folders,
      notes,
      tables,
      canvases,
      todos: todoCounts,
      meta: {
        summary,
        folderId,
        recursive,
        types: types ?? null,
        limit,
        offset,
        counts: {
          folders: foldersTotal,
          notes: notesTotal,
          tables: tablesTotal,
          canvases: canvasesTotal
        },
        hasMore: {
          folders: offset + folders.length < foldersTotal,
          notes: offset + notes.length < notesTotal,
          tables: offset + tables.length < tablesTotal,
          canvases: offset + canvases.length < canvasesTotal
        }
      }
    }
  }
}
