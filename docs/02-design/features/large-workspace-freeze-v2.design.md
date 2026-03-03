# Design: large-workspace-freeze-v2

> Plan 참조: `docs/01-plan/features/large-workspace-freeze-v2.plan.md`

## 개요

Freeze 원인 2가지를 7개 Fix로 해결한다.
변경 파일은 6개이며 DB 스키마 / 마이그레이션 / preload / renderer 변경은 없다.

| Fix   | 해결 문제                                      | 변경 파일                               |
| ----- | ---------------------------------------------- | --------------------------------------- |
| Fix 1 | P0-2: note IPC fs 스캔 제거                    | `services/note.ts`                      |
| Fix 2 | P0-2: note IPC 교체                            | `ipc/note.ts`                           |
| Fix 3 | P2: standalone MD create/delete watcher 미처리 | `services/workspace-watcher.ts`         |
| Fix 4 | P0-1: note 초기 reconciliation 백그라운드화    | `services/workspace-watcher.ts`         |
| Fix 5 | P1: noteRepository SQLite 999-var crash        | `repositories/note.ts`                  |
| Fix 6 | P0-1: fs.readdirSync → async                   | `lib/fs-utils.ts`, `services/folder.ts` |
| Fix 7 | P3: handleEvents 이벤트 유실 버그              | `services/workspace-watcher.ts`         |

---

## Fix 1 — `src/main/services/note.ts`

### 추가: `readByWorkspaceFromDb`

기존 `readByWorkspace` 아래에 추가한다. IPC 핸들러에서만 사용.
기존 `readByWorkspace`는 테스트 및 직접 동기화 용도로 그대로 유지한다.

```typescript
/**
 * DB만 읽어 즉시 반환 — fs 스캔 없음, IPC 핸들러용 (non-blocking)
 * reconciliation은 workspaceWatcher가 백그라운드에서 수행하고
 * 완료 후 'note:changed' push([], empty) → renderer re-fetch
 */
readByWorkspaceFromDb(workspaceId: string): NoteNode[] {
  const workspace = workspaceRepository.findById(workspaceId)
  if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)
  return noteRepository.findByWorkspaceId(workspaceId).map(toNoteNode)
},
```

**위치**: `noteService` 객체의 `readByWorkspace` 바로 아래

---

## Fix 2 — `src/main/ipc/note.ts`

### 변경: `note:readByWorkspace` 핸들러

```typescript
// Before
ipcMain.handle(
  'note:readByWorkspace',
  (_: IpcMainInvokeEvent, workspaceId: string): IpcResponse =>
    handle(() => noteService.readByWorkspace(workspaceId))
)

// After
ipcMain.handle(
  'note:readByWorkspace',
  (_: IpcMainInvokeEvent, workspaceId: string): IpcResponse =>
    handle(() => noteService.readByWorkspaceFromDb(workspaceId))
)
```

1줄 변경. 나머지 핸들러는 그대로.

---

## Fix 3 — `src/main/services/workspace-watcher.ts` (1/3)

### 변경: `applyEvents` — Step 3 수정 + Step 4, Step 5 추가

#### 현재 Step 3 구조

```typescript
const pairedMdDeletePaths = new Set<string>()
for (const createEvent of mdCreates) {
  ...
  if (matchingDelete) {
    ...
    pairedMdDeletePaths.add(matchingDelete.path)
    // ← createEvent.path 추적 없음
  }
}
```

#### 변경 후 Step 3 + 신규 Step 4, 5

