import path from 'path'
import fs from 'fs'
import { nanoid } from 'nanoid'
import { NotFoundError, ValidationError } from '../lib/errors'
import { noteRepository } from '../repositories/note'
import { folderRepository } from '../repositories/folder'
import { workspaceRepository } from '../repositories/workspace'
import { resolveNameConflict, readMdFilesRecursive } from '../lib/fs-utils'
import { normalizePath, parentRelPath } from '../lib/path-utils'
import { getLeafSiblings, reindexLeafSiblings } from '../lib/leaf-reindex'
import { cleanupOrphansAndDelete } from '../lib/orphan-cleanup'
import { noteImageService } from './note-image'
import { trashService } from './trash'

export interface NoteNode {
  id: string
  title: string
  relativePath: string
  description: string
  preview: string
  folderId: string | null
  order: number
  createdAt: Date
  updatedAt: Date
}

function toNoteNode(note: {
  id: string
  title: string
  relativePath: string
  description: string
  preview: string
  folderId: string | null
  order: number
  createdAt: Date | number
  updatedAt: Date | number
}): NoteNode {
  return {
    id: note.id,
    title: note.title,
    relativePath: note.relativePath,
    description: note.description,
    preview: note.preview,
    folderId: note.folderId,
    order: note.order,
    createdAt: note.createdAt instanceof Date ? note.createdAt : new Date(note.createdAt),
    updatedAt: note.updatedAt instanceof Date ? note.updatedAt : new Date(note.updatedAt)
  }
}

