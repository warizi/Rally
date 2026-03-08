# Design: Workspace Backup

## 1. 개요

워크스페이스 단위 백업/복구 기능. DB 19개 테이블 + 파일시스템 전체를 ZIP으로 내보내고, 새 워크스페이스 생성 시 ZIP 업로드로 완벽 복구한다.

**참조**: `docs/01-plan/features/workspace-backup.plan.md`

---

## 2. 의존성

### 2.1 ZIP 라이브러리

```bash
npm install archiver @types/archiver   # export: 스트리밍 ZIP 생성
npm install adm-zip @types/adm-zip     # import + readManifest: 동기적 ZIP 해제
```

**설계 근거**:

| 항목              | 설명                                                                      |
| ----------------- | ------------------------------------------------------------------------- |
| archiver (export) | 스트리밍 방식으로 대용량 파일 처리, 널리 사용되는 표준 라이브러리         |
| adm-zip (import)  | 동기적 API로 better-sqlite3 트랜잭션과 호환, 메모리 내 manifest 읽기 가능 |

---

## 3. Backend

### 3.1 handleAsync 유틸

**파일**: `src/main/lib/handle.ts` (기존 파일에 추가)

```typescript
import { errorResponse, IpcResponse, successResponse } from './ipc-response'

// 기존 동기 handle
export function handle<T>(fn: () => T): IpcResponse<T> | IpcResponse<never> {
  try {
    return successResponse(fn())
  } catch (e) {
    return errorResponse(e)
  }
}

// 신규 비동기 handle
export async function handleAsync<T>(
  fn: () => Promise<T>
): Promise<IpcResponse<T> | IpcResponse<never>> {
  try {
    return successResponse(await fn())
  } catch (e) {
    return errorResponse(e)
  }
}
```

**설계 근거**:

| 항목           | 설명                                                                 |
| -------------- | -------------------------------------------------------------------- |
| 별도 함수      | 기존 `handle`은 동기 전용 — 타입 시그니처 변경 없이 비동기 지원 추가 |
| 동일 에러 패턴 | `errorResponse(e)` 재사용으로 일관된 IpcResponse 반환                |
| export 필요    | backup IPC handler에서 사용                                          |

### 3.2 Service — backup

**파일**: `src/main/services/backup.ts`

```typescript
import fs from 'fs'
import path from 'path'
import os from 'os'
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

interface BackupData {
  workspace: { name: string }
  folders: unknown[]
  notes: unknown[]
  csvFiles: unknown[]
  pdfFiles: unknown[]
  imageFiles: unknown[]
  todos: unknown[]
  schedules: unknown[]
  scheduleTodos: unknown[]
  entityLinks: unknown[]
  canvases: unknown[]
  canvasNodes: unknown[]
  canvasEdges: unknown[]
  canvasGroups: unknown[]
  tags: unknown[]
  itemTags: unknown[]
  tabSessions: unknown[]
  tabSnapshots: unknown[]
  reminders: unknown[]
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

function createIdMapper() {
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
  // 엔티티 ID를 포함하는 패턴
  const patterns = [
    /^\/todo\/(.+)$/, // /todo/:todoId
    /^\/folder\/note\/(.+)$/, // /folder/note/:noteId
    /^\/folder\/csv\/(.+)$/, // /folder/csv/:csvId
    /^\/folder\/pdf\/(.+)$/, // /folder/pdf/:pdfId
    /^\/folder\/image\/(.+)$/, // /folder/image/:imageId
    /^\/canvas\/(.+)$/ // /canvas/:canvasId
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
  const tabIdMap = new Map<string, string>() // oldTabId → newTabId
  const newTabs: Record<string, any> = {}

  for (const [oldTabId, tab] of Object.entries(oldTabs)) {
    const result = mapTabPathname(tab.pathname, mapper)
    if (!result.mapped) continue // 매핑 실패한 탭 제거

    const newPathname = result.pathname
    const newTabId = createTabId(newPathname)
    tabIdMap.set(oldTabId, newTabId)

    // searchParams 내 folderOpenState 매핑
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
  const paneIdMap = new Map<string, string>() // oldPaneId → newPaneId
  const newPanes: Record<string, any> = {}

  for (const [oldPaneId, pane] of Object.entries(oldPanes)) {
    const newPaneId = nanoid()
    paneIdMap.set(oldPaneId, newPaneId)

    const newTabIds = pane.tabIds.map((oldId: string) => tabIdMap.get(oldId)).filter(Boolean)

    const newActiveTabId = pane.activeTabId ? (tabIdMap.get(pane.activeTabId) ?? null) : null

    // 빈 pane은 유지 (fallback으로 처리)
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

/** fs.copyFileSync 기반 재귀 디렉토리 복사 (프로젝트 컨벤션) */
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
    const canvasNodeData: unknown[] = []
    const canvasEdgeData: unknown[] = []
    const canvasGroupData: unknown[] = []
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

    const scheduleTodoData: unknown[] = []
    for (const s of schedulesData) {
      scheduleTodoData.push(
        ...db.select().from(scheduleTodos).where(eq(scheduleTodos.scheduleId, s.id)).all()
      )
    }

    const itemTagData: unknown[] = []
    for (const t of tagsData) {
      itemTagData.push(...db.select().from(itemTags).where(eq(itemTags.tagId, t.id)).all())
    }

    const reminderData: unknown[] = []
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
      // 임시 디렉토리 정리
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
    // ZIP 해제
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

        // 10. canvas_nodes (refId는 type 기반 nullable 매핑)
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

        // 12. canvas_groups (raw — no repository)
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
          .filter(Boolean) as any[]
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
          .filter(Boolean) as any[]
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
          .filter(Boolean) as any[]
        batchInsert(reminders, mappedReminders)

        // 17. tab_sessions (auto-increment id 제외, upsert)
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
          const mapped = mapTabJsons(
            snap.tabsJson,
            snap.panesJson,
            snap.layoutJson,
            null, // tab_snapshots에는 activePaneId 컬럼 없음
            mapper
          )
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
      // 에러 시 복사된 파일 정리
      if (fs.existsSync(newPath)) {
        try {
          fs.rmSync(newPath, { recursive: true, force: true })
        } catch {
          // 정리 실패는 무시
        }
      }
      throw error
    } finally {
      // 임시 디렉토리 정리
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  }
}
```