```typescript
// ─── Step 3: .md 파일 rename/move 감지 ───────────────────────
const pairedMdDeletePaths = new Set<string>()
const pairedMdCreatePaths = new Set<string>() // ← 신규
for (const createEvent of mdCreates) {
  const createDir = path.dirname(createEvent.path)
  const createBasename = path.basename(createEvent.path)
  const matchingDelete =
    mdDeletes.find((d) => !pairedMdDeletePaths.has(d.path) && path.dirname(d.path) === createDir) ??
    mdDeletes.find(
      (d) => !pairedMdDeletePaths.has(d.path) && path.basename(d.path) === createBasename
    )
  if (matchingDelete) {
    const oldRel = path.relative(workspacePath, matchingDelete.path).replace(/\\/g, '/')
    const newRel = path.relative(workspacePath, createEvent.path).replace(/\\/g, '/')
    const existing = noteRepository.findByRelativePath(workspaceId, oldRel)
    if (existing) {
      const newParentRel = newRel.includes('/') ? newRel.split('/').slice(0, -1).join('/') : null
      const newFolder = newParentRel
        ? folderRepository.findByRelativePath(workspaceId, newParentRel)
        : null
      noteRepository.update(existing.id, {
        relativePath: newRel,
        folderId: newParentRel ? (newFolder?.id ?? existing.folderId) : null,
        title: path.basename(createEvent.path, '.md'),
        updatedAt: new Date()
      })
      pairedMdDeletePaths.add(matchingDelete.path)
      pairedMdCreatePaths.add(createEvent.path) // ← 신규
    }
  }
}

// ─── Step 4 (신규): standalone MD create → DB에 note 추가 ────
for (const createEvent of mdCreates) {
  if (pairedMdCreatePaths.has(createEvent.path)) continue
  const rel = path.relative(workspacePath, createEvent.path).replace(/\\/g, '/')
  const existing = noteRepository.findByRelativePath(workspaceId, rel)
  if (!existing) {
    // 50ms 디바운스 윈도우 내에 create → delete/rename이 발생하면 파일이 사라질 수 있음
    // stat 체크로 orphan DB 항목 생성 방지
    try {
      const stat = await fs.promises.stat(createEvent.path)
      if (!stat.isFile()) continue
    } catch {
      continue // 파일이 이미 없음 (디바운스 윈도우 내 삭제/이름 변경)
    }
    const parentRel = rel.includes('/') ? rel.split('/').slice(0, -1).join('/') : null
    const folder = parentRel ? folderRepository.findByRelativePath(workspaceId, parentRel) : null
    const now = new Date()
    noteRepository.create({
      id: nanoid(),
      workspaceId,
      relativePath: rel,
      folderId: folder?.id ?? null,
      title: path.basename(createEvent.path, '.md'),
      description: '',
      preview: '',
      order: 0,
      createdAt: now,
      updatedAt: now
    })
  }
}

// ─── Step 5 (신규): standalone MD delete → DB에서 note 삭제 ──
for (const deleteEvent of mdDeletes) {
  if (pairedMdDeletePaths.has(deleteEvent.path)) continue
  const rel = path.relative(workspacePath, deleteEvent.path).replace(/\\/g, '/')
  const existing = noteRepository.findByRelativePath(workspaceId, rel)
  if (existing) {
    noteRepository.delete(existing.id)
  }
}
```

**import 추가 확인**: `noteRepository`는 이미 import됨. `nanoid`도 이미 import됨.

---

## Fix 4 — `src/main/services/workspace-watcher.ts` (2/3)

### 추가: `noteReconciliation` + `start()` 수정

#### 신규 메서드: `noteReconciliation`

`fullReconciliation` 바로 아래에 추가:

```typescript
private async noteReconciliation(workspaceId: string, workspacePath: string): Promise<void> {
  const fsEntries = await readMdFilesRecursiveAsync(workspacePath, '')
  const fsPaths = fsEntries.map((e) => e.relativePath)

  const dbNotes = noteRepository.findByWorkspaceId(workspaceId)
  const dbPathSet = new Set(dbNotes.map((n) => n.relativePath))

  const now = new Date()
  const toInsert = fsEntries
    .filter((e) => !dbPathSet.has(e.relativePath))
    .map((e) => {
      const parentRel = e.relativePath.includes('/')
        ? e.relativePath.split('/').slice(0, -1).join('/')
        : null
      const folder = parentRel
        ? folderRepository.findByRelativePath(workspaceId, parentRel)
        : null
      return {
        id: nanoid(),
        workspaceId,
        relativePath: e.relativePath,
        folderId: folder?.id ?? null,
        title: e.name.replace(/\.md$/, ''),
        description: '',
        preview: '',
        order: 0,
        createdAt: now,
        updatedAt: now
      }
    })

  noteRepository.createMany(toInsert)
  noteRepository.deleteOrphans(workspaceId, fsPaths)
}
```

