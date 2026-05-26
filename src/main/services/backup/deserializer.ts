import fs from 'fs'
import os from 'os'
import path from 'path'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { db } from '../../db'
import {
  workspaces,
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

import type { BackupManifest } from './types'
import { toDate, toDateOrNull, sortTodosByParent, copyDirSync, batchInsert } from './helpers'
import { IdMapper, type BackupEntityType } from './id-mapper'
import { mapTabJsons } from './tab-mapper'
import { unpackZip, filesDirPath, manifestPath as manifestPathOf } from './archive'
import {
  FolderImport,
  NoteImport,
  CsvFileImport,
  PdfFileImport,
  ImageFileImport,
  TodoImport,
  ScheduleImport,
  ScheduleTodoImport,
  EntityLinkImport,
  CanvasImport,
  CanvasNodeImport,
  CanvasEdgeImport,
  CanvasGroupImport,
  TagImport,
  ItemTagImport,
  TabSessionImport,
  TabSnapshotImport,
  ReminderImport,
  RecurringRuleImport,
  RecurringCompletionImport,
  TemplateImport,
  TerminalLayoutImport,
  TerminalSessionImport
} from './import-schemas'

/**
 * 구버전 백업(4필드 누락)일 때 'user' / null 기본값을 명시 주입.
 * 신버전 백업은 값이 있으면 그대로 보존.
 */
function actorDefaults(row: {
  createdBy?: 'user' | 'ai'
  createdById?: string | null
  updatedBy?: 'user' | 'ai'
  updatedById?: string | null
}): {
  createdBy: 'user' | 'ai'
  createdById: string | null
  updatedBy: 'user' | 'ai'
  updatedById: string | null
} {
  return {
    createdBy: row.createdBy ?? 'user',
    createdById: row.createdById ?? null,
    updatedBy: row.updatedBy ?? 'user',
    updatedById: row.updatedById ?? null
  }
}

/**
 * 백업 import — zip → 새 워크스페이스.
 *
 * 1. zip 해제 + manifest 검증 (version, 손상 거부)
 * 2. workspace 파일 디렉토리 복사 (files/)
 * 3. 각 entity JSON 읽기 + **zod schema parse** (any 0, 손상 즉시 throw)
 * 4. IdMapper 로 entity type 별 ID 매핑
 * 5. DB 트랜잭션 내 24개 entity insert (FK 의존 순서)
 * 6. 실패 시 newPath 정리 + 임시 디렉토리 정리
 *
 * any 33회 → 0회: zod 추론 타입으로 모든 import row 형식 안전.
 * silent fallback 제거: 손상된 JSON 은 ValidationError 로 명시적 거부.
 */
export const backupDeserializer = {
  async deserialize(
    zipPath: string,
    newName: string,
    newPath: string
  ): Promise<typeof workspaces.$inferSelect> {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rally-import-'))

    try {
      // archive 모듈로 zip 해제
      unpackZip(zipPath, tmpDir)

      // manifest 검증
      const manifestStr = fs.readFileSync(manifestPathOf(tmpDir), 'utf8')
      const manifest: BackupManifest = JSON.parse(manifestStr)
      if (manifest.version !== 1) {
        throw new Error(`Unsupported backup version: ${manifest.version}`)
      }

      // 파일 복사 (files/ → newPath)
      const filesDir = filesDirPath(tmpDir)
      if (fs.existsSync(filesDir)) {
        copyDirSync(filesDir, newPath)
      } else {
        fs.mkdirSync(newPath, { recursive: true })
      }

      // JSON 데이터 읽기 + zod 검증
      const dataDir = path.join(tmpDir, 'data')
      function readAndParse<T>(filename: string, schema: z.ZodType<T>): T[] {
        const filePath = path.join(dataDir, filename)
        if (!fs.existsSync(filePath)) return []
        const raw: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'))
        if (!Array.isArray(raw)) {
          throw new Error(`Invalid backup data: ${filename} is not an array`)
        }
        const result: T[] = []
        for (let i = 0; i < raw.length; i++) {
          const parsed = schema.safeParse(raw[i])
          if (!parsed.success) {
            throw new Error(`Invalid backup data in ${filename}[${i}]: ${parsed.error.message}`)
          }
          result.push(parsed.data)
        }
        return result
      }

      const foldersJson = readAndParse('folders.json', FolderImport)
      const notesJson = readAndParse('notes.json', NoteImport)
      const csvJson = readAndParse('csv-files.json', CsvFileImport)
      const pdfJson = readAndParse('pdf-files.json', PdfFileImport)
      const imageJson = readAndParse('image-files.json', ImageFileImport)
      const todosJson = readAndParse('todos.json', TodoImport)
      const schedulesJson = readAndParse('schedules.json', ScheduleImport)
      const scheduleTodosJson = readAndParse('schedule-todos.json', ScheduleTodoImport)
      const entityLinksJson = readAndParse('entity-links.json', EntityLinkImport)
      const canvasesJson = readAndParse('canvases.json', CanvasImport)
      const canvasNodesJson = readAndParse('canvas-nodes.json', CanvasNodeImport)
      const canvasEdgesJson = readAndParse('canvas-edges.json', CanvasEdgeImport)
      const canvasGroupsJson = readAndParse('canvas-groups.json', CanvasGroupImport)
      const tagsJson = readAndParse('tags.json', TagImport)
      const itemTagsJson = readAndParse('item-tags.json', ItemTagImport)
      const tabSessionsJson = readAndParse('tab-sessions.json', TabSessionImport)
      const tabSnapshotsJson = readAndParse('tab-snapshots.json', TabSnapshotImport)
      const remindersJson = readAndParse('reminders.json', ReminderImport)
      const recurringRulesJson = readAndParse('recurring-rules.json', RecurringRuleImport)
      const recurringCompletionsJson = readAndParse(
        'recurring-completions.json',
        RecurringCompletionImport
      )
      const templatesJson = readAndParse('templates.json', TemplateImport)
      const terminalLayoutsJson = readAndParse('terminal-layouts.json', TerminalLayoutImport)
      const terminalSessionsJson = readAndParse('terminal-sessions.json', TerminalSessionImport)

      // ID 매퍼
      const mapper = new IdMapper()

      // 새 워크스페이스 ID
      const newWorkspaceId = nanoid()
      const now = new Date()

      let newWorkspace: typeof workspaces.$inferSelect | undefined

      db.$client.transaction(() => {
        // 0. workspace
        newWorkspace = db
          .insert(workspaces)
          .values({
            id: newWorkspaceId,
            name: newName.trim(),
            path: newPath.trim(),
            createdAt: now,
            updatedAt: now
          })
          .returning()
          .get()

        // 1. folders (depth 순 정렬)
        const sortedFolders = [...foldersJson].sort(
          (a, b) => a.relativePath.split('/').length - b.relativePath.split('/').length
        )
        batchInsert(
          folders,
          sortedFolders.map((f) => ({
            id: mapper.register('folder', f.id),
            workspaceId: newWorkspaceId,
            relativePath: f.relativePath,
            color: f.color,
            order: f.order,
            createdAt: toDate(f.createdAt),
            updatedAt: toDate(f.updatedAt),
            ...actorDefaults(f)
          }))
        )

        // 2. notes
        batchInsert(
          notes,
          notesJson.map((n) => ({
            id: mapper.register('note', n.id),
            workspaceId: newWorkspaceId,
            folderId: mapper.mapOrNull('folder', n.folderId),
            title: n.title,
            relativePath: n.relativePath,
            description: n.description,
            preview: n.preview,
            order: n.order,
            isLocked: n.isLocked ?? false,
            createdAt: toDate(n.createdAt),
            updatedAt: toDate(n.updatedAt),
            ...actorDefaults(n)
          }))
        )

        // 3. csv_files
        batchInsert(
          csvFiles,
          csvJson.map((c) => ({
            id: mapper.register('csv', c.id),
            workspaceId: newWorkspaceId,
            folderId: mapper.mapOrNull('folder', c.folderId),
            title: c.title,
            relativePath: c.relativePath,
            description: c.description,
            preview: c.preview,
            columnWidths: c.columnWidths,
            order: c.order,
            isLocked: c.isLocked ?? false,
            createdAt: toDate(c.createdAt),
            updatedAt: toDate(c.updatedAt),
            ...actorDefaults(c)
          }))
        )

        // 4. pdf_files
        batchInsert(
          pdfFiles,
          pdfJson.map((p) => ({
            id: mapper.register('pdf', p.id),
            workspaceId: newWorkspaceId,
            folderId: mapper.mapOrNull('folder', p.folderId),
            title: p.title,
            relativePath: p.relativePath,
            description: p.description,
            preview: p.preview,
            order: p.order,
            createdAt: toDate(p.createdAt),
            updatedAt: toDate(p.updatedAt),
            ...actorDefaults(p)
          }))
        )

        // 5. image_files
        batchInsert(
          imageFiles,
          imageJson.map((i) => ({
            id: mapper.register('image', i.id),
            workspaceId: newWorkspaceId,
            folderId: mapper.mapOrNull('folder', i.folderId),
            title: i.title,
            relativePath: i.relativePath,
            description: i.description,
            preview: i.preview,
            order: i.order,
            createdAt: toDate(i.createdAt),
            updatedAt: toDate(i.updatedAt),
            ...actorDefaults(i)
          }))
        )

        // 6. todos (topological sort)
        const sortedTodos = sortTodosByParent(todosJson)
        for (const t of sortedTodos) {
          db.insert(todos)
            .values({
              id: mapper.register('todo', t.id),
              workspaceId: newWorkspaceId,
              parentId: mapper.mapOrNull('todo', t.parentId),
              title: t.title,
              description: t.description,
              status: t.status,
              priority: t.priority,
              isDone: t.isDone,
              listOrder: t.listOrder,
              kanbanOrder: t.kanbanOrder,
              subOrder: t.subOrder,
              createdAt: toDate(t.createdAt),
              updatedAt: toDate(t.updatedAt),
              doneAt: toDateOrNull(t.doneAt),
              dueDate: toDateOrNull(t.dueDate),
              startDate: toDateOrNull(t.startDate),
              ...actorDefaults(t)
            })
            .run()
        }

        // 7. schedules
        batchInsert(
          schedules,
          schedulesJson.map((s) => ({
            id: mapper.register('schedule', s.id),
            workspaceId: newWorkspaceId,
            title: s.title,
            description: s.description,
            location: s.location,
            allDay: s.allDay,
            startAt: toDate(s.startAt),
            endAt: toDate(s.endAt),
            color: s.color,
            priority: s.priority,
            createdAt: toDate(s.createdAt),
            updatedAt: toDate(s.updatedAt),
            ...actorDefaults(s)
          }))
        )

        // 8. schedule_todos
        batchInsert(
          scheduleTodos,
          scheduleTodosJson.map((st) => ({
            scheduleId: mapper.map('schedule', st.scheduleId),
            todoId: mapper.map('todo', st.todoId)
          }))
        )

        // 9. canvases
        batchInsert(
          canvases,
          canvasesJson.map((c) => ({
            id: mapper.register('canvas', c.id),
            workspaceId: newWorkspaceId,
            title: c.title,
            description: c.description,
            viewportX: c.viewportX,
            viewportY: c.viewportY,
            viewportZoom: c.viewportZoom,
            isLocked: c.isLocked ?? false,
            createdAt: toDate(c.createdAt),
            updatedAt: toDate(c.updatedAt),
            ...actorDefaults(c)
          }))
        )

        // 10. canvas_nodes
        batchInsert(
          canvasNodes,
          canvasNodesJson.map((n) => ({
            id: mapper.register('canvas-node', n.id),
            canvasId: mapper.map('canvas', n.canvasId),
            type: n.type,
            refId: resolveCanvasNodeRef(mapper, n.refId),
            x: n.x,
            y: n.y,
            width: n.width,
            height: n.height,
            color: n.color,
            content: n.content,
            zIndex: n.zIndex,
            createdAt: toDate(n.createdAt),
            updatedAt: toDate(n.updatedAt)
          }))
        )

        // 11. canvas_edges
        batchInsert(
          canvasEdges,
          canvasEdgesJson.map((e) => ({
            id: mapper.register('canvas-edge', e.id),
            canvasId: mapper.map('canvas', e.canvasId),
            fromNode: mapper.map('canvas-node', e.fromNode),
            toNode: mapper.map('canvas-node', e.toNode),
            fromSide: e.fromSide,
            toSide: e.toSide,
            label: e.label,
            color: e.color,
            style: e.style,
            arrow: e.arrow,
            createdAt: toDate(e.createdAt)
          }))
        )

        // 12. canvas_groups
        batchInsert(
          canvasGroups,
          canvasGroupsJson.map((g) => ({
            id: mapper.register('canvas-group', g.id),
            canvasId: mapper.map('canvas', g.canvasId),
            label: g.label,
            color: g.color,
            x: g.x,
            y: g.y,
            width: g.width,
            height: g.height,
            createdAt: toDate(g.createdAt),
            updatedAt: toDate(g.updatedAt)
          }))
        )

        // 13. entity_links (composite PK, 고아 skip)
        const mappedLinks = entityLinksJson
          .map((el) => {
            const sourceId = mapper.mapOrSkip(el.sourceType as BackupEntityType, el.sourceId)
            const targetId = mapper.mapOrSkip(el.targetType as BackupEntityType, el.targetId)
            if (!sourceId || !targetId) return null
            return {
              sourceType: el.sourceType,
              sourceId,
              targetType: el.targetType,
              targetId,
              workspaceId: newWorkspaceId,
              createdAt: toDate(el.createdAt)
            }
          })
          .filter(Boolean) as (typeof entityLinks.$inferInsert)[]
        batchInsert(entityLinks, mappedLinks)

        // 14. tags
        batchInsert(
          tags,
          tagsJson.map((t) => ({
            id: mapper.register('tag', t.id),
            workspaceId: newWorkspaceId,
            name: t.name,
            color: t.color,
            description: t.description,
            createdAt: toDate(t.createdAt),
            ...actorDefaults(t)
          }))
        )

        // 15. item_tags (고아 skip)
        const mappedItemTags = itemTagsJson
          .map((it) => {
            const itemId = mapper.mapOrSkip(it.itemType as BackupEntityType, it.itemId)
            if (!itemId) return null
            return {
              id: mapper.register('item-tag', it.id),
              itemType: it.itemType,
              tagId: mapper.map('tag', it.tagId),
              itemId,
              createdAt: toDate(it.createdAt)
            }
          })
          .filter(Boolean) as (typeof itemTags.$inferInsert)[]
        batchInsert(itemTags, mappedItemTags)

        // 16. reminders (고아 skip)
        const mappedReminders = remindersJson
          .map((r) => {
            const entityId = mapper.mapOrSkip(r.entityType as BackupEntityType, r.entityId)
            if (!entityId) return null
            return {
              id: mapper.register('reminder', r.id),
              entityType: r.entityType,
              entityId,
              offsetMs: r.offsetMs,
              remindAt: toDate(r.remindAt),
              isFired: r.isFired,
              createdAt: toDate(r.createdAt),
              updatedAt: toDate(r.updatedAt)
            }
          })
          .filter(Boolean) as (typeof reminders.$inferInsert)[]
        batchInsert(reminders, mappedReminders)

        // 17. tab_sessions
        for (const ts of tabSessionsJson) {
          const mapped = mapTabJsons(
            ts.tabsJson,
            ts.panesJson,
            ts.layoutJson,
            ts.activePaneId,
            mapper
          )
          db.insert(tabSessions)
            .values({
              workspaceId: newWorkspaceId,
              activePaneId: mapped.activePaneId,
              tabsJson: mapped.tabsJson,
              panesJson: mapped.panesJson,
              layoutJson: mapped.layoutJson,
              updatedAt: now
            })
            .run()
        }

        // 18. tab_snapshots
        for (const snap of tabSnapshotsJson) {
          const mapped = mapTabJsons(snap.tabsJson, snap.panesJson, snap.layoutJson, null, mapper)
          db.insert(tabSnapshots)
            .values({
              id: mapper.register('tab-snapshot', snap.id),
              workspaceId: newWorkspaceId,
              name: snap.name,
              description: snap.description,
              tabsJson: mapped.tabsJson,
              panesJson: mapped.panesJson,
              layoutJson: mapped.layoutJson,
              createdAt: toDate(snap.createdAt),
              updatedAt: toDate(snap.updatedAt)
            })
            .run()
        }

        // 19. recurring_rules
        batchInsert(
          recurringRules,
          recurringRulesJson.map((r) => ({
            id: mapper.register('recurring-rule', r.id),
            workspaceId: newWorkspaceId,
            title: r.title,
            description: r.description,
            priority: r.priority,
            recurrenceType: r.recurrenceType,
            daysOfWeek: r.daysOfWeek,
            startDate: toDate(r.startDate),
            endDate: toDateOrNull(r.endDate),
            startTime: r.startTime,
            endTime: r.endTime,
            reminderOffsetMs: r.reminderOffsetMs,
            createdAt: toDate(r.createdAt),
            updatedAt: toDate(r.updatedAt),
            ...actorDefaults(r)
          }))
        )

        // 20. recurring_completions (ruleId nullable: 원본에서 rule 삭제된 케이스 보존)
        batchInsert(
          recurringCompletions,
          recurringCompletionsJson.map((c) => ({
            id: mapper.register('recurring-completion', c.id),
            ruleId: c.ruleId != null ? mapper.mapOrSkip('recurring-rule', c.ruleId) : null,
            ruleTitle: c.ruleTitle,
            workspaceId: newWorkspaceId,
            completedDate: c.completedDate,
            completedAt: toDate(c.completedAt),
            createdAt: toDate(c.createdAt)
          }))
        )

        // 21. templates
        batchInsert(
          templates,
          templatesJson.map((t) => ({
            id: mapper.register('template', t.id),
            workspaceId: newWorkspaceId,
            title: t.title,
            type: t.type,
            jsonData: t.jsonData,
            createdAt: toDate(t.createdAt)
          }))
        )

        // 22. terminal_layouts (워크스페이스당 unique)
        batchInsert(
          terminalLayouts,
          terminalLayoutsJson.map((l) => ({
            id: mapper.register('terminal-layout', l.id),
            workspaceId: newWorkspaceId,
            layoutJson: l.layoutJson,
            createdAt: toDate(l.createdAt),
            updatedAt: toDate(l.updatedAt)
          }))
        )

        // 23. terminal_sessions (layoutId nullable)
        batchInsert(
          terminalSessions,
          terminalSessionsJson.map((s) => ({
            id: mapper.register('terminal-session', s.id),
            workspaceId: newWorkspaceId,
            layoutId: s.layoutId != null ? mapper.mapOrSkip('terminal-layout', s.layoutId) : null,
            name: s.name,
            cwd: s.cwd,
            shell: s.shell,
            rows: s.rows,
            cols: s.cols,
            screenSnapshot: s.screenSnapshot,
            sortOrder: s.sortOrder,
            isActive: s.isActive,
            createdAt: toDate(s.createdAt),
            updatedAt: toDate(s.updatedAt)
          }))
        )
      })()

      if (!newWorkspace) {
        throw new Error('Workspace creation failed during import')
      }
      return newWorkspace
    } catch (error) {
      if (fs.existsSync(newPath)) {
        try {
          fs.rmSync(newPath, { recursive: true, force: true })
        } catch {
          // 정리 실패는 무시
        }
      }
      throw error
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  }
}

/**
 * canvas-node.refId 는 다른 entity (todo/note/canvas/...) 의 ID 를 참조.
 * 원본 JSON 에는 type 정보가 없어 candidate type 들을 순회하며 매핑.
 * 매핑 실패 시 null (orphan 으로 처리).
 */
function resolveCanvasNodeRef(mapper: IdMapper, oldId: string | null): string | null {
  if (oldId == null) return null
  const candidates: BackupEntityType[] = [
    'todo',
    'note',
    'csv',
    'pdf',
    'image',
    'canvas',
    'schedule'
  ]
  for (const t of candidates) {
    const newId = mapper.mapOrSkip(t, oldId)
    if (newId) return newId
  }
  return null
}
