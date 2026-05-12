import fs from 'fs'
import os from 'os'
import path from 'path'
import archiver from 'archiver'
import { and, eq } from 'drizzle-orm'
import { app } from 'electron'
import { db } from '../../db'
import {
  folders,
  notes,
  csvFiles,
  pdfFiles,
  imageFiles,
  todos,
  schedules,
  scheduleTodos,
  entityLinks,
  canvases,
  canvasNodes,
  canvasEdges,
  canvasGroups,
  tags,
  itemTags,
  tabSessions,
  tabSnapshots,
  reminders,
  recurringRules,
  recurringCompletions,
  templates,
  terminalLayouts,
  terminalSessions
} from '../../db/schema'
import { workspaceService } from '../workspace'

import type { BackupManifest } from './types'
import { serializeForExport } from './helpers'

/**
 * 백업 export — 워크스페이스 → zip.
 *
 * 1. workspaceId 기반 모든 entity 조회 (Level 1 + Level 2)
 * 2. manifest 생성 (version, appVersion, tables 목록)
 * 3. JSON 파일 직렬화 (Date → number ms)
 * 4. workspace 파일 디렉토리와 함께 zip 패키징 (archiver 스트리밍)
 * 5. 임시 디렉토리 정리
 */
export const backupSerializer = {
  async serialize(workspaceId: string, savePath: string): Promise<void> {
    const workspace = workspaceService.getById(workspaceId)

    // Level 1: workspaceId 직접 FK
    const foldersData = db.select().from(folders).where(eq(folders.workspaceId, workspaceId)).all()
    const notesData = db.select().from(notes).where(eq(notes.workspaceId, workspaceId)).all()
    const csvData = db.select().from(csvFiles).where(eq(csvFiles.workspaceId, workspaceId)).all()
    const pdfData = db.select().from(pdfFiles).where(eq(pdfFiles.workspaceId, workspaceId)).all()
    const imageData = db
      .select()
      .from(imageFiles)
      .where(eq(imageFiles.workspaceId, workspaceId))
      .all()
    const todosData = db.select().from(todos).where(eq(todos.workspaceId, workspaceId)).all()
    const schedulesData = db
      .select()
      .from(schedules)
      .where(eq(schedules.workspaceId, workspaceId))
      .all()
    const entityLinksData = db
      .select()
      .from(entityLinks)
      .where(eq(entityLinks.workspaceId, workspaceId))
      .all()
    const canvasesData = db
      .select()
      .from(canvases)
      .where(eq(canvases.workspaceId, workspaceId))
      .all()
    const tagsData = db.select().from(tags).where(eq(tags.workspaceId, workspaceId)).all()
    const tabSessionData = db
      .select()
      .from(tabSessions)
      .where(eq(tabSessions.workspaceId, workspaceId))
      .all()
    const tabSnapshotData = db
      .select()
      .from(tabSnapshots)
      .where(eq(tabSnapshots.workspaceId, workspaceId))
      .all()
    const recurringRulesData = db
      .select()
      .from(recurringRules)
      .where(eq(recurringRules.workspaceId, workspaceId))
      .all()
    const recurringCompletionsData = db
      .select()
      .from(recurringCompletions)
      .where(eq(recurringCompletions.workspaceId, workspaceId))
      .all()
    const templatesData = db
      .select()
      .from(templates)
      .where(eq(templates.workspaceId, workspaceId))
      .all()
    const terminalLayoutsData = db
      .select()
      .from(terminalLayouts)
      .where(eq(terminalLayouts.workspaceId, workspaceId))
      .all()
    const terminalSessionsData = db
      .select()
      .from(terminalSessions)
      .where(eq(terminalSessions.workspaceId, workspaceId))
      .all()

    // Level 2: 부모 ID 기반
    const canvasNodeData: (typeof canvasNodes.$inferSelect)[] = []
    const canvasEdgeData: (typeof canvasEdges.$inferSelect)[] = []
    const canvasGroupData: (typeof canvasGroups.$inferSelect)[] = []
    for (const c of canvasesData) {
      canvasNodeData.push(
        ...db.select().from(canvasNodes).where(eq(canvasNodes.canvasId, c.id)).all()
      )
      canvasEdgeData.push(
        ...db.select().from(canvasEdges).where(eq(canvasEdges.canvasId, c.id)).all()
      )
      canvasGroupData.push(
        ...db.select().from(canvasGroups).where(eq(canvasGroups.canvasId, c.id)).all()
      )
    }

    const scheduleTodoData: (typeof scheduleTodos.$inferSelect)[] = []
    for (const s of schedulesData) {
      scheduleTodoData.push(
        ...db.select().from(scheduleTodos).where(eq(scheduleTodos.scheduleId, s.id)).all()
      )
    }

    const itemTagData: (typeof itemTags.$inferSelect)[] = []
    for (const t of tagsData) {
      itemTagData.push(...db.select().from(itemTags).where(eq(itemTags.tagId, t.id)).all())
    }

    const reminderData: (typeof reminders.$inferSelect)[] = []
    for (const t of todosData) {
      reminderData.push(
        ...db
          .select()
          .from(reminders)
          .where(and(eq(reminders.entityType, 'todo'), eq(reminders.entityId, t.id)))
          .all()
      )
    }
    for (const s of schedulesData) {
      reminderData.push(
        ...db
          .select()
          .from(reminders)
          .where(and(eq(reminders.entityType, 'schedule'), eq(reminders.entityId, s.id)))
          .all()
      )
    }

    // 임시 디렉토리
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rally-backup-'))
    const dataDir = path.join(tmpDir, 'data')
    fs.mkdirSync(dataDir)

    try {
      // manifest
      const manifest: BackupManifest = {
        version: 1,
        appVersion: app.getVersion(),
        workspaceName: workspace.name,
        exportedAt: new Date().toISOString(),
        tables: [
          'folders',
          'notes',
          'csv-files',
          'pdf-files',
          'image-files',
          'todos',
          'schedules',
          'schedule-todos',
          'entity-links',
          'canvases',
          'canvas-nodes',
          'canvas-edges',
          'canvas-groups',
          'tags',
          'item-tags',
          'tab-sessions',
          'tab-snapshots',
          'reminders',
          'recurring-rules',
          'recurring-completions',
          'templates',
          'terminal-layouts',
          'terminal-sessions'
        ]
      }
      fs.writeFileSync(path.join(tmpDir, 'manifest.json'), JSON.stringify(manifest, null, 2))

      // data files (Date → number 변환)
      const dataFiles: [string, unknown][] = [
        ['workspace.json', { name: workspace.name }],
        ['folders.json', serializeForExport(foldersData)],
        ['notes.json', serializeForExport(notesData)],
        ['csv-files.json', serializeForExport(csvData)],
        ['pdf-files.json', serializeForExport(pdfData)],
        ['image-files.json', serializeForExport(imageData)],
        ['todos.json', serializeForExport(todosData)],
        ['schedules.json', serializeForExport(schedulesData)],
        ['schedule-todos.json', serializeForExport(scheduleTodoData)],
        ['entity-links.json', serializeForExport(entityLinksData)],
        ['canvases.json', serializeForExport(canvasesData)],
        ['canvas-nodes.json', serializeForExport(canvasNodeData)],
        ['canvas-edges.json', serializeForExport(canvasEdgeData)],
        ['canvas-groups.json', serializeForExport(canvasGroupData)],
        ['tags.json', serializeForExport(tagsData)],
        ['item-tags.json', serializeForExport(itemTagData)],
        ['tab-sessions.json', serializeForExport(tabSessionData)],
        ['tab-snapshots.json', serializeForExport(tabSnapshotData)],
        ['reminders.json', serializeForExport(reminderData)],
        ['recurring-rules.json', serializeForExport(recurringRulesData)],
        ['recurring-completions.json', serializeForExport(recurringCompletionsData)],
        ['templates.json', serializeForExport(templatesData)],
        ['terminal-layouts.json', serializeForExport(terminalLayoutsData)],
        ['terminal-sessions.json', serializeForExport(terminalSessionsData)]
      ]
      for (const [filename, data] of dataFiles) {
        fs.writeFileSync(path.join(dataDir, filename), JSON.stringify(data, null, 2))
      }

      // ZIP 생성 (스트리밍)
      await new Promise<void>((resolve, reject) => {
        const output = fs.createWriteStream(savePath)
        const archive = archiver('zip', { zlib: { level: 6 } })

        output.on('close', resolve)
        archive.on('error', reject)

        archive.pipe(output)
        archive.directory(dataDir, 'data')
        archive.file(path.join(tmpDir, 'manifest.json'), { name: 'manifest.json' })

        // files/ — workspace.path 전체
        if (fs.existsSync(workspace.path)) {
          archive.directory(workspace.path, 'files')
        }

        archive.finalize()
      })
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  }
}
