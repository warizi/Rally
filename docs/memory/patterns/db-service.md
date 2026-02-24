# DB & Service Layer Patterns

## DB Initialization (main/db/index.ts)
```typescript
const isDev = !app.isPackaged
const dbPath = isDev
  ? path.join(process.cwd(), 'rally-dev.db')
  : path.join(app.getPath('userData'), 'rally.db')

const sqlite = new Database(dbPath)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })
```
- Dev: `rally-dev.db` at project root
- Prod: `app.getPath('userData')`

## Drizzle Schema Pattern
```typescript
// main/db/schema/workspace.ts
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
})
```
- Timestamps: `integer('col', { mode: 'timestamp_ms' })` → JS Date 객체
- Main schema entry: `src/main/db/schema/index.ts` (re-exports all tables)
- Migration: `npm run db:generate` → `npm run db:migrate`

## Repository Pattern (main/repositories/)
```typescript
// Type inference from schema
export type Workspace = typeof workspaces.$inferSelect   // SELECT 결과 타입
export type WorkspaceInsert = typeof workspaces.$inferInsert  // INSERT 입력 타입
export type WorkspaceUpdate = Partial<Pick<Workspace, 'name' | 'updatedAt'>>

export const workspaceRepository = {
  findAll(): Workspace[] {
    return db.select().from(workspaces).all()
  },
  findById(id: string): Workspace | undefined {
    return db.select().from(workspaces).where(eq(workspaces.id, id)).get()
  },
  create(data: WorkspaceInsert): Workspace {
    return db.insert(workspaces).values(data).returning().get()
  },
  update(id: string, data: WorkspaceUpdate): Workspace | undefined {
    return db.update(workspaces).set(data).where(eq(workspaces.id, id)).returning().get()
  },
  delete(id: string): void {
    db.delete(workspaces).where(eq(workspaces.id, id)).run()
  }
}
```
- **역할**: 순수 DB CRUD만 담당, 비즈니스 로직 없음
- `.all()` → 배열 반환 / `.get()` → 단일 반환 / `.run()` → void

## Service Layer Pattern (main/services/)
```typescript
export const workspaceService = {
  create(name: string) {
    if (!name.trim()) throw new ValidationError('Workspace name is required')
    return workspaceRepository.create({
      id: nanoid(),         // ID 생성은 서비스 책임
      name: name.trim(),
      createdAt: new Date(),
      updatedAt: new Date()
    })
  },
  update(id: string, data: WorkspaceUpdate) {
    const workspace = workspaceRepository.findById(id)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${id}`)
    return workspaceRepository.update(id, { ...data, updatedAt: new Date() })
  },
  delete(id: string) {
    const all = workspaceRepository.findAll()
    if (all.length <= 1) throw new ValidationError('Cannot delete the last workspace')
    workspaceRepository.delete(id)
  }
}
```
- **역할**: 유효성 검사, Custom Error 던지기, ID/timestamp 생성
- ID: `nanoid()` 사용

## IPC Handler Registration (main/ipc/)
```typescript
// main/ipc/workspace.ts
export function registerWorkspaceHandlers(): void {
  ipcMain.handle('workspace:getAll', () => handle(() => workspaceService.getAll()))
  ipcMain.handle('workspace:getById', (_, id: string) =>
    handle(() => workspaceService.getById(id))
  )
  ipcMain.handle('workspace:create', (_, name: string) =>
    handle(() => workspaceService.create(name))
  )
}

// main/index.ts (app ready 후 등록)
registerWorkspaceHandlers()
registerTabSessionHandlers()
```
- 채널 명명: `'domain:action'` (camelCase)
- `handle()` 래퍼로 자동 try-catch → IpcResponse 변환

## Tab Session Schema (JSON columns)
```typescript
// DB에 JSON 문자열로 저장
export const tabSessions = sqliteTable('tab_sessions', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  tabsJson: text('tabs_json').notNull(),    // JSON.stringify(Record<string, Tab>)
  panesJson: text('panes_json').notNull(),  // JSON.stringify(Record<string, Pane>)
  layoutJson: text('layout_json').notNull(),
  activePaneId: text('active_pane_id').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
})
```
- Renderer 로드 시: `JSON.parse(session.tabsJson)` 후 icon 필드 복구 (`icon ?? type`)

## Node Test Setup (main/__tests__/setup.ts)
```typescript
// In-memory SQLite for tests
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from '../db/schema'

const sqlite = new Database(':memory:')
const db = drizzle(sqlite, { schema })
migrate(db, { migrationsFolder: 'src/main/db/migrations' })

vi.mock('../db', () => ({ db }))  // DB 모듈 교체
```