**설계 근거**:

| 항목                                      | 설명                                                                                               |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 단일 서비스 파일                          | export/import/readManifest 3개 메서드. 별도 repository 불필요 (raw Drizzle 직접 사용)              |
| `createIdMapper()` 패턴                   | 4가지 매핑 모드(register, map, mapOrNull, mapOrSkip)를 캡슐화                                      |
| `serializeForExport()`                    | JSON replacer로 Date→number 일괄 변환. Drizzle timestamp_ms 호환                                   |
| `batchInsert()`                           | CHUNK=99 분할 + onConflictDoNothing. createFileRepository 패턴 재사용                              |
| `sortTodosByParent()`                     | 자기참조 FK의 topological sort. 순환 참조 방지 포함                                                |
| `mapTabJsons()`                           | tabsJson/panesJson/layoutJson 3개 JSON의 ID 매핑을 단일 함수로 처리                                |
| todos 개별 insert                         | topological sort 순서 보장 필요 — batch insert 시 순서 미보장                                      |
| Level 2 per-parent 쿼리                   | canvas_nodes/edges/groups는 canvasId별, schedule_todos는 scheduleId별, reminders는 entityId별 조회 |
| archiver + adm-zip 조합                   | export는 스트리밍(대용량 대응), import는 동기(트랜잭션 호환)                                       |
| `db.$client.transaction(() => { ... })()` | better-sqlite3 네이티브 트랜잭션. 프로젝트 기존 패턴                                               |
| `copyDirSync()`                           | `fs.copyFileSync` 기반 재귀 복사. 프로젝트 컨벤션에 맞춤 (`fs.cpSync` 미사용)                      |
| 파일 먼저 복사 후 DB                      | watcher 미활성 상태에서 안전. DB 실패 시 파일 정리                                                 |

### 3.3 IPC Handlers

**파일**: `src/main/ipc/backup.ts`

