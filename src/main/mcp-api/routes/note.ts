import type { Router } from '../router'
import { noteService } from '../../services/note'
import { noteRepository } from '../../repositories/note'
import { folderRepository } from '../../repositories/folder'
import { NotFoundError, ValidationError } from '../../lib/errors'
import { broadcastChanged } from '../lib/broadcast'

function requireBody(body: unknown): asserts body is Record<string, unknown> {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body is required')
  }
}

export function registerNoteRoutes(router: Router): void {
  // GET /api/workspaces/:wsId/notes
  router.addRoute('GET', '/api/workspaces/:wsId/notes', (params) => {
    const notes = noteService.readByWorkspaceFromDb(params.wsId)
    const folders = folderRepository.findByWorkspaceId(params.wsId)
    const folderMap = new Map(folders.map((f) => [f.id, f.relativePath]))

    return {
      notes: notes.map((n) => ({
        id: n.id,
        title: n.title,
        relativePath: n.relativePath,
        preview: n.preview,
        folderId: n.folderId,
        folderPath: n.folderId ? (folderMap.get(n.folderId) ?? null) : null,
        updatedAt: n.updatedAt.toISOString()
      }))
    }
  })

  // GET /api/workspaces/:wsId/notes/:noteId/content
  router.addRoute('GET', '/api/workspaces/:wsId/notes/:noteId/content', (params) => {
    const note = noteRepository.findById(params.noteId)
    if (!note) throw new NotFoundError(`Note not found: ${params.noteId}`)

    const content = noteService.readContent(params.wsId, params.noteId)
    return {
      title: note.title,
      relativePath: note.relativePath,
      content
    }
  })

  // PUT /api/workspaces/:wsId/notes/:noteId/content
  router.addRoute<{ content: string }>(
    'PUT',
    '/api/workspaces/:wsId/notes/:noteId/content',
    (params, body) => {
      requireBody(body)
      const note = noteRepository.findById(params.noteId)
      if (!note) throw new NotFoundError(`Note not found: ${params.noteId}`)

      noteService.writeContent(params.wsId, params.noteId, body.content)

      broadcastChanged('note:changed', params.wsId, [note.relativePath])

      return {
        success: true,
        title: note.title,
        relativePath: note.relativePath
      }
    }
  )

  // POST /api/workspaces/:wsId/notes
  router.addRoute<{ title: string; folderId?: string; content?: string }>(
    'POST',
    '/api/workspaces/:wsId/notes',
    (params, body) => {
      requireBody(body)
      const folderId = body.folderId ?? null
      const result = noteService.create(params.wsId, folderId, body.title)

      try {
        if (body.content) {
          noteService.writeContent(params.wsId, result.id, body.content)
        }
      } finally {
        broadcastChanged('note:changed', params.wsId, [result.relativePath])
      }

      return {
        id: result.id,
        title: result.title,
        relativePath: result.relativePath
      }
    }
  )

  // PATCH /api/workspaces/:wsId/notes/:noteId/rename
  router.addRoute<{ newName: string }>(
    'PATCH',
    '/api/workspaces/:wsId/notes/:noteId/rename',
    (params, body) => {
      requireBody(body)
      const oldNote = noteRepository.findById(params.noteId)
      if (!oldNote) throw new NotFoundError(`Note not found: ${params.noteId}`)

      const result = noteService.rename(params.wsId, params.noteId, body.newName)

      broadcastChanged('note:changed', params.wsId, [oldNote.relativePath, result.relativePath])

      return {
        id: result.id,
        title: result.title,
        relativePath: result.relativePath
      }
    }
  )

  // PATCH /api/workspaces/:wsId/notes/:noteId/move
  router.addRoute<{ targetFolderId?: string }>(
    'PATCH',
    '/api/workspaces/:wsId/notes/:noteId/move',
    (params, body) => {
      requireBody(body)
      const oldNote = noteRepository.findById(params.noteId)
      if (!oldNote) throw new NotFoundError(`Note not found: ${params.noteId}`)

      const targetFolderId = body.targetFolderId ?? null
      const result = noteService.move(params.wsId, params.noteId, targetFolderId, 0)

      broadcastChanged('note:changed', params.wsId, [oldNote.relativePath, result.relativePath])

      return {
        id: result.id,
        title: result.title,
        relativePath: result.relativePath,
        folderId: result.folderId
      }
    }
  )
}
