/**
 * MCP v2 read 라우트.
 *
 * 흡수: read_contents (note/csv) + read_canvas + list_templates(id) 단건 모드.
 * 확장: pdf/image 메타 + template 본문 + mixed type 배치 (최대 50건).
 *
 * type 자동 감지 — id 만 알면 됨. 각 entry 는 독립 실행 (한 id 실패가 다른 ids 영향 X).
 *
 * 응답 entry shape (성공 시):
 *   note    : { id, success: true, type: 'note',     title, relativePath, content }
 *   csv     : { id, success: true, type: 'csv',      title, relativePath, content, encoding, columnWidths }
 *   canvas  : { id, success: true, type: 'canvas',   title, description, nodes, edges, createdAt, updatedAt }
 *   pdf     : { id, success: true, type: 'pdf',      title, relativePath, description, folderId, createdAt, updatedAt }
 *   image   : { id, success: true, type: 'image',    title, relativePath, description, folderId, createdAt, updatedAt }
 *   template: { id, success: true, type: 'template', title, templateType, jsonData, createdAt }
 *
 * 실패 entry: { id, success: false, error: { code, message } }
 */
import type { Router } from '../../router'
import { NotFoundError, ValidationError } from '../../../lib/errors'
import { noteRepository } from '../../../repositories/note'
import { csvFileRepository } from '../../../repositories/csv-file'
import { canvasRepository } from '../../../repositories/canvas'
import { pdfFileRepository } from '../../../repositories/pdf-file'
import { imageFileRepository } from '../../../repositories/image-file'
import { templateRepository } from '../../../repositories/template'
import { noteService } from '../../../services/note'
import { csvFileService } from '../../../services/csv-file'
import { canvasNodeService } from '../../../services/canvas-node'
import { canvasEdgeService } from '../../../services/canvas-edge'
import { requireBody, resolveActiveWorkspace, assertValidId } from './helpers'

type ReadEntry =
  | {
      id: string
      success: true
      type: 'note'
      title: string
      relativePath: string
      content: string
    }
  | {
      id: string
      success: true
      type: 'csv'
      title: string
      relativePath: string
      content: string
      encoding: string
      columnWidths: string | null
    }
  | {
      id: string
      success: true
      type: 'canvas'
      title: string
      description: string | null
      nodes: ReturnType<typeof canvasNodeService.findByCanvas>
      edges: ReturnType<typeof canvasEdgeService.findByCanvas>
      createdAt: string
      updatedAt: string
    }
  | {
      id: string
      success: true
      type: 'pdf'
      title: string
      relativePath: string
      description: string
      folderId: string | null
      createdAt: string
      updatedAt: string
    }
  | {
      id: string
      success: true
      type: 'image'
      title: string
      relativePath: string
      description: string
      folderId: string | null
      createdAt: string
      updatedAt: string
    }
  | {
      id: string
      success: true
      type: 'template'
      title: string
      templateType: 'note' | 'csv'
      jsonData: string
      createdAt: string
    }
  | { id: string; success: false; error: { code: string; message: string } }

function toIso(d: Date | number | string): string {
  if (d instanceof Date) return d.toISOString()
  if (typeof d === 'string') return new Date(d).toISOString()
  return new Date(d).toISOString()
}

export function registerMcpReadRoutes(router: Router): void {
  router.addRoute<{ ids: string[] }>('POST', '/api/mcp/read', (_, body) => {
    requireBody(body)
    const wsId = resolveActiveWorkspace()
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      throw new ValidationError('ids array is required')
    }
    if (body.ids.length > 50) {
      throw new ValidationError(`Batch size ${body.ids.length} exceeds limit 50.`)
    }

    const results: ReadEntry[] = body.ids.map((id): ReadEntry => {
      try {
        assertValidId(id, 'id')

        const note = noteRepository.findById(id)
        if (note && note.workspaceId === wsId) {
          const content = noteService.readContent(wsId, id)
          return {
            id,
            success: true,
            type: 'note',
            title: note.title,
            relativePath: note.relativePath,
            content
          }
        }

        const csv = csvFileRepository.findById(id)
        if (csv && csv.workspaceId === wsId) {
          const { content, encoding, columnWidths } = csvFileService.readContent(wsId, id)
          return {
            id,
            success: true,
            type: 'csv',
            title: csv.title,
            relativePath: csv.relativePath,
            content,
            encoding,
            columnWidths
          }
        }

        const canvas = canvasRepository.findById(id)
        if (canvas && canvas.workspaceId === wsId) {
          const nodes = canvasNodeService.findByCanvas(id)
          const edges = canvasEdgeService.findByCanvas(id)
          return {
            id,
            success: true,
            type: 'canvas',
            title: canvas.title,
            description: canvas.description,
            nodes,
            edges,
            createdAt: toIso(canvas.createdAt),
            updatedAt: toIso(canvas.updatedAt)
          }
        }

        const pdf = pdfFileRepository.findById(id)
        if (pdf && pdf.workspaceId === wsId) {
          return {
            id,
            success: true,
            type: 'pdf',
            title: pdf.title,
            relativePath: pdf.relativePath,
            description: pdf.description,
            folderId: pdf.folderId,
            createdAt: toIso(pdf.createdAt),
            updatedAt: toIso(pdf.updatedAt)
          }
        }

        const image = imageFileRepository.findById(id)
        if (image && image.workspaceId === wsId) {
          return {
            id,
            success: true,
            type: 'image',
            title: image.title,
            relativePath: image.relativePath,
            description: image.description,
            folderId: image.folderId,
            createdAt: toIso(image.createdAt),
            updatedAt: toIso(image.updatedAt)
          }
        }

        const template = templateRepository.findById(id)
        if (template && template.workspaceId === wsId) {
          return {
            id,
            success: true,
            type: 'template',
            title: template.title,
            templateType: template.type,
            jsonData: template.jsonData,
            createdAt: toIso(template.createdAt)
          }
        }

        throw new NotFoundError(`Item not found in active workspace: ${id}`)
      } catch (e) {
        const err = e as Error
        return {
          id,
          success: false,
          error: { code: err.constructor.name, message: err.message }
        }
      }
    })

    return { results }
  })
}