```typescript
import { ipcMain, dialog } from 'electron'
import { handle, handleAsync } from '../lib/handle'
import { successResponse } from '../lib/ipc-response'
import { backupService } from '../services/backup'
import { workspaceService } from '../services/workspace'

export function registerBackupHandlers(): void {
  ipcMain.handle('backup:export', async (_, workspaceId: string) => {
    const ws = workspaceService.getById(workspaceId)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: `rally-backup-${ws.name}-${timestamp}.zip`,
      filters: [{ name: 'ZIP', extensions: ['zip'] }]
    })
    if (canceled || !filePath) return successResponse(null)
    return handleAsync(() => backupService.export(workspaceId, filePath))
  })

  ipcMain.handle('backup:selectFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      filters: [{ name: 'Rally Backup', extensions: ['zip'] }],
      properties: ['openFile']
    })
    return canceled ? null : filePaths[0]
  })

  ipcMain.handle('backup:readManifest', (_, zipPath: string) =>
    handle(() => backupService.readManifest(zipPath))
  )

  ipcMain.handle('backup:import', async (_, zipPath: string, name: string, path: string) =>
    handleAsync(() => backupService.import(zipPath, name, path))
  )
}
```

**설계 근거**:

| 항목                       | 설명                                                                        |
| -------------------------- | --------------------------------------------------------------------------- |
| export dialog in handler   | dialog.showSaveDialog는 main process에서만 호출 가능 — IPC handler 내 처리  |
| readManifest는 동기 handle | adm-zip의 동기 API 사용, 기존 handle 래퍼 호환                              |
| selectFile 직접 반환       | 파일 경로 선택만 — IpcResponse 미사용 (기존 workspace:selectDirectory 패턴) |

### 3.4 핸들러 등록

**파일**: `src/main/index.ts` — 추가:

```typescript
import { registerBackupHandlers } from './ipc/backup'

// app.whenReady() 내부, 기존 handler 등록 뒤에 추가
registerBackupHandlers()
```

### 3.5 Preload Bridge

**파일**: `src/preload/index.ts` — `api` 객체에 추가:

```typescript
backup: {
  export: (workspaceId: string) => ipcRenderer.invoke('backup:export', workspaceId),
  selectFile: () => ipcRenderer.invoke('backup:selectFile'),
  readManifest: (zipPath: string) => ipcRenderer.invoke('backup:readManifest', zipPath),
  import: (zipPath: string, name: string, path: string) =>
    ipcRenderer.invoke('backup:import', zipPath, name, path)
}
```

### 3.6 Preload 타입 선언

**파일**: `src/preload/index.d.ts` — 추가:

```typescript
import type { Workspace } from '../main/repositories/workspace'

interface BackupManifest {
  version: number
  appVersion: string
  workspaceName: string
  exportedAt: string
  tables: string[]
}

interface BackupAPI {
  export: (workspaceId: string) => Promise<IpcResponse<null>>
  selectFile: () => Promise<string | null>
  readManifest: (zipPath: string) => Promise<IpcResponse<BackupManifest>>
  import: (zipPath: string, name: string, path: string) => Promise<IpcResponse<Workspace>>
}

// API 인터페이스에 추가
interface API {
  // ...기존 항목
  backup: BackupAPI
}
```

---

## 4. Frontend

### 4.1 FSD 구조

```
src/renderer/src/
└── features/workspace/
    ├── switch-workspace/
    │   └── ui/
    │       └── CreateWorkspaceDialog.tsx   ← 기존 파일 수정 (복구 UI 추가)
    └── backup-workspace/                   ← 신규
        ├── model/
        │   └── queries.ts                  ← useExportBackup, useImportBackup
        ├── ui/
        │   └── BackupRestoreSection.tsx    ← 복구 파일 선택 UI 섹션
        └── index.ts                        ← barrel export
```

### 4.2 React Query — queries.ts

**파일**: `src/renderer/src/features/workspace/backup-workspace/model/queries.ts`

```typescript
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { throwIpcError } from '@shared/lib/ipc-error'
import type { IpcResponse } from '@shared/types/ipc'

export function useExportBackup(): UseMutationResult<null, Error, string> {
  return useMutation({
    mutationFn: async (workspaceId: string): Promise<null> => {
      const res: IpcResponse<null> = await window.api.backup.export(workspaceId)
      if (!res.success) throwIpcError(res)
      return res.data ?? null
    }
  })
}

interface ImportBackupParams {
  zipPath: string
  name: string
  path: string
}

export function useImportBackup(): UseMutationResult<
  { id: string } | undefined,
  Error,
  ImportBackupParams
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ zipPath, name, path }: ImportBackupParams) => {
      const res = await window.api.backup.import(zipPath, name, path)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
    }
  })
}
```

### 4.3 BackupRestoreSection 컴포넌트

**파일**: `src/renderer/src/features/workspace/backup-workspace/ui/BackupRestoreSection.tsx`

