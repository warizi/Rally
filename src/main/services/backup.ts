import fs from 'fs'
import os from 'os'
import path from 'path'
import archiver from 'archiver'
import AdmZip from 'adm-zip'
import { nanoid } from 'nanoid'
import { and, eq } from 'drizzle-orm'
import { db } from '../db'
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
  reminders
} from '../db/schema'
import { workspaceService } from './workspace'
import { app } from 'electron'

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface BackupManifest {
  version: number
  appVersion: string
  workspaceName: string
  exportedAt: string
  tables: string[]
}

// ──────────────────────────────────────────────
// Serialization Helpers
// ──────────────────────────────────────────────

/** Drizzle timestamp_ms → number (Date → getTime) */
function serializeForExport(data: unknown): unknown {
  return JSON.parse(
    JSON.stringify(data, (_, value) => (value instanceof Date ? value.getTime() : value))
  )
}

/** number → Date (Drizzle insert 용) */
function toDate(ms: number): Date {
  return new Date(ms)
}

/** nullable timestamp */
function toDateOrNull(ms: number | null): Date | null {
  return ms != null ? new Date(ms) : null
}

// ──────────────────────────────────────────────
// ID Mapping Helpers
// ──────────────────────────────────────────────

function createIdMapper(): {
  register: (oldId: string) => string
  map: (oldId: string) => string
  mapOrNull: (oldId: string | null) => string | null
  mapOrSkip: (oldId: string) => string | null
} {
  const idMap = new Map<string, string>()

  return {
    /** 새 ID 등록 */
    register(oldId: string): string {
      const newId = nanoid()
      idMap.set(oldId, newId)
      return newId
    },

    /** 필수 매핑 (실패 시 throw) */
    map(oldId: string): string {
      const newId = idMap.get(oldId)
      if (!newId) throw new Error(`ID mapping not found: ${oldId}`)
      return newId
    },

    /** nullable FK 매핑 (null → null) */
    mapOrNull(oldId: string | null): string | null {
      return oldId != null ? this.map(oldId) : null
    },

    /** 고아 참조 안전 매핑 (매핑 실패 → null, 레코드 skip 판단용) */
    mapOrSkip(oldId: string): string | null {
      return idMap.get(oldId) ?? null
    }
  }
}

// ──────────────────────────────────────────────
// Tab JSON Mapping Helpers
// ──────────────────────────────────────────────

/** pathname에서 마지막 세그먼트(엔티티 ID) 교체 */
function mapTabPathname(
  pathname: string,
  mapper: ReturnType<typeof createIdMapper>
): { pathname: string; mapped: boolean } {
  const patterns = [
    /^\/todo\/(.+)$/,
    /^\/folder\/note\/(.+)$/,
    /^\/folder\/csv\/(.+)$/,
    /^\/folder\/pdf\/(.+)$/,
    /^\/folder\/image\/(.+)$/,
    /^\/canvas\/(.+)$/
  ]

  for (const pattern of patterns) {
    const match = pathname.match(pattern)
    if (match) {
      const oldId = match[1]
      const newId = mapper.mapOrSkip(oldId)
      if (!newId) return { pathname, mapped: false }
      return {
        pathname: pathname.replace(oldId, newId),
        mapped: true
      }
    }
  }

  // 엔티티 ID 없는 경로 (dashboard, todo list, folder list 등)
  return { pathname, mapped: true }
}

/** createTabId 알고리즘 재현 (renderer factory.ts와 동일) */
function createTabId(pathname: string): string {
  return `tab-${pathname
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')}`
}

/** folderOpenState JSON 키 매핑 */
function mapFolderOpenState(
  json: string | undefined,
  mapper: ReturnType<typeof createIdMapper>
): string | undefined {
  if (!json) return json
  try {
    const parsed: Record<string, boolean> = JSON.parse(json)
    const mapped: Record<string, boolean> = {}
    for (const [oldFolderId, value] of Object.entries(parsed)) {
      const newId = mapper.mapOrSkip(oldFolderId)
      if (newId) mapped[newId] = value
    }
    return JSON.stringify(mapped)
  } catch {
    return json
  }
}