#### 변경: `start()` — noteReconciliation + pushNoteChanged 추가

```typescript
async start(workspaceId: string, workspacePath: string): Promise<void> {
  await this.syncOfflineChanges(workspaceId, workspacePath)

  // note 초기 동기화 — try/catch: 실패해도 watcher는 정상 시작
  try {
    await this.noteReconciliation(workspaceId, workspacePath)
  } catch {
    /* ignore — watcher continues without initial note sync */
  }

  // 초기 동기화 완료 → renderer re-fetch
  this.pushFolderChanged(workspaceId)
  this.pushNoteChanged(workspaceId, [])   // ← 신규: note list re-fetch 신호

  try {
    this.subscription = await parcelWatcher.subscribe(workspacePath, (err, events) => {
      if (err) return
      this.handleEvents(workspaceId, workspacePath, events)
    })
    this.activeWorkspaceId = workspaceId
    this.activeWorkspacePath = workspacePath
  } catch {
    // workspace 접근 불가 → watcher 없이 진행 (crash 방지)
  }
}
```

**import 추가**: `readMdFilesRecursiveAsync`를 `fs-utils.ts`에서 import 추가

```typescript
// 현재
import { readDirRecursive } from './folder'

// 변경 후 (readDirRecursive는 fullReconciliation에서 더 이상 사용 안 함 → 제거)
import { readDirRecursiveAsync } from './folder'
import { readMdFilesRecursiveAsync } from '../lib/fs-utils'
```

---

## Fix 5 — `src/main/repositories/note.ts`

### 변경: `createMany` — 청킹 + 트랜잭션

notes 테이블: 10컬럼 → CHUNK = 99 (10×99=990 < 999)

```typescript
// Before
createMany(items: NoteInsert[]): void {
  if (items.length === 0) return
  db.insert(notes).values(items).onConflictDoNothing().run()
},

// After
createMany(items: NoteInsert[]): void {
  if (items.length === 0) return
  const CHUNK = 99 // 10 columns × 99 = 990 variables < SQLite 999 limit
  for (let i = 0; i < items.length; i += CHUNK) {
    db.insert(notes).values(items.slice(i, i + CHUNK)).onConflictDoNothing().run()
  }
},
```

### 변경: `deleteOrphans` — JS-side diff + chunked delete

```typescript
// Before
deleteOrphans(workspaceId: string, existingPaths: string[]): void {
  if (existingPaths.length === 0) {
    db.delete(notes).where(eq(notes.workspaceId, workspaceId)).run()
    return
  }
  db.delete(notes)
    .where(
      and(eq(notes.workspaceId, workspaceId), not(inArray(notes.relativePath, existingPaths)))
    )
    .run()
},

// After
deleteOrphans(workspaceId: string, existingPaths: string[]): void {
  if (existingPaths.length === 0) {
    db.delete(notes).where(eq(notes.workspaceId, workspaceId)).run()
    return
  }
  const existingSet = new Set(existingPaths)
  const dbRows = db
    .select({ id: notes.id, relativePath: notes.relativePath })
    .from(notes)
    .where(eq(notes.workspaceId, workspaceId))
    .all()
  const orphanIds = dbRows
    .filter((r) => !existingSet.has(r.relativePath))
    .map((r) => r.id)
  if (orphanIds.length === 0) return
  // inArray also has the 999-variable limit; chunk at 900 to stay safe
  const CHUNK = 900
  for (let i = 0; i < orphanIds.length; i += CHUNK) {
    db.delete(notes).where(inArray(notes.id, orphanIds.slice(i, i + CHUNK))).run()
  }
},
```

