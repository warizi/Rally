import path from 'path'
import fs from 'fs'
import { nanoid } from 'nanoid'
import { NotFoundError, ValidationError } from '../lib/errors'
import { folderRepository } from '../repositories/folder'
import { workspaceRepository } from '../repositories/workspace'
// ⚠️ folder-watcher.ts를 import하지 않음 — 순환 의존성 방지
//    folderWatcher.ensureWatching 호출은 ipc/folder.ts에서 담당

// ─── 내부 타입 ───────────────────────────────────────────────

interface FsEntry {
  name: string
  relativePath: string // '/' 구분자
}

// ─── 공유 유틸 (folder-watcher.ts에서도 사용하므로 export) ─────

/** fs 재귀 탐색 — 심볼릭 링크·숨김 폴더 제외 */
export function readDirRecursive(absBase: string, parentRel: string): FsEntry[] {
  const absDir = parentRel ? path.join(absBase, parentRel) : absBase
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true })
  } catch {
    return []
  }

  const result: FsEntry[] = []
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    if (!entry.isDirectory()) continue
    if (entry.name.startsWith('.')) continue
    const rel = parentRel ? `${parentRel}/${entry.name}` : entry.name
    result.push({ name: entry.name, relativePath: rel })
    result.push(...readDirRecursive(absBase, rel))
  }
  return result
}

// ─── 파일 내 private 헬퍼 ────────────────────────────────────

/** Windows '\' → '/' 정규화 */
function normalizePath(p: string): string {
  return p.replace(/\\/g, '/')
}

/** 이름 충돌 해결: "name (1)", "name (2)", ... */
function resolveNameConflict(parentAbs: string, desiredName: string): string {
  let name = desiredName
  let n = 1
  while (true) {
    try {
      fs.accessSync(path.join(parentAbs, name))
      // 존재함 → suffix 증가
      name = `${desiredName} (${n})`
      n++
    } catch {
      // 접근 불가 = 존재하지 않음 → 사용 가능
      return name
    }
  }
}

/** 부모의 절대 경로 계산 (parentRelPath null = 워크스페이스 루트) */
function resolveParentAbsPath(workspacePath: string, parentRelPath: string | null): string {
  return parentRelPath ? path.join(workspacePath, parentRelPath) : workspacePath
}

// ─── FolderNode 타입 ─────────────────────────────────────────

export interface FolderNode {
  id: string
  name: string
  relativePath: string
  color: string | null
  order: number
  children: FolderNode[]
}

// ─── buildTree (private) ─────────────────────────────────────

function buildTree(
  dbFoldersByPath: Map<string, { id: string; color: string | null; order: number }>,
  fsEntries: FsEntry[]
): FolderNode[] {
  function buildChildren(parentRel: string): FolderNode[] {
    return fsEntries
      .filter((e) => {
        const parts = e.relativePath.split('/')
        const parentParts = parentRel ? parentRel.split('/') : []
        return (
          parts.length === parentParts.length + 1 &&
          (parentRel === '' || e.relativePath.startsWith(`${parentRel}/`))
        )
      })
      .map((e) => {
        const meta = dbFoldersByPath.get(e.relativePath)!
        return {
          id: meta.id,
          name: e.name,
          relativePath: e.relativePath,
          color: meta.color,
          order: meta.order,
          children: buildChildren(e.relativePath)
        }
      })
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
  }

  return buildChildren('')
}

// ─── folderService ───────────────────────────────────────────