```tsx
import { useState } from 'react'
import { Upload, X } from 'lucide-react'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'

interface Props {
  onBackupSelected: (zipPath: string, workspaceName: string) => void
  onBackupCleared: () => void
}

export function BackupRestoreSection({ onBackupSelected, onBackupCleared }: Props) {
  const [zipPath, setZipPath] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>('')

  const handleSelectFile = async () => {
    const path = await window.api.backup.selectFile()
    if (!path) return

    setZipPath(path)
    setFileName(path.split('/').pop() ?? path)

    // manifest 읽어서 이름 자동 채움
    const res = await window.api.backup.readManifest(path)
    if (res.success && res.data) {
      onBackupSelected(path, res.data.workspaceName)
    }
  }

  const handleClear = () => {
    setZipPath(null)
    setFileName('')
    onBackupCleared()
  }

  return (
    <div className="mt-4 pt-4 border-t">
      <p className="text-sm font-medium mb-2">백업에서 복구</p>
      <div className="flex gap-2">
        <Input
          placeholder="백업 파일을 선택해주세요"
          readOnly
          value={fileName}
          className="flex-1"
        />
        {zipPath ? (
          <Button type="button" variant="outline" size="icon" onClick={handleClear}>
            <X className="size-4" />
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={handleSelectFile}>
            <Upload className="size-4 mr-1" />
            선택
          </Button>
        )}
      </div>
      {zipPath && (
        <p className="text-xs text-muted-foreground mt-1">
          백업 파일에서 이름이 자동 입력됩니다. 수정할 수 있습니다.
        </p>
      )}
    </div>
  )
}
```

### 4.4 CreateWorkspaceDialog 수정

**파일**: `src/renderer/src/features/workspace/switch-workspace/ui/CreateWorkspaceDialog.tsx`

```tsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/ui/dialog'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@shared/ui/form'
import { useCreateWorkspace } from '@entities/workspace'
import { useImportBackup, BackupRestoreSection } from '@features/workspace/backup-workspace'
import { JSX } from 'react'

const formSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요'),
  path: z.string().min(1, '경로를 선택해주세요')
})

type FormValues = z.infer<typeof formSchema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (id: string) => void
}

export function CreateWorkspaceDialog({ open, onOpenChange, onCreated }: Props): JSX.Element {
  const { mutate: createWorkspace, isPending: isCreating } = useCreateWorkspace()
  const { mutate: importBackup, isPending: isImporting } = useImportBackup()
  const [backupZipPath, setBackupZipPath] = useState<string | null>(null)

  const isPending = isCreating || isImporting

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', path: '' }
  })

  const handleSelectDirectory = async (): Promise<void> => {
    const result = await window.api.workspace.selectDirectory()
    if (result) {
      form.setValue('path', result, { shouldValidate: true })
    }
  }

  const handleBackupSelected = (zipPath: string, workspaceName: string): void => {
    setBackupZipPath(zipPath)
    form.setValue('name', workspaceName, { shouldValidate: true })
  }

  const handleBackupCleared = (): void => {
    setBackupZipPath(null)
  }

  const handleSubmit = (values: FormValues): void => {
    if (backupZipPath) {
      // 백업에서 복구
      importBackup(
        { zipPath: backupZipPath, name: values.name, path: values.path },
        {
          onSuccess: (data) => {
            if (data?.id) {
              onCreated(data.id)
              onOpenChange(false)
              form.reset()
              setBackupZipPath(null)
            }
          }
        }
      )
    } else {
      // 일반 생성
      createWorkspace(
        { name: values.name, path: values.path },
        {
          onSuccess: (data) => {
            if (data?.id) {
              onCreated(data.id)
              onOpenChange(false)
              form.reset()
            }
          }
        }
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>워크스페이스 추가</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>이름</FormLabel>
                  <FormControl>
                    <Input placeholder="워크스페이스 이름" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="path"
              render={({ field }) => (
                <FormItem className="mt-4">
                  <FormLabel>워크스페이스 경로</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input placeholder="폴더를 선택해주세요" readOnly {...field} />
                    </FormControl>
                    <Button type="button" variant="outline" onClick={handleSelectDirectory}>
                      폴더 선택
                    </Button>
                  </div>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">
                    생성 후 경로는 변경할 수 없습니다.
                  </p>
                </FormItem>
              )}
            />
            <BackupRestoreSection
              onBackupSelected={handleBackupSelected}
              onBackupCleared={handleBackupCleared}
            />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (backupZipPath ? '복구 중...' : '생성 중...') : '생성'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

### 4.5 WorkspaceSwitcher — 내보내기 메뉴 추가

**파일**: `src/renderer/src/features/workspace/switch-workspace/ui/WorkspaceSwitcher.tsx`

기존 DropdownMenuContent 내부, "워크스페이스 삭제" 위에 추가:

```tsx
import { Download } from 'lucide-react'
import { useExportBackup } from '@features/workspace/backup-workspace'
import { toast } from 'sonner'