**import 변경**: `not` 제거 (`inArray`는 이미 있음)

```typescript
// Before
import { and, eq, inArray, not } from 'drizzle-orm'

// After
import { and, eq, inArray } from 'drizzle-orm'
```

---

## Fix 6 — `src/main/lib/fs-utils.ts` + `src/main/services/folder.ts`

### `src/main/lib/fs-utils.ts` — `readMdFilesRecursiveAsync` 추가

기존 `readMdFilesRecursive` 아래에 추가. 기존 sync 버전은 그대로 유지:

```typescript
/**
 * .md 파일 비동기 재귀 탐색
 * fs.promises.readdir 사용 → 이벤트 루프를 블로킹하지 않음
 * workspace-watcher의 reconciliation에서 사용
 */
export async function readMdFilesRecursiveAsync(
  absBase: string,
  parentRel: string
): Promise<MdFileEntry[]> {
  const absDir = parentRel ? path.join(absBase, parentRel) : absBase
  let entries: fs.Dirent[]
  try {
    entries = await fs.promises.readdir(absDir, { withFileTypes: true })
  } catch {
    return []
  }

  const result: MdFileEntry[] = []
  const subdirPromises: Promise<MdFileEntry[]>[] = []

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    if (entry.name.startsWith('.')) continue

    const rel = parentRel ? `${parentRel}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      subdirPromises.push(readMdFilesRecursiveAsync(absBase, rel))
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      result.push({ name: entry.name, relativePath: rel })
    }
  }

  const subResults = await Promise.all(subdirPromises)
  for (const sub of subResults) result.push(...sub)
  return result
}
```

### `src/main/services/folder.ts` — `readDirRecursiveAsync` 추가

기존 `readDirRecursive` 아래에 추가. 기존 sync 버전은 그대로 유지:

```typescript
/**
 * fs 비동기 재귀 탐색 — 심볼릭 링크·숨김 폴더 제외
 * fs.promises.readdir 사용 → 이벤트 루프를 블로킹하지 않음
 * workspace-watcher의 fullReconciliation에서 사용
 */
export async function readDirRecursiveAsync(
  absBase: string,
  parentRel: string
): Promise<FsEntry[]> {
  const absDir = parentRel ? path.join(absBase, parentRel) : absBase
  let entries: fs.Dirent[]
  try {
    entries = await fs.promises.readdir(absDir, { withFileTypes: true })
  } catch {
    return []
  }

  const result: FsEntry[] = []
  const subdirPromises: Promise<FsEntry[]>[] = []

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    if (!entry.isDirectory()) continue
    if (entry.name.startsWith('.')) continue
    const rel = parentRel ? `${parentRel}/${entry.name}` : entry.name
    result.push({ name: entry.name, relativePath: rel })
    subdirPromises.push(readDirRecursiveAsync(absBase, rel))
  }

  const subResults = await Promise.all(subdirPromises)
  for (const sub of subResults) result.push(...sub)
  return result
}
```

### `src/main/services/workspace-watcher.ts` — `fullReconciliation` 수정

`readDirRecursive` → `readDirRecursiveAsync` 로 교체:

```typescript
// Before
private async fullReconciliation(workspaceId: string, workspacePath: string): Promise<void> {
  const fsEntries = readDirRecursive(workspacePath, '')
  ...
}

