/**
 * MCP v2 manage_items 라우트.
 *
 * 흡수: manage_items (note/csv) + manage_folders + manage_files (pdf/image).
 *
 * actions:
 *   - rename: { action:'rename', id, newName }                      — id 로 type 자동 감지
 *   - move:   { action:'move', id, targetFolderId? }                — id 로 type 자동 감지
 *   - delete: { action:'delete', id }                               — id 로 type 자동 감지 (소프트 delete)
 *   - create_folder: { action:'create_folder', name, parentFolderId? }
 *   - update_meta:   { action:'update_meta', id, description? }     — pdf/image 만 (id 로 검증)
 */
import type { Router } from '../../router'
import { NotFoundError, ValidationError } from '../../../lib/errors'
import { mcpErrorBody } from '../../lib/mcp-error'
import { noteService } from '../../../services/note'
import { csvFileService } from '../../../services/csv-file'
import { canvasService } from '../../../services/canvas'
import { pdfFileService } from '../../../services/pdf-file'
import { imageFileService } from '../../../services/image-file'
import { folderService } from '../../../services/folder'
import { noteRepository } from '../../../repositories/note'
import { csvFileRepository } from '../../../repositories/csv-file'
import { canvasRepository } from '../../../repositories/canvas'
import { pdfFileRepository } from '../../../repositories/pdf-file'
import { imageFileRepository } from '../../../repositories/image-file'
import { folderRepository } from '../../../repositories/folder'
import { broadcastChanged } from '../../lib/broadcast'
import { requireBody, resolveActiveWorkspace, assertValidId } from './helpers'

type ItemType = 'note' | 'csv' | 'canvas' | 'pdf' | 'image' | 'folder'

type ManageItemAction =
  | { action: 'rename'; id: string; newName: string }
  | { action: 'move'; id: string; targetFolderId?: string }
  | { action: 'delete'; id: string }
  | { action: 'create_folder'; name: string; parentFolderId?: string }
  | { action: 'update_meta'; id: string; description?: string }

type ManageItemResult =
  | { action: string; id: string; type: ItemType; success: true }
  | { action: string; id?: string; success: false; error: { code: string; message: string } }

function detectType(id: string, wsId: string): { type: ItemType; relativePath?: string } | null {
  const note = noteRepository.findById(id)
  if (note && note.workspaceId === wsId) return { type: 'note', relativePath: note.relativePath }
  const csv = csvFileRepository.findById(id)
  if (csv && csv.workspaceId === wsId) return { type: 'csv', relativePath: csv.relativePath }
  const canvas = canvasRepository.findById(id)
  if (canvas && canvas.workspaceId === wsId) return { type: 'canvas' }
  const pdf = pdfFileRepository.findById(id)
  if (pdf && pdf.workspaceId === wsId) return { type: 'pdf', relativePath: pdf.relativePath }
  const image = imageFileRepository.findById(id)
  if (image && image.workspaceId === wsId) return { type: 'image', relativePath: image.relativePath }
  const folder = folderRepository.findById(id)
  if (folder && folder.workspaceId === wsId) return { type: 'folder', relativePath: folder.relativePath }
  return null
}