// WorkspaceSwitcher 컴포넌트 내부:
const { mutate: exportBackup } = useExportBackup()

const handleExport = () => {
  if (!currentWorkspaceId) return
  exportBackup(currentWorkspaceId, {
    onSuccess: () => toast.success('백업이 완료되었습니다.'),
    onError: () => toast.error('백업에 실패했습니다.')
  })
}

// DropdownMenu 내부 (워크스페이스 삭제 위에):
;<DropdownMenuItem onClick={handleExport} className="cursor-pointer">
  <Download className="size-4 mr-2" />
  백업 내보내기
</DropdownMenuItem>
```

### 4.6 barrel export

**파일**: `src/renderer/src/features/workspace/backup-workspace/index.ts`

```typescript
export { useExportBackup, useImportBackup } from './model/queries'
export { BackupRestoreSection } from './ui/BackupRestoreSection'
```

---

## 5. 구현 순서

| 순서 | 작업                               | 파일                                                          |
| ---- | ---------------------------------- | ------------------------------------------------------------- |
| 1    | 의존성 설치                        | `npm install archiver @types/archiver adm-zip @types/adm-zip` |
| 2    | handleAsync 추가                   | `src/main/lib/handle.ts`                                      |
| 3    | backup service                     | `src/main/services/backup.ts`                                 |
| 4    | IPC handlers                       | `src/main/ipc/backup.ts` + `src/main/index.ts` 등록           |
| 5    | Preload bridge                     | `src/preload/index.ts` + `src/preload/index.d.ts`             |
| 6    | FE: queries + BackupRestoreSection | `features/workspace/backup-workspace/`                        |
| 7    | FE: CreateWorkspaceDialog 수정     | `switch-workspace/ui/CreateWorkspaceDialog.tsx`               |
| 8    | FE: WorkspaceSwitcher 내보내기     | `switch-workspace/ui/WorkspaceSwitcher.tsx`                   |

---

## 6. 참고 사항

- **Workspace Watcher 충돌 방지**: import는 DB에 워크스페이스만 생성하고 activate하지 않음. watcher는 activate 시점에 시작되므로 import 중 파일 감지 충돌 없음. activate 후 reconcile 시에도 `onConflictDoNothing`과 `dbPathSet` 체크로 안전
- **archiver + adm-zip 조합**: export는 스트리밍(archiver), import는 동기(adm-zip). better-sqlite3 트랜잭션은 동기여야 하므로 ZIP 해제는 트랜잭션 밖에서 먼저 수행, JSON 파싱 후 동기 트랜잭션 내에서 DB 삽입
- **에러 롤백**: DB 트랜잭션 실패 시 자동 롤백. 파일은 catch 블록에서 수동 정리 (`fs.rmSync`)
- **진행률**: v1에서는 미지원. toast로 시작/완료/에러만 표시
- **FSD 레이어**: `backup-workspace` feature는 `switch-workspace`와 동일 레벨. `CreateWorkspaceDialog`에서 `backup-workspace`를 import하는 것은 FSD의 동일 레이어 간 import 금지 원칙에 위배되나, 기존 코드베이스에서도 동일한 패턴이 존재하며 (예: feature 간 cross-import), backup은 workspace 생성 흐름의 확장이므로 허용. 대안으로 widgets 레이어로 올리면 과도한 추상화
- **`createTabId()` 중복**: renderer의 factory.ts 로직을 service에서 재현. 공통 모듈로 추출하면 좋으나 main/renderer 경계상 복제가 현실적
- reminder 조회 시 `and(eq(entityType), eq(entityId))` SQL 레벨 필터로 정확한 매칭 보장 — JS 후처리 필터 대비 효율적
- tab_snapshots에는 activePaneId 컬럼이 없으므로 mapTabJsons의 activePaneId 인자에 null 전달
- canvas_groups 스키마에 따라 실제 컬럼명 확인 필요 (label, color, x, y, width, height 등)
