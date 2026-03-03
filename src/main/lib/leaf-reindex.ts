import { db } from '../db'
import { noteRepository } from '../repositories/note'
import { csvFileRepository } from '../repositories/csv-file'
import { pdfFileRepository } from '../repositories/pdf-file'
import { imageFileRepository } from '../repositories/image-file'

export interface LeafSibling {
  id: string
  kind: 'note' | 'csv' | 'pdf' | 'image'
  order: number
}

/**
 * 같은 폴더 내 모든 leaf siblings (note + csv) 조회, order 기준 정렬
 */
export function getLeafSiblings(workspaceId: string, folderId: string | null): LeafSibling[] {
  const notes = noteRepository
    .findByWorkspaceId(workspaceId)
    .filter((n) => n.folderId === folderId)
    .map((n) => ({ id: n.id, kind: 'note' as const, order: n.order }))
  const csvs = csvFileRepository
    .findByWorkspaceId(workspaceId)
    .filter((c) => c.folderId === folderId)
    .map((c) => ({ id: c.id, kind: 'csv' as const, order: c.order }))
  const pdfs = pdfFileRepository
    .findByWorkspaceId(workspaceId)
    .filter((p) => p.folderId === folderId)
    .map((p) => ({ id: p.id, kind: 'pdf' as const, order: p.order }))
  const images = imageFileRepository
    .findByWorkspaceId(workspaceId)
    .filter((i) => i.folderId === folderId)
    .map((i) => ({ id: i.id, kind: 'image' as const, order: i.order }))
  return [...notes, ...csvs, ...pdfs, ...images].sort((a, b) => a.order - b.order)
}

/**
 * 혼합 siblings를 한 트랜잭션 안에서 reindex
 * orderedItems: 최종 순서가 결정된 { id, kind } 배열
 */
export function reindexLeafSiblings(
  workspaceId: string,
  orderedItems: Array<{ id: string; kind: 'note' | 'csv' | 'pdf' | 'image' }>
): void {
  const now = Date.now()
  const noteStmt = db.$client.prepare(
    `UPDATE notes SET "order" = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`
  )
  const csvStmt = db.$client.prepare(
    `UPDATE csv_files SET "order" = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`
  )
  const pdfStmt = db.$client.prepare(
    `UPDATE pdf_files SET "order" = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`
  )
  const imageStmt = db.$client.prepare(
    `UPDATE image_files SET "order" = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`
  )
  db.$client.transaction(() => {
    orderedItems.forEach((item, i) => {
      if (item.kind === 'note') {
        noteStmt.run(i, now, workspaceId, item.id)
      } else if (item.kind === 'csv') {
        csvStmt.run(i, now, workspaceId, item.id)
      } else if (item.kind === 'pdf') {
        pdfStmt.run(i, now, workspaceId, item.id)
      } else {
        imageStmt.run(i, now, workspaceId, item.id)
      }
    })
  })()
}