export const folderService = {
  /**
   * fs 트리 읽기 + lazy upsert + DB 동기화 → FolderNode 트리 반환
   */
  readTree(workspaceId: string): FolderNode[] {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const workspacePath = workspace.path
    try {
      fs.accessSync(workspacePath)
    } catch {
      throw new ValidationError(`워크스페이스 경로에 접근할 수 없습니다: ${workspacePath}`)
    }

    // 1. fs 탐색
    const fsEntries = readDirRecursive(workspacePath, '')
    const fsPaths = fsEntries.map((e) => e.relativePath)

    // 2. DB 현재 rows
    const dbFolders = folderRepository.findByWorkspaceId(workspaceId)
    const dbPathSet = new Set(dbFolders.map((f) => f.relativePath))

    // 3. fs에 있고 DB에 없는 것 → insert (lazy upsert)
    const now = new Date()
    const toInsert = fsEntries
      .filter((e) => !dbPathSet.has(e.relativePath))
      .map((e) => ({
        id: nanoid(),
        workspaceId,
        relativePath: e.relativePath,
        color: null,
        order: 0,
        createdAt: now,
        updatedAt: now
      }))
    folderRepository.createMany(toInsert)

    // 4. DB에 있고 fs에 없는 것 → orphan 삭제
    folderRepository.deleteOrphans(workspaceId, fsPaths)

    // 5. 최신 DB rows 재조회
    const latestRows = folderRepository.findByWorkspaceId(workspaceId)
    const metaByPath = new Map(
      latestRows.map((r) => [r.relativePath, { id: r.id, color: r.color, order: r.order }])
    )

    return buildTree(metaByPath, fsEntries)
  },

  /**
   * 새 폴더 생성 (disk + DB)
   */
  create(workspaceId: string, parentFolderId: string | null, name: string): FolderNode {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    let parentRelPath: string | null = null
    if (parentFolderId) {
      const parent = folderRepository.findById(parentFolderId)
      if (!parent) throw new NotFoundError(`Parent folder not found: ${parentFolderId}`)
      parentRelPath = parent.relativePath
    }

    const parentAbs = resolveParentAbsPath(workspace.path, parentRelPath)
    const finalName = resolveNameConflict(parentAbs, name.trim() || '새 폴더')
    const newAbs = path.join(parentAbs, finalName)
    const newRel = normalizePath(parentRelPath ? `${parentRelPath}/${finalName}` : finalName)

    fs.mkdirSync(newAbs, { recursive: true })

    // siblings의 현재 max order + 1
    const siblings = folderRepository.findByWorkspaceId(workspaceId).filter((f) => {
      const parts = f.relativePath.split('/')
      const parentParts = parentRelPath ? parentRelPath.split('/') : []
      return (
        parts.length === parentParts.length + 1 &&
        (parentRelPath === null || f.relativePath.startsWith(`${parentRelPath}/`))
      )
    })
    const maxOrder = siblings.length > 0 ? Math.max(...siblings.map((s) => s.order)) : -1
    const now = new Date()

    const row = folderRepository.create({
      id: nanoid(),
      workspaceId,
      relativePath: newRel,
      color: null,
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now
    })

    return {
      id: row.id,
      name: finalName,
      relativePath: row.relativePath,
      color: row.color,
      order: row.order,
      children: []
    }
  },

  /**
   * 폴더 이름 변경 (disk + DB 하위 전체)
   */
  rename(workspaceId: string, folderId: string, newName: string): FolderNode {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const folder = folderRepository.findById(folderId)
    if (!folder) throw new NotFoundError(`Folder not found: ${folderId}`)

    const oldRel = folder.relativePath
    const parentRel = oldRel.includes('/') ? oldRel.split('/').slice(0, -1).join('/') : null
    const parentAbs = resolveParentAbsPath(workspace.path, parentRel)

    // 같은 이름이면 no-op (resolveNameConflict 호출 전에 먼저 체크)
    const oldName = oldRel.split('/').at(-1)!
    if (newName.trim() === oldName) {
      return {
        id: folder.id,
        name: oldName,
        relativePath: oldRel,
        color: folder.color,
        order: folder.order,
        children: []
      }
    }

    const finalName = resolveNameConflict(parentAbs, newName.trim())

    const oldAbs = path.join(workspace.path, oldRel)
    const newRel = normalizePath(parentRel ? `${parentRel}/${finalName}` : finalName)
    const newAbs = path.join(workspace.path, newRel)

    fs.renameSync(oldAbs, newAbs)
    folderRepository.bulkUpdatePathPrefix(workspaceId, oldRel, newRel)

    const updated = folderRepository.findById(folderId)!
    return {
      id: updated.id,
      name: finalName,
      relativePath: updated.relativePath,
      color: updated.color,
      order: updated.order,
      children: []
    }
  },

  /**
   * 폴더 삭제 (disk 재귀 삭제 + DB 벌크 삭제)
   */
  remove(workspaceId: string, folderId: string): void {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const folder = folderRepository.findById(folderId)
    if (!folder) throw new NotFoundError(`Folder not found: ${folderId}`)

    const absPath = path.join(workspace.path, folder.relativePath)
    fs.rmSync(absPath, { recursive: true, force: true })
    folderRepository.bulkDeleteByPrefix(workspaceId, folder.relativePath)
  },

  /**
   * 폴더 이동 (DnD) — 다른 부모로 이동 + siblings reindex
   * index: react-arborist가 전달하는 새 위치 (0-based)
   */
  move(
    workspaceId: string,
    folderId: string,
    parentFolderId: string | null,
    index: number
  ): FolderNode {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const folder = folderRepository.findById(folderId)
    if (!folder) throw new NotFoundError(`Folder not found: ${folderId}`)

    // 순환 이동 방지
    let targetParentRel: string | null = null
    if (parentFolderId) {
      const parentFolder = folderRepository.findById(parentFolderId)
      if (!parentFolder) throw new NotFoundError(`Parent folder not found: ${parentFolderId}`)
      targetParentRel = parentFolder.relativePath
      if (
        targetParentRel === folder.relativePath ||
        targetParentRel.startsWith(`${folder.relativePath}/`)
      ) {
        throw new ValidationError('순환 이동 불가: 폴더를 자기 자신의 하위로 이동할 수 없습니다.')
      }
    }

    const folderName = folder.relativePath.split('/').at(-1)!
    const currentParentRel = folder.relativePath.includes('/')
      ? folder.relativePath.split('/').slice(0, -1).join('/')
      : null
    const isSameParent = currentParentRel === targetParentRel
    const oldAbs = path.join(workspace.path, folder.relativePath)

    // 이름 충돌 해결 — 같은 부모로 이동(reorder)이면 이름 변경 없음
    const parentAbs = resolveParentAbsPath(workspace.path, targetParentRel)
    const finalName = isSameParent ? folderName : resolveNameConflict(parentAbs, folderName)
    const finalRel = normalizePath(targetParentRel ? `${targetParentRel}/${finalName}` : finalName)
    const finalAbs = path.join(workspace.path, finalRel)

    if (oldAbs !== finalAbs) {
      fs.renameSync(oldAbs, finalAbs)
      folderRepository.bulkUpdatePathPrefix(workspaceId, folder.relativePath, finalRel)
    }

    // siblings reindex
    const siblings = folderRepository
      .findByWorkspaceId(workspaceId)
      .filter((f) => {
        const parts = f.relativePath.split('/')
        const parentParts = targetParentRel ? targetParentRel.split('/') : []
        return (
          parts.length === parentParts.length + 1 &&
          (targetParentRel === null || f.relativePath.startsWith(`${targetParentRel}/`))
        )
      })
      .sort((a, b) => a.order - b.order)

    const withoutSelf = siblings.filter((s) => s.id !== folderId)
    withoutSelf.splice(index, 0, { ...folder, relativePath: finalRel })
    folderRepository.reindexSiblings(
      workspaceId,
      withoutSelf.map((s) => s.id)
    )

    const updated = folderRepository.findById(folderId)!
    return {
      id: updated.id,
      name: finalName,
      relativePath: updated.relativePath,
      color: updated.color,
      order: updated.order,
      children: []
    }
  },

  /**
   * 메타데이터 전용 업데이트 (color, order)
   */
  updateMeta(
    _workspaceId: string,
    folderId: string,
    data: { color?: string | null; order?: number }
  ): FolderNode {
    const folder = folderRepository.findById(folderId)
    if (!folder) throw new NotFoundError(`Folder not found: ${folderId}`)

    const updated = folderRepository.update(folderId, {
      ...data,
      updatedAt: new Date()
    })!

    const name = updated.relativePath.split('/').at(-1)!
    return {
      id: updated.id,
      name,
      relativePath: updated.relativePath,
      color: updated.color,
      order: updated.order,
      children: []
    }
  }
}
