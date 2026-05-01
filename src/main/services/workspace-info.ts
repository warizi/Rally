import { and, count, eq } from 'drizzle-orm'
import { db } from '../db'
import {
  folders,
  notes,
  csvFiles,
  canvases,
  pdfFiles,
  imageFiles,
  schedules,
  tags,
  templates,
  recurringRules
} from '../db/schema'
import { NotFoundError } from '../lib/errors'
import { workspaceRepository } from '../repositories/workspace'
import { todoRepository } from '../repositories/todo'

export type StatsKind =
  | 'folders'
  | 'notes'
  | 'tables'
  | 'canvases'
  | 'todos'
  | 'pdfs'
  | 'images'
  | 'schedules'
  | 'tags'
  | 'templates'
  | 'recurringRules'

export interface WorkspaceStats {
  folders: number
  notes: number
  tables: number
  canvases: number
  todos: { active: number; completed: number; total: number }
  pdfs: number
  images: number
  schedules: number
  tags: number
  templates: { note: number; csv: number; total: number }
  recurringRules: number
}

export interface RecentActivityEntry {
  type: 'note' | 'table' | 'canvas' | 'todo'
  id: string
  title: string
  updatedAt: string
}

export interface WorkspaceInfo {
  id: string
  name: string
  path: string
  createdAt: string
  updatedAt: string
  stats: WorkspaceStats
  recentActivity: RecentActivityEntry[]
}

function countFolders(wsId: string): number {
  return db.select({ n: count() }).from(folders).where(eq(folders.workspaceId, wsId)).get()?.n ?? 0
}
function countNotes(wsId: string): number {
  return db.select({ n: count() }).from(notes).where(eq(notes.workspaceId, wsId)).get()?.n ?? 0
}
function countCsvFiles(wsId: string): number {
  return (
    db.select({ n: count() }).from(csvFiles).where(eq(csvFiles.workspaceId, wsId)).get()?.n ?? 0
  )
}
function countCanvases(wsId: string): number {
  return (
    db.select({ n: count() }).from(canvases).where(eq(canvases.workspaceId, wsId)).get()?.n ?? 0
  )
}
function countPdfs(wsId: string): number {
  return (
    db.select({ n: count() }).from(pdfFiles).where(eq(pdfFiles.workspaceId, wsId)).get()?.n ?? 0
  )
}
function countImages(wsId: string): number {
  return (
    db.select({ n: count() }).from(imageFiles).where(eq(imageFiles.workspaceId, wsId)).get()?.n ?? 0
  )
}
function countSchedules(wsId: string): number {
  return (
    db.select({ n: count() }).from(schedules).where(eq(schedules.workspaceId, wsId)).get()?.n ?? 0
  )
}
function countTags(wsId: string): number {
  return db.select({ n: count() }).from(tags).where(eq(tags.workspaceId, wsId)).get()?.n ?? 0
}
function countRecurringRules(wsId: string): number {
  return (
    db.select({ n: count() }).from(recurringRules).where(eq(recurringRules.workspaceId, wsId)).get()
      ?.n ?? 0
  )
}
function countTemplatesByType(wsId: string): { note: number; csv: number } {
  const noteN =
    db
      .select({ n: count() })
      .from(templates)
      .where(and(eq(templates.workspaceId, wsId), eq(templates.type, 'note')))
      .get()?.n ?? 0
  const csvN =
    db
      .select({ n: count() })
      .from(templates)
      .where(and(eq(templates.workspaceId, wsId), eq(templates.type, 'csv')))
      .get()?.n ?? 0
  return { note: noteN, csv: csvN }
}

export const workspaceInfoService = {
  /** 활성 워크스페이스의 카운트 통계만 반환 (저비용) */
  getStats(workspaceId: string, kinds?: StatsKind[]): Partial<WorkspaceStats> {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const want = (k: StatsKind): boolean => !kinds || kinds.includes(k)
    const result: Partial<WorkspaceStats> = {}

    if (want('folders')) result.folders = countFolders(workspaceId)
    if (want('notes')) result.notes = countNotes(workspaceId)
    if (want('tables')) result.tables = countCsvFiles(workspaceId)
    if (want('canvases')) result.canvases = countCanvases(workspaceId)
    if (want('todos')) result.todos = todoRepository.countByWorkspaceId(workspaceId)
    if (want('pdfs')) result.pdfs = countPdfs(workspaceId)
    if (want('images')) result.images = countImages(workspaceId)
    if (want('schedules')) result.schedules = countSchedules(workspaceId)
    if (want('tags')) result.tags = countTags(workspaceId)
    if (want('templates')) {
      const counts = countTemplatesByType(workspaceId)
      result.templates = { ...counts, total: counts.note + counts.csv }
    }
    if (want('recurringRules')) result.recurringRules = countRecurringRules(workspaceId)

    return result
  },

  /** 워크스페이스 메타 + 모든 stats + 최근 활동 항목 */
  getInfo(workspaceId: string, recentLimit: number = 10): WorkspaceInfo {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const stats = this.getStats(workspaceId) as WorkspaceStats

    // 최근 활동: note/csv/canvas/todo updatedAt desc TOP recentLimit.
    // SQL ORDER BY + LIMIT을 도메인별로 적용해 fetch 양 자체를 recentLimit*4로 제한.
    const noteRows = db
      .select({ id: notes.id, title: notes.title, updatedAt: notes.updatedAt })
      .from(notes)
      .where(eq(notes.workspaceId, workspaceId))
      .all()
    const csvRows = db
      .select({ id: csvFiles.id, title: csvFiles.title, updatedAt: csvFiles.updatedAt })
      .from(csvFiles)
      .where(eq(csvFiles.workspaceId, workspaceId))
      .all()
    const canvasRows = db
      .select({ id: canvases.id, title: canvases.title, updatedAt: canvases.updatedAt })
      .from(canvases)
      .where(eq(canvases.workspaceId, workspaceId))
      .all()
    const todoRows = todoRepository.findByWorkspaceWithFilters(workspaceId, { filter: 'all' })

    const merged: RecentActivityEntry[] = [
      ...noteRows.map((r) => ({
        type: 'note' as const,
        id: r.id,
        title: r.title,
        updatedAt: (r.updatedAt instanceof Date ? r.updatedAt : new Date(r.updatedAt)).toISOString()
      })),
      ...csvRows.map((r) => ({
        type: 'table' as const,
        id: r.id,
        title: r.title,
        updatedAt: (r.updatedAt instanceof Date ? r.updatedAt : new Date(r.updatedAt)).toISOString()
      })),
      ...canvasRows.map((r) => ({
        type: 'canvas' as const,
        id: r.id,
        title: r.title,
        updatedAt: (r.updatedAt instanceof Date ? r.updatedAt : new Date(r.updatedAt)).toISOString()
      })),
      ...todoRows.map((t) => ({
        type: 'todo' as const,
        id: t.id,
        title: t.title,
        updatedAt: t.updatedAt.toISOString()
      }))
    ]
    merged.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    const recentActivity = merged.slice(0, recentLimit)

    return {
      id: workspace.id,
      name: workspace.name,
      path: workspace.path,
      createdAt: workspace.createdAt.toISOString(),
      updatedAt: workspace.updatedAt.toISOString(),
      stats,
      recentActivity
    }
  }
}