export function registerMcpManageItemsRoutes(router: Router): void {
  router.addRoute<{ actions: ManageItemAction[] }>(
    'POST',
    '/api/mcp/manage-items/batch',
    (_, body): { results: ManageItemResult[] } => {
      requireBody(body)
      const wsId = resolveActiveWorkspace()
      if (!Array.isArray(body.actions) || body.actions.length === 0) {
        throw new ValidationError('actions array is required')
      }

      const noteAffected: string[] = []
      const csvAffected: string[] = []
      const pdfAffected: string[] = []
      const imageAffected: string[] = []
      let folderTouched = false
      let canvasTouched = false

      const results: ManageItemResult[] = body.actions.map((action): ManageItemResult => {
        try {
          if (action.action === 'create_folder') {
            if (action.parentFolderId) assertValidId(action.parentFolderId, 'parentFolderId')
            const folder = folderService.create(wsId, action.parentFolderId ?? null, action.name)
            folderTouched = true
            return { action: 'create_folder', id: folder.id, type: 'folder', success: true }
          }
          assertValidId(action.id, 'id')
          const detected = detectType(action.id, wsId)
          if (!detected) throw new NotFoundError(`Item not found in active workspace: ${action.id}`)

          if (action.action === 'update_meta') {
            if (detected.type !== 'pdf' && detected.type !== 'image') {
              throw new ValidationError(
                `update_meta is only supported for pdf/image, got: ${detected.type}`
              )
            }
            if (detected.type === 'pdf')
              pdfFileService.updateMeta(wsId, action.id, { description: action.description })
            else imageFileService.updateMeta(wsId, action.id, { description: action.description })
            return { action: 'update_meta', id: action.id, type: detected.type, success: true }
          }

          if (action.action === 'rename') {
            switch (detected.type) {
              case 'note': {
                const old = detected.relativePath!
                const r = noteService.rename(wsId, action.id, action.newName)
                noteAffected.push(old, r.relativePath)
                break
              }
              case 'csv': {
                const old = detected.relativePath!
                const r = csvFileService.rename(wsId, action.id, action.newName)
                csvAffected.push(old, r.relativePath)
                break
              }
              case 'canvas': {
                canvasService.update(action.id, { title: action.newName })
                canvasTouched = true
                break
              }
              case 'pdf': {
                const old = detected.relativePath!
                const r = pdfFileService.rename(wsId, action.id, action.newName)
                pdfAffected.push(old, r.relativePath)
                break
              }
              case 'image': {
                const old = detected.relativePath!
                const r = imageFileService.rename(wsId, action.id, action.newName)
                imageAffected.push(old, r.relativePath)
                break
              }
              case 'folder': {
                folderService.rename(wsId, action.id, action.newName)
                folderTouched = true
                break
              }
            }
            return { action: 'rename', id: action.id, type: detected.type, success: true }
          }

          if (action.action === 'move') {
            if (action.targetFolderId) assertValidId(action.targetFolderId, 'targetFolderId')
            const target = action.targetFolderId ?? null
            switch (detected.type) {
              case 'note': {
                const old = detected.relativePath!
                const r = noteService.move(wsId, action.id, target, 0)
                noteAffected.push(old, r.relativePath)
                break
              }
              case 'csv': {
                const old = detected.relativePath!
                const r = csvFileService.move(wsId, action.id, target, 0)
                csvAffected.push(old, r.relativePath)
                break
              }
              case 'canvas':
                // canvas 는 폴더 구조 없음 — no-op
                throw new ValidationError('canvas does not support move (no folder hierarchy)')
              case 'pdf': {
                const old = detected.relativePath!
                const r = pdfFileService.move(wsId, action.id, target, 0)
                pdfAffected.push(old, r.relativePath)
                break
              }
              case 'image': {
                const old = detected.relativePath!
                const r = imageFileService.move(wsId, action.id, target, 0)
                imageAffected.push(old, r.relativePath)
                break
              }
              case 'folder': {
                folderService.move(wsId, action.id, target, 0)
                folderTouched = true
                break
              }
            }
            return { action: 'move', id: action.id, type: detected.type, success: true }
          }

          // delete (소프트)
          switch (detected.type) {
            case 'note':
              noteAffected.push(detected.relativePath!)
              noteService.remove(wsId, action.id)
              break
            case 'csv':
              csvAffected.push(detected.relativePath!)
              csvFileService.remove(wsId, action.id)
              break
            case 'canvas':
              canvasService.remove(action.id)
              canvasTouched = true
              break
            case 'pdf':
              pdfAffected.push(detected.relativePath!)
              pdfFileService.remove(wsId, action.id)
              break
            case 'image':
              imageAffected.push(detected.relativePath!)
              imageFileService.remove(wsId, action.id)
              break
            case 'folder':
              folderService.remove(wsId, action.id)
              folderTouched = true
              break
          }
          return { action: 'delete', id: action.id, type: detected.type, success: true }
        } catch (e) {
          return {
            action: action.action,
            id: 'id' in action ? action.id : undefined,
            success: false,
            error: mcpErrorBody(e)
          }
        }
      })

      if (noteAffected.length > 0) broadcastChanged('note:changed', wsId, noteAffected)
      if (csvAffected.length > 0) broadcastChanged('csv:changed', wsId, csvAffected)
      if (pdfAffected.length > 0) broadcastChanged('pdf:changed', wsId, pdfAffected)
      if (imageAffected.length > 0) broadcastChanged('image:changed', wsId, imageAffected)
      if (folderTouched) broadcastChanged('folder:changed', wsId, [])
      if (canvasTouched) broadcastChanged('canvas:changed', wsId, [])

      return { results }
    }
  )
}