interface MappedTabSession {
  tabsJson: string
  panesJson: string
  layoutJson: string
  activePaneId: string
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** tab_sessions / tab_snapshots JSON 전체 매핑 */
function mapTabJsons(
  tabsJsonStr: string,
  panesJsonStr: string,
  layoutJsonStr: string,
  activePaneId: string | null,
  mapper: ReturnType<typeof createIdMapper>
): MappedTabSession {
  // 1. tabs 매핑
  const oldTabs: Record<string, any> = JSON.parse(tabsJsonStr)
  const tabIdMap = new Map<string, string>()
  const newTabs: Record<string, any> = {}

  for (const [oldTabId, tab] of Object.entries(oldTabs)) {
    const result = mapTabPathname(tab.pathname, mapper)
    if (!result.mapped) continue

    const newPathname = result.pathname
    const newTabId = createTabId(newPathname)
    tabIdMap.set(oldTabId, newTabId)

    const searchParams = tab.searchParams ? { ...tab.searchParams } : undefined
    if (searchParams?.folderOpenState) {
      searchParams.folderOpenState = mapFolderOpenState(searchParams.folderOpenState, mapper)
    }

    newTabs[newTabId] = {
      ...tab,
      id: newTabId,
      pathname: newPathname,
      searchParams
    }
  }

  // 2. panes 매핑
  const oldPanes: Record<string, any> = JSON.parse(panesJsonStr)
  const paneIdMap = new Map<string, string>()
  const newPanes: Record<string, any> = {}

  for (const [oldPaneId, pane] of Object.entries(oldPanes)) {
    const newPaneId = nanoid()
    paneIdMap.set(oldPaneId, newPaneId)

    const newTabIds = pane.tabIds.map((oldId: string) => tabIdMap.get(oldId)).filter(Boolean)

    const newActiveTabId = pane.activeTabId ? (tabIdMap.get(pane.activeTabId) ?? null) : null

    newPanes[newPaneId] = {
      ...pane,
      id: newPaneId,
      tabIds: newTabIds,
      activeTabId: newActiveTabId ?? newTabIds[0] ?? null
    }
  }

  // 3. layout 매핑 (재귀)
  function mapLayout(node: any): any {
    if (node.type === 'pane') {
      return { ...node, id: nanoid(), paneId: paneIdMap.get(node.paneId) ?? node.paneId }
    }
    if (node.type === 'split') {
      return { ...node, id: nanoid(), children: node.children.map(mapLayout) }
    }
    return node
  }

  const oldLayout = JSON.parse(layoutJsonStr)
  const newLayout = mapLayout(oldLayout)

  // 4. activePaneId 매핑
  const newActivePaneId = activePaneId
    ? (paneIdMap.get(activePaneId) ?? Object.keys(newPanes)[0] ?? '')
    : (Object.keys(newPanes)[0] ?? '')

  return {
    tabsJson: JSON.stringify(newTabs),
    panesJson: JSON.stringify(newPanes),
    layoutJson: JSON.stringify(newLayout),
    activePaneId: newActivePaneId
  }
}

// ──────────────────────────────────────────────
// Topological Sort (todos)
// ──────────────────────────────────────────────

function sortTodosByParent<T extends { id: string; parentId: string | null }>(items: T[]): T[] {
  const sorted: T[] = []
  const remaining = [...items]
  const inserted = new Set<string>()

  while (remaining.length > 0) {
    const batch = remaining.filter((t) => t.parentId === null || inserted.has(t.parentId))
    if (batch.length === 0) break // 순환 참조 방지
    for (const t of batch) {
      inserted.add(t.id)
      sorted.push(t)
    }
    remaining.splice(0, remaining.length, ...remaining.filter((t) => !inserted.has(t.id)))
  }
  return sorted
}

// ──────────────────────────────────────────────
// File Copy Helper
// ──────────────────────────────────────────────

function copyDirSync(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

// ──────────────────────────────────────────────
// Batch Insert Helper
// ──────────────────────────────────────────────

function batchInsert(table: any, items: any[]): void {
  if (items.length === 0) return
  const CHUNK = 99
  for (let i = 0; i < items.length; i += CHUNK) {
    db.insert(table)
      .values(items.slice(i, i + CHUNK))
      .onConflictDoNothing()
      .run()
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ──────────────────────────────────────────────
// Backup Service
// ──────────────────────────────────────────────

export const backupService = {
  // ── Export ──────────────────────────────────

  async export(workspaceId: string, savePath: string): Promise<void> {
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
          'reminders'
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
        ['reminders.json', serializeForExport(reminderData)]
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
  },

  // ── Read Manifest ──────────────────────────

  readManifest(zipPath: string): BackupManifest {
    const zip = new AdmZip(zipPath)
    const entry = zip.getEntry('manifest.json')
    if (!entry) throw new Error('Invalid backup file: manifest.json not found')
    const content = entry.getData().toString('utf8')
    const manifest: BackupManifest = JSON.parse(content)
    if (manifest.version !== 1) {
      throw new Error(`Unsupported backup version: ${manifest.version}`)
    }
    return manifest
  },

  // ── Import ─────────────────────────────────

  async import(
    zipPath: string,
    newName: string,
    newPath: string
  ): Promise<typeof workspaces.$inferSelect> {
    const zip = new AdmZip(zipPath)
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rally-import-'))

    try {
      zip.extractAllTo(tmpDir, true)

      // manifest 검증
      const manifestStr = fs.readFileSync(path.join(tmpDir, 'manifest.json'), 'utf8')
      const manifest: BackupManifest = JSON.parse(manifestStr)
      if (manifest.version !== 1) {
        throw new Error(`Unsupported backup version: ${manifest.version}`)
      }

      // 파일 복사 (files/ → newPath)
      const filesDir = path.join(tmpDir, 'files')
      if (fs.existsSync(filesDir)) {
        copyDirSync(filesDir, newPath)
      } else {
        fs.mkdirSync(newPath, { recursive: true })
      }

      // JSON 데이터 읽기
      const dataDir = path.join(tmpDir, 'data')
      function readJson<T>(filename: string): T {
        const filePath = path.join(dataDir, filename)
        if (!fs.existsSync(filePath)) return [] as unknown as T
        return JSON.parse(fs.readFileSync(filePath, 'utf8'))
      }

      /* eslint-disable @typescript-eslint/no-explicit-any */
      const foldersJson = readJson<any[]>('folders.json')
      const notesJson = readJson<any[]>('notes.json')
      const csvJson = readJson<any[]>('csv-files.json')
      const pdfJson = readJson<any[]>('pdf-files.json')
      const imageJson = readJson<any[]>('image-files.json')
      const todosJson = readJson<any[]>('todos.json')
      const schedulesJson = readJson<any[]>('schedules.json')
      const scheduleTodosJson = readJson<any[]>('schedule-todos.json')
      const entityLinksJson = readJson<any[]>('entity-links.json')
      const canvasesJson = readJson<any[]>('canvases.json')
      const canvasNodesJson = readJson<any[]>('canvas-nodes.json')
      const canvasEdgesJson = readJson<any[]>('canvas-edges.json')
      const canvasGroupsJson = readJson<any[]>('canvas-groups.json')
      const tagsJson = readJson<any[]>('tags.json')
      const itemTagsJson = readJson<any[]>('item-tags.json')
      const tabSessionsJson = readJson<any[]>('tab-sessions.json')
      const tabSnapshotsJson = readJson<any[]>('tab-snapshots.json')
      const remindersJson = readJson<any[]>('reminders.json')
      /* eslint-enable @typescript-eslint/no-explicit-any */

      // ID 매퍼
      const mapper = createIdMapper()

      // 새 워크스페이스 ID
      const newWorkspaceId = nanoid()
      const now = new Date()

      // DB 트랜잭션
      let newWorkspace: typeof workspaces.$inferSelect

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
          (a, b) =>
            (a.relativePath?.split('/').length ?? 0) - (b.relativePath?.split('/').length ?? 0)
        )
        batchInsert(
          folders,
          sortedFolders.map((f) => ({
            id: mapper.register(f.id),
            workspaceId: newWorkspaceId,
            relativePath: f.relativePath,
            color: f.color,
            order: f.order,
            createdAt: toDate(f.createdAt),
            updatedAt: toDate(f.updatedAt)
          }))
        )

        // 2. notes
        batchInsert(
          notes,
          notesJson.map((n) => ({
            id: mapper.register(n.id),
            workspaceId: newWorkspaceId,
            folderId: mapper.mapOrNull(n.folderId),
            title: n.title,
            relativePath: n.relativePath,
            description: n.description,
            preview: n.preview,
            order: n.order,
            createdAt: toDate(n.createdAt),
            updatedAt: toDate(n.updatedAt)
          }))
        )

        // 3. csv_files
        batchInsert(
          csvFiles,
          csvJson.map((c) => ({
            id: mapper.register(c.id),
            workspaceId: newWorkspaceId,
            folderId: mapper.mapOrNull(c.folderId),
            title: c.title,
            relativePath: c.relativePath,
            description: c.description,
            preview: c.preview,
            columnWidths: c.columnWidths,
            order: c.order,
            createdAt: toDate(c.createdAt),
            updatedAt: toDate(c.updatedAt)
          }))
        )

        // 4. pdf_files
        batchInsert(
          pdfFiles,
          pdfJson.map((p) => ({
            id: mapper.register(p.id),
            workspaceId: newWorkspaceId,
            folderId: mapper.mapOrNull(p.folderId),
            title: p.title,
            relativePath: p.relativePath,
            description: p.description,
            preview: p.preview,
            order: p.order,
            createdAt: toDate(p.createdAt),
            updatedAt: toDate(p.updatedAt)
          }))
        )

        // 5. image_files
        batchInsert(
          imageFiles,
          imageJson.map((i) => ({
            id: mapper.register(i.id),
            workspaceId: newWorkspaceId,
            folderId: mapper.mapOrNull(i.folderId),
            title: i.title,
            relativePath: i.relativePath,
            description: i.description,
            preview: i.preview,
            order: i.order,
            createdAt: toDate(i.createdAt),
            updatedAt: toDate(i.updatedAt)
          }))
        )

        // 6. todos (topological sort)
        const sortedTodos = sortTodosByParent(todosJson)
        for (const t of sortedTodos) {
          const newId = mapper.register(t.id)
          db.insert(todos)
            .values({
              id: newId,
              workspaceId: newWorkspaceId,
              parentId: mapper.mapOrNull(t.parentId),
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
              startDate: toDateOrNull(t.startDate)
            })
            .run()
        }

        // 7. schedules
        batchInsert(
          schedules,
          schedulesJson.map((s) => ({
            id: mapper.register(s.id),
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
            updatedAt: toDate(s.updatedAt)
          }))
        )

        // 8. schedule_todos
        batchInsert(
          scheduleTodos,
          scheduleTodosJson.map((st) => ({
            scheduleId: mapper.map(st.scheduleId),
            todoId: mapper.map(st.todoId)
          }))
        )

        // 9. canvases
        batchInsert(
          canvases,
          canvasesJson.map((c) => ({
            id: mapper.register(c.id),
            workspaceId: newWorkspaceId,
            title: c.title,
            description: c.description,
            viewportX: c.viewportX,
            viewportY: c.viewportY,
            viewportZoom: c.viewportZoom,
            createdAt: toDate(c.createdAt),
            updatedAt: toDate(c.updatedAt)
          }))
        )

        // 10. canvas_nodes
        batchInsert(
          canvasNodes,
          canvasNodesJson.map((n) => ({
            id: mapper.register(n.id),
            canvasId: mapper.map(n.canvasId),
            type: n.type,
            refId: mapper.mapOrNull(n.refId),
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
            id: mapper.register(e.id),
            canvasId: mapper.map(e.canvasId),
            fromNode: mapper.map(e.fromNode),
            toNode: mapper.map(e.toNode),
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
            id: mapper.register(g.id),
            canvasId: mapper.map(g.canvasId),
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
            const sourceId = mapper.mapOrSkip(el.sourceId)
            const targetId = mapper.mapOrSkip(el.targetId)
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
            id: mapper.register(t.id),
            workspaceId: newWorkspaceId,
            name: t.name,
            color: t.color,
            description: t.description,
            createdAt: toDate(t.createdAt)
          }))
        )

        // 15. item_tags (고아 skip)
        const mappedItemTags = itemTagsJson
          .map((it) => {
            const itemId = mapper.mapOrSkip(it.itemId)
            if (!itemId) return null
            return {
              id: mapper.register(it.id),
              itemType: it.itemType,
              tagId: mapper.map(it.tagId),
              itemId,
              createdAt: toDate(it.createdAt)
            }
          })
          .filter(Boolean) as (typeof itemTags.$inferInsert)[]
        batchInsert(itemTags, mappedItemTags)

        // 16. reminders (고아 skip)
        const mappedReminders = remindersJson
          .map((r) => {
            const entityId = mapper.mapOrSkip(r.entityId)
            if (!entityId) return null
            return {
              id: mapper.register(r.id),
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
              id: mapper.register(snap.id),
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
      })()

      return newWorkspace!
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