// After
private async fullReconciliation(workspaceId: string, workspacePath: string): Promise<void> {
  const fsEntries = await readDirRecursiveAsync(workspacePath, '')
  ...
}
```

---

## Fix 7 — `src/main/services/workspace-watcher.ts` (3/3)

### 변경: `pendingEvents` 클래스 멤버 추가 + `handleEvents` 수정 + `stop()` 초기화

```typescript
class WorkspaceWatcherService {
  private subscription: parcelWatcher.AsyncSubscription | null = null
  private activeWorkspaceId: string | null = null
  private activeWorkspacePath: string | null = null
  private debounceTimer: NodeJS.Timeout | null = null
  private pendingEvents: parcelWatcher.Event[] = []   // ← 신규
```

```typescript
// Before
private handleEvents(
  workspaceId: string,
  workspacePath: string,
  events: parcelWatcher.Event[]
): void {
  if (this.debounceTimer) clearTimeout(this.debounceTimer)
  this.debounceTimer = setTimeout(async () => {
    await this.applyEvents(workspaceId, workspacePath, events)
    this.pushFolderChanged(workspaceId)
    const changedRelPaths = events
      .filter((e) => e.path.endsWith('.md') && !path.basename(e.path).startsWith('.'))
      .map((e) => path.relative(workspacePath, e.path).replace(/\\/g, '/'))
    this.pushNoteChanged(workspaceId, changedRelPaths)
  }, 50)
}

// After
private handleEvents(
  workspaceId: string,
  workspacePath: string,
  events: parcelWatcher.Event[]
): void {
  this.pendingEvents.push(...events)   // 누적
  if (this.debounceTimer) clearTimeout(this.debounceTimer)
  this.debounceTimer = setTimeout(async () => {
    const eventsToProcess = this.pendingEvents.splice(0)   // 전부 꺼내고 초기화
    await this.applyEvents(workspaceId, workspacePath, eventsToProcess)
    this.pushFolderChanged(workspaceId)
    const changedRelPaths = eventsToProcess
      .filter((e) => e.path.endsWith('.md') && !path.basename(e.path).startsWith('.'))
      .map((e) => path.relative(workspacePath, e.path).replace(/\\/g, '/'))
    this.pushNoteChanged(workspaceId, changedRelPaths)
  }, 50)
}
```

```typescript
// stop() 수정 — pendingEvents 초기화 추가
async stop(): Promise<void> {
  this.pendingEvents = []   // ← 추가: workspace 전환 시 미처리 이벤트 제거
  if (this.debounceTimer) {
    clearTimeout(this.debounceTimer)
    this.debounceTimer = null
  }
  // ... 나머지 동일
}
```

---

## 최종 workspace-watcher.ts import 전체

```typescript
import * as parcelWatcher from '@parcel/watcher'
import { app, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import { folderRepository } from '../repositories/folder'
import { noteRepository } from '../repositories/note'
import { readDirRecursiveAsync } from './folder' // ← readDirRecursive 제거, readDirRecursiveAsync 추가
import { readMdFilesRecursiveAsync } from '../lib/fs-utils' // ← 신규
import { nanoid } from 'nanoid'
```

---

## 데이터 흐름 요약

### 앱 시작 / 워크스페이스 진입

```
Renderer                Main Process
─────────               ─────────────────────────────────────────────────
folder:readTree ──────► ensureWatching() [void, background]
                 ◄────── readTreeFromDb()  → [] or cached DB rows (fast)

note:readByWorkspace ►  readByWorkspaceFromDb() → [] or cached DB rows (fast)
                 ◄──────

                        [background: start()]
                          syncOfflineChanges()
                            fullReconciliation()
                              readDirRecursiveAsync()  [non-blocking]
                              createMany() [chunked tx]
                              deleteOrphans() [JS diff]

                          noteReconciliation()
                            readMdFilesRecursiveAsync()  [non-blocking]
                            createMany() [chunked tx]
                            deleteOrphans() [JS diff]

                          pushFolderChanged()
folder:changed  ◄───────  pushNoteChanged([], empty)
note:changed    ◄───────

folder:readTree ──────► readTreeFromDb()  → 최신 DB rows (fast)
                 ◄──────
note:readByWorkspace ►  readByWorkspaceFromDb() → 최신 DB rows (fast)
                 ◄──────
```

### MD 파일 내용 수정

```
@parcel/watcher         Main Process              Renderer
───────────────         ─────────────             ────────────────────
change event ─────────► handleEvents()
                          pendingEvents.push(e)
                          [50ms debounce]
                          eventsToProcess = splice(0)
                          applyEvents()  [fast: change = skip]
                          pushFolderChanged()  ────────────────────► invalidate folder tree
                          pushNoteChanged([path]) ─────────────────► invalidateQueries note list
                                                                      note:readByWorkspace IPC
                                                    ◄─────────────── readByWorkspaceFromDb() [fast]
                                                                      refetchQueries note content
```

### 외부 MD 파일 생성

```
@parcel/watcher         Main Process              Renderer
───────────────         ─────────────             ────────────────────
create event ─────────► handleEvents()
                          applyEvents()
                            Step 3: rename pair? NO
                            Step 4: standalone create
                              noteRepository.create()  [DB에 즉시 추가]
                          pushNoteChanged([newPath]) ──────────────► invalidate note list
                                                                      note:readByWorkspace IPC
                                                    ◄─────────────── readByWorkspaceFromDb() [fast]
                                                                      → 신규 파일 포함된 목록 반환
```

---

## 엣지 케이스

### EC-1: 첫 진입 시 DB 비어있음

최초 워크스페이스 진입 시 DB가 비어있는 경우:

- `readTreeFromDb()` → 빈 배열 → 렌더러에 빈 폴더 트리 표시
- `readByWorkspaceFromDb()` → 빈 배열 → 렌더러에 빈 노트 목록 표시
- background: `fullReconciliation` + `noteReconciliation` 완료 후 갱신

→ **UX**: 잠깐 빈 화면 → 자동 갱신. 허용 가능한 동작.

### EC-2: noteReconciliation 중 앱 종료

`before-quit` 핸들러에서 `workspaceWatcher.stop()` 호출 시:

- `pendingEvents = []` → debounceTimer cancel → unsubscribe → writeSnapshot
- `noteReconciliation`이 실행 중이면 async이므로 Promise.race(stop, 1초 타임아웃)로 처리됨
- 종료 시 reconciliation이 완료되지 않아도 다음 시작 시 다시 실행됨 → 안전

### EC-3: MD 파일 생성 후 즉시 이름 변경

watcher 이벤트 배치: `create(A)` + `delete(A)` + `create(B)` 가 한 배치에 오는 경우:

- `pendingEvents.splice(0)` 로 모두 꺼냄 (Fix 7 덕분에 유실 없음)
- **Step 3**: delete(A)+create(B) 쌍 감지 시도
  - A가 DB에 이미 있으면 → update (ID 보존, relativePath=B)
  - A가 DB에 없으면 (방금 생성된 파일) → `findByRelativePath(A)` null → 쌍 미등록, Steps 4+5로 처리
- **Step 4**: create(B) 처리 → `fs.promises.stat(B)` 성공 확인 → B를 DB에 추가
- **Step 5**: delete(A) 처리 → A가 DB에 없으면 no-op
- **최종 상태**: B만 DB에 존재 ✓

### EC-4: readDirRecursiveAsync 병렬 처리 깊이

`Promise.all(subdirPromises)` 로 같은 레벨의 폴더들을 병렬 처리.
수천 개 디렉토리에서 동시 Promise 폭발 가능성:

- 한 디렉토리 레벨의 하위 폴더 수가 수백~수천이면 동시 `fs.promises.readdir` 호출
- OS 파일 디스크립터 한도 초과 위험 (Linux: 1024, macOS: 2560)

→ **결정**: `Promise.all`로 진행. 실제 사용 패턴(Obsidian, VSCode 등)에서 입증된 방식.
문제 발생 시 concurrency limiter(p-limit 등) 도입은 별도 이슈로 관리.

### EC-5: noteReconciliation 중 폴더 DB 아직 미완성

`start()`에서 `syncOfflineChanges(folder)` 완료 후 `noteReconciliation` 실행.
`noteReconciliation` 내부에서 `folderRepository.findByRelativePath` 호출 시
folder reconciliation이 완료된 상태이므로 folderId 조회 가능 → 정상.

### EC-6: noteReconciliation에서 오프라인 이동의 note ID 보존 (알려진 한계)

`noteReconciliation`은 단순 insert/delete만 수행하며 이동 감지 로직이 없다.
앱이 종료된 사이에 note가 이동되면 → old path 삭제 + new path 삽입 (새 ID 생성).

- **정상 케이스**: 앱 종료 직전에 snapshot이 저장되므로 재시작 시 `getEventsSince` → `applyEvents` Step 3에서 rename pair 감지 → ID 보존
- **영향받는 케이스**: snapshot이 없거나 손상된 경우에만 `fullReconciliation` + `noteReconciliation` 실행
- **결론**: snapshot 손상은 드문 경우이므로 ID 유실이 발생해도 기능상 문제 없음 (note 내용은 보존됨). 향후 필요 시 별도 이슈로 관리.

---

## 테스트 설계

### 1. `noteRepository` 단위 테스트

| 테스트                             | 검증                        |
| ---------------------------------- | --------------------------- |
| `createMany(100개 초과 items)`     | crash 없이 전체 insert 확인 |
| `deleteOrphans(1000개 초과 paths)` | crash 없이 orphan 삭제 확인 |
| `deleteOrphans([])`                | 전체 삭제 확인              |

### 2. `noteService` 단위 테스트

| 테스트                                   | 검증                                    |
| ---------------------------------------- | --------------------------------------- |
| `readByWorkspaceFromDb`                  | fs.readdirSync 호출 없이 DB rows만 반환 |
| `readByWorkspaceFromDb` (workspace 없음) | `NotFoundError` throw                   |

### 3. `workspace-watcher` 통합 테스트 (기존 패턴 참조)

| 테스트                                         | 검증                                 |
| ---------------------------------------------- | ------------------------------------ |
| `applyEvents` — standalone MD create           | DB에 note row 추가됨                 |
| `applyEvents` — standalone MD delete           | DB에서 note row 삭제됨               |
| `applyEvents` — MD rename (delete+create pair) | ID 보존, relativePath 변경           |
| `handleEvents` 50ms 내 다중 호출               | pendingEvents 누적, 모든 이벤트 처리 |

### 4. `readMdFilesRecursiveAsync` / `readDirRecursiveAsync` 단위 테스트

| 테스트                  | 검증                         |
| ----------------------- | ---------------------------- |
| sync 버전과 결과 동일   | 같은 파일 트리에서 동일 결과 |
| 심볼릭 링크 무시        | 심볼릭 링크 미포함           |
| 숨김 파일/디렉토리 무시 | `.`으로 시작하는 항목 미포함 |

---

## 구현 순서 권장

Fix 간 의존 관계:

```
Fix 5 (note repo crash fix)
  ↓ (fix 5 적용 후 noteReconciliation이 안전하게 동작)
Fix 6 (async readdir)
  ↓ (async 버전 있어야 Fix 4/watcher가 사용 가능)
Fix 4 (noteReconciliation 추가) + Fix 7 (pendingEvents)
  ↓ (watcher 변경 완료 후)
Fix 3 (applyEvents Step 4/5)
  ↓ (watcher가 standalone MD create/delete를 DB에 반영해야)
Fix 1 (readByWorkspaceFromDb)
  ↓
Fix 2 (IPC 교체)  ← 마지막: IPC 교체는 다른 Fix가 모두 준비된 후
```

**권장 구현 순서**: Fix 5 → Fix 6 → Fix 4+7 → Fix 3 → Fix 1 → Fix 2