export const noteService = {
  /**
   * fs에서 .md 파일 탐색 + lazy upsert + orphan 삭제 → NoteNode[] 반환
   */
  readByWorkspace(workspaceId: string): NoteNode[] {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const workspacePath = workspace.path
    try {
      fs.accessSync(workspacePath)
    } catch {
      throw new ValidationError(`워크스페이스 경로에 접근할 수 없습니다: ${workspacePath}`)
    }

    // 1. fs 탐색 (.md 파일)
    const fsEntries = readMdFilesRecursive(workspacePath, '')
    const fsPaths = fsEntries.map((e) => e.relativePath)

    // 2. DB 현재 rows
    const dbNotes = noteRepository.findByWorkspaceId(workspaceId)
    const dbPathSet = new Set(dbNotes.map((n) => n.relativePath))

    // 3. 새 경로(fs에만 있음) vs orphan(DB에만 있음) 분류
    const fsPathSet = new Set(fsPaths)
    const newFsEntries = fsEntries.filter((e) => !dbPathSet.has(e.relativePath))
    const orphanedNotes = dbNotes.filter((n) => !fsPathSet.has(n.relativePath))

    // 4. 이동 감지: 새 경로와 orphan의 파일명이 같으면 이동으로 간주 → ID 보존
    // orphan은 basename 기준으로 첫 번째만 매칭 (동명 파일 중복 시 첫 번째 우선)
    const orphanByBasename = new Map<string, (typeof orphanedNotes)[0]>()
    for (const orphan of orphanedNotes) {
      const basename = path.basename(orphan.relativePath)
      if (!orphanByBasename.has(basename)) orphanByBasename.set(basename, orphan)
    }

    const now = new Date()
    const allFolders = folderRepository.findByWorkspaceId(workspaceId)
    const folderMap = new Map(allFolders.map((f) => [f.relativePath, f]))
    const toInsert: Parameters<typeof noteRepository.createMany>[0] = []
    for (const entry of newFsEntries) {
      const matchedOrphan = orphanByBasename.get(entry.name)
      const parentRel = parentRelPath(entry.relativePath)
      const folder = parentRel ? (folderMap.get(parentRel) ?? null) : null
      if (matchedOrphan) {
        // 이동으로 간주: 경로·폴더·타이틀만 갱신, ID는 유지
        noteRepository.update(matchedOrphan.id, {
          relativePath: entry.relativePath,
          folderId: folder?.id ?? null,
          title: entry.name.replace(/\.md$/, ''),
          updatedAt: now
        })
        orphanByBasename.delete(entry.name)
      } else {
        toInsert.push({
          id: nanoid(),
          workspaceId,
          folderId: folder?.id ?? null,
          relativePath: entry.relativePath,
          title: entry.name.replace(/\.md$/, ''),
          description: '',
          preview: '',
          order: 0,
          createdAt: now,
          updatedAt: now
        })
      }
    }
    noteRepository.createMany(toInsert)

    // 5. 이동 감지에서 제외된 진짜 orphan만 삭제
    // (update된 record는 이미 새 경로로 바뀌었으므로 deleteOrphans에서 보존됨)
    const dbNotesAfterUpsert = noteRepository.findByWorkspaceId(workspaceId)
    const orphanIds = dbNotesAfterUpsert
      .filter((n) => !fsPathSet.has(n.relativePath))
      .map((n) => n.id)
    cleanupOrphansAndDelete('note', orphanIds, () =>
      noteRepository.deleteOrphans(workspaceId, fsPaths)
    )

    // 6. 최신 DB rows 반환
    return noteRepository.findByWorkspaceId(workspaceId).map(toNoteNode)
  },

  /**
   * DB만 읽어 즉시 반환 — fs 스캔 없음, IPC 핸들러용 (non-blocking)
   * reconciliation은 workspaceWatcher가 백그라운드에서 수행하고
   * 완료 후 'note:changed' push([], empty) → renderer re-fetch
   */
  readByWorkspaceFromDb(workspaceId: string): NoteNode[] {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)
    return noteRepository.findByWorkspaceId(workspaceId).map(toNoteNode)
  },

  /**
   * 외부 .md 파일을 workspace로 복사 + DB 등록
   */
  import(workspaceId: string, folderId: string | null, sourcePath: string): NoteNode {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    if (!sourcePath.toLowerCase().endsWith('.md')) {
      throw new ValidationError(`Markdown(.md) 파일만 가져올 수 있습니다: ${sourcePath}`)
    }

    let folderRelPath: string | null = null
    if (folderId) {
      const folder = folderRepository.findById(folderId)
      if (!folder) throw new NotFoundError(`Folder not found: ${folderId}`)
      folderRelPath = folder.relativePath
    }

    const parentAbs = folderRelPath ? path.join(workspace.path, folderRelPath) : workspace.path
    const sourceBaseName = path.basename(sourcePath)
    const finalFileName = resolveNameConflict(parentAbs, sourceBaseName)
    const title = finalFileName.replace(/\.md$/, '')

    const destAbs = path.join(parentAbs, finalFileName)
    const destRel = normalizePath(
      folderRelPath ? `${folderRelPath}/${finalFileName}` : finalFileName
    )

    fs.copyFileSync(sourcePath, destAbs)

    let preview = ''
    try {
      const content = fs.readFileSync(destAbs, 'utf-8')
      preview = content.slice(0, 200).replace(/\s+/g, ' ').trim()
    } catch {
      // 읽기 실패 시 빈 preview로 폴백
    }

    const siblings = getLeafSiblings(workspaceId, folderId)
    const maxOrder = siblings.length > 0 ? Math.max(...siblings.map((s) => s.order)) : -1
    const now = new Date()

    const row = noteRepository.create({
      id: nanoid(),
      workspaceId,
      folderId,
      relativePath: destRel,
      title,
      description: '',
      preview,
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now
    })

    return toNoteNode(row)
  },

  /**
   * 새 노트 생성 (disk + DB)
   */
  create(workspaceId: string, folderId: string | null, name: string): NoteNode {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    let folderRelPath: string | null = null
    if (folderId) {
      const folder = folderRepository.findById(folderId)
      if (!folder) throw new NotFoundError(`Folder not found: ${folderId}`)
      folderRelPath = folder.relativePath
    }

    const parentAbs = folderRelPath ? path.join(workspace.path, folderRelPath) : workspace.path

    const desiredFileName = (name.trim() || '새로운 노트') + '.md'
    const finalFileName = resolveNameConflict(parentAbs, desiredFileName)
    const title = finalFileName.replace(/\.md$/, '')

    const newAbs = path.join(parentAbs, finalFileName)
    const newRel = normalizePath(
      folderRelPath ? `${folderRelPath}/${finalFileName}` : finalFileName
    )

    fs.writeFileSync(newAbs, '', 'utf-8')

    // maxOrder: note + csv 혼합 siblings에서 최대값
    const siblings = getLeafSiblings(workspaceId, folderId)
    const maxOrder = siblings.length > 0 ? Math.max(...siblings.map((s) => s.order)) : -1
    const now = new Date()

    const row = noteRepository.create({
      id: nanoid(),
      workspaceId,
      folderId,
      relativePath: newRel,
      title,
      description: '',
      preview: '',
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now
    })

    return toNoteNode(row)
  },

  /**
   * 노트 복제 — 같은 폴더에 "name (n).md"로 복사 + DB 등록
   */
  duplicate(workspaceId: string, noteId: string): NoteNode {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const note = noteRepository.findById(noteId)
    if (!note) throw new NotFoundError(`Note not found: ${noteId}`)

    const folderRel = parentRelPath(note.relativePath)
    const parentAbs = folderRel ? path.join(workspace.path, folderRel) : workspace.path

    const sourceFileName = path.basename(note.relativePath)
    const finalFileName = resolveNameConflict(parentAbs, sourceFileName)
    const title = finalFileName.replace(/\.md$/, '')

    const sourceAbs = path.join(workspace.path, note.relativePath)
    const destAbs = path.join(parentAbs, finalFileName)
    const destRel = normalizePath(folderRel ? `${folderRel}/${finalFileName}` : finalFileName)

    fs.copyFileSync(sourceAbs, destAbs)

    let preview = ''
    try {
      const content = fs.readFileSync(destAbs, 'utf-8')
      preview = content.slice(0, 200).replace(/\s+/g, ' ').trim()
    } catch {
      // 읽기 실패 시 빈 preview로 폴백
    }

    const now = new Date()
    const newId = nanoid()

    noteRepository.create({
      id: newId,
      workspaceId,
      folderId: note.folderId,
      relativePath: destRel,
      title,
      description: '',
      preview,
      order: 0,
      createdAt: now,
      updatedAt: now
    })

    // 원본 바로 아래에 위치하도록 siblings reindex
    const siblings = getLeafSiblings(workspaceId, note.folderId).filter((s) => s.id !== newId)
    const sourceIndex = siblings.findIndex((s) => s.id === noteId)
    const insertAt = sourceIndex >= 0 ? sourceIndex + 1 : siblings.length
    siblings.splice(insertAt, 0, { id: newId, kind: 'note', order: 0 })
    reindexLeafSiblings(
      workspaceId,
      siblings.map((s) => ({ id: s.id, kind: s.kind }))
    )

    return toNoteNode(noteRepository.findById(newId)!)
  },

  /**
   * 노트 이름 변경 (disk + DB)
   */
  rename(workspaceId: string, noteId: string, newName: string): NoteNode {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const note = noteRepository.findById(noteId)
    if (!note) throw new NotFoundError(`Note not found: ${noteId}`)

    if (newName.trim() === note.title) return toNoteNode(note)

    const folderRel = parentRelPath(note.relativePath)
    const parentAbs = folderRel ? path.join(workspace.path, folderRel) : workspace.path

    const desiredFileName = newName.trim() + '.md'
    const finalFileName = resolveNameConflict(parentAbs, desiredFileName)
    const title = finalFileName.replace(/\.md$/, '')

    const oldAbs = path.join(workspace.path, note.relativePath)
    const newRel = normalizePath(folderRel ? `${folderRel}/${finalFileName}` : finalFileName)
    const newAbs = path.join(workspace.path, newRel)

    fs.renameSync(oldAbs, newAbs)

    const updated = noteRepository.update(noteId, {
      relativePath: newRel,
      title,
      updatedAt: new Date()
    })!

    return toNoteNode(updated)
  },

  /**
   * 노트 삭제. 기본은 휴지통 이동(soft delete). permanent=true: 즉시 영구 삭제 (이미지 cleanup + fs unlink).
   */
  remove(workspaceId: string, noteId: string, options: { permanent?: boolean } = {}): void {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const note = noteRepository.findById(noteId)
    if (!note) throw new NotFoundError(`Note not found: ${noteId}`)

    if (!options.permanent) {
      // 휴지통 이동 — fs는 trashService가 워크스페이스 밖 .trash로 옮김.
      // .images 참조는 그대로 보존 (복구 시 자동 작동). 영구 삭제 시(purge) 함께 정리.
      trashService.softRemove(workspaceId, 'note', noteId)
      return
    }

    // 영구 삭제 경로
    const absPath = path.join(workspace.path, note.relativePath)
    try {
      const content = fs.readFileSync(absPath, 'utf-8')
      noteImageService.deleteAllImages(workspaceId, content)
    } catch {
      // 파일 읽기 실패 시 무시
    }
    try {
      fs.unlinkSync(absPath)
    } catch {
      // 이미 외부에서 삭제된 경우 무시 (DB만 정리)
    }
    cleanupOrphansAndDelete('note', [noteId], () => noteRepository.delete(noteId))
  },

  /**
   * .md 파일 내용 읽기
   */
  readContent(workspaceId: string, noteId: string): string {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const note = noteRepository.findById(noteId)
    if (!note) throw new NotFoundError(`Note not found: ${noteId}`)

    const absPath = path.join(workspace.path, note.relativePath)
    try {
      return fs.readFileSync(absPath, 'utf-8')
    } catch {
      throw new NotFoundError(`파일을 읽을 수 없습니다: ${absPath}`)
    }
  },

  /**
   * .md 파일 내용 저장 + preview 자동 업데이트
   */
  writeContent(workspaceId: string, noteId: string, content: string): void {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const note = noteRepository.findById(noteId)
    if (!note) throw new NotFoundError(`Note not found: ${noteId}`)

    const absPath = path.join(workspace.path, note.relativePath)

    // 저장 전 기존 내용 읽어서 제거된 이미지 파일 삭제
    try {
      const oldContent = fs.readFileSync(absPath, 'utf-8')
      noteImageService.cleanupRemovedImages(workspaceId, oldContent, content)
    } catch {
      // 파일이 아직 없거나 읽기 실패 시 무시
    }

    fs.writeFileSync(absPath, content, 'utf-8')

    const preview = content.slice(0, 200).replace(/\s+/g, ' ').trim()
    noteRepository.update(noteId, { preview, updatedAt: new Date() })
  },

  /**
   * 노트 이동 (DnD) — 다른 폴더로 이동 + siblings reindex
   * index: react-arborist가 전달하는 새 위치 (0-based)
   */
  move(
    workspaceId: string,
    noteId: string,
    targetFolderId: string | null,
    index: number
  ): NoteNode {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const note = noteRepository.findById(noteId)
    if (!note) throw new NotFoundError(`Note not found: ${noteId}`)

    let targetFolderRel: string | null = null
    if (targetFolderId) {
      const folder = folderRepository.findById(targetFolderId)
      if (!folder) throw new NotFoundError(`Folder not found: ${targetFolderId}`)
      targetFolderRel = folder.relativePath
    }

    const noteFileName = note.relativePath.split('/').at(-1)!
    const isSameFolder = note.folderId === targetFolderId

    let finalRel = note.relativePath
    let finalTitle = note.title

    if (!isSameFolder) {
      const parentAbs = targetFolderRel
        ? path.join(workspace.path, targetFolderRel)
        : workspace.path
      const finalFileName = resolveNameConflict(parentAbs, noteFileName)
      finalTitle = finalFileName.replace(/\.md$/, '')
      finalRel = normalizePath(
        targetFolderRel ? `${targetFolderRel}/${finalFileName}` : finalFileName
      )

      const oldAbs = path.join(workspace.path, note.relativePath)
      const newAbs = path.join(workspace.path, finalRel)
      fs.renameSync(oldAbs, newAbs)

      noteRepository.update(noteId, {
        folderId: targetFolderId,
        relativePath: finalRel,
        title: finalTitle,
        updatedAt: new Date()
      })
    }

    // 혼합 siblings reindex (note + csv)
    const siblings = getLeafSiblings(workspaceId, targetFolderId)
    const withoutSelf = siblings.filter((s) => s.id !== noteId)
    withoutSelf.splice(index, 0, { id: noteId, kind: 'note', order: 0 })
    reindexLeafSiblings(
      workspaceId,
      withoutSelf.map((s) => ({ id: s.id, kind: s.kind }))
    )

    const updated = noteRepository.findById(noteId)!
    return toNoteNode(updated)
  },

  /**
   * 메타데이터 업데이트 (description)
   */
  async search(
    workspaceId: string,
    query: string
  ): Promise<
    {
      id: string
      title: string
      relativePath: string
      preview: string
      matchType: 'title' | 'content'
    }[]
  > {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const MAX_RESULTS = 50
    const results: {
      id: string
      title: string
      relativePath: string
      preview: string
      matchType: 'title' | 'content'
    }[] = []

    const titleMatches = noteRepository.searchByTitle(workspaceId, query)

    const titleMatchIds = new Set<string>()
    for (const note of titleMatches) {
      if (results.length >= MAX_RESULTS) break
      results.push({
        id: note.id,
        title: note.title,
        relativePath: note.relativePath,
        preview: note.preview,
        matchType: 'title'
      })
      titleMatchIds.add(note.id)
    }

    if (results.length < MAX_RESULTS) {
      const allNotes = noteRepository.findByWorkspaceId(workspaceId)
      const remaining = allNotes.filter((n) => !titleMatchIds.has(n.id))
      const lowerQuery = query.toLowerCase()

      const CHUNK_SIZE = 10
      for (let i = 0; i < remaining.length && results.length < MAX_RESULTS; i += CHUNK_SIZE) {
        const chunk = remaining.slice(i, i + CHUNK_SIZE)
        const readResults = await Promise.all(
          chunk.map(async (note) => {
            try {
              const absPath = path.join(workspace.path, note.relativePath)
              const content = await fs.promises.readFile(absPath, 'utf-8')
              if (content.toLowerCase().includes(lowerQuery)) {
                return {
                  id: note.id,
                  title: note.title,
                  relativePath: note.relativePath,
                  preview: note.preview,
                  matchType: 'content' as const
                }
              }
            } catch {
              // 파일 읽기 실패 시 무시
            }
            return null
          })
        )
        for (const r of readResults) {
          if (r && results.length < MAX_RESULTS) results.push(r)
        }
      }
    }

    return results
  },

  updateMeta(_workspaceId: string, noteId: string, data: { description?: string }): NoteNode {
    const note = noteRepository.findById(noteId)
    if (!note) throw new NotFoundError(`Note not found: ${noteId}`)

    const updated = noteRepository.update(noteId, {
      ...data,
      updatedAt: new Date()
    })!

    return toNoteNode(updated)
  }
}
