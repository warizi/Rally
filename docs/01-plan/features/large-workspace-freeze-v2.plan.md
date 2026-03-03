# Plan: large-workspace-freeze-v2

## 증상

1. **워크스페이스 생성 / 진입 freeze** (~5초): 수천 개 파일/폴더가 있는 디렉토리를
   워크스페이스로 지정 또는 진입 시 앱 전체가 freeze (마우스 커서 대기 상태)
2. **MD 파일 내용 수정 후 freeze** (~5초): 동일 워크스페이스의 MD 파일을 수정하면
   동일하게 앱 전체가 freeze

---

## Previous Fix Status

`workspace-folder-freeze-fix`에서 구현 완료:

- `folder:readTree` → `readTreeFromDb()` (DB만, 즉시 반환) ✓
- `ensureWatching` fire-and-forget ✓
- 초기화 완료 후 `pushFolderChanged` ✓

`workspace-folder-sync-fix`에서 구현 완료:

- `folderRepository.createMany` chunking (CHUNK=100) ✓
- `folderRepository.deleteOrphans` JS-side diff + chunked delete ✓

→ **폴더 freeze는 해소되었으나 노트(MD) 쪽 동일 패턴이 미적용 상태**

---

## Root Cause Analysis

### Freeze #1 — 워크스페이스 생성 / 진입

```
void ensureWatching()   ← fire-and-forget
  └─ start()
       └─ syncOfflineChanges()
            └─ fullReconciliation()
                 └─ readDirRecursive()   ← fs.readdirSync() 재귀, 수천 회 호출
```

`readDirRecursive`는 `fs.readdirSync`를 재귀 호출한다.
Node.js에서 **동기 I/O는 async 함수 안에서도 이벤트 루프 전체를 블로킹**한다.
`void`로 호출해도 동기 구간 동안 IPC 큐가 처리되지 않아 렌더러가 freeze한다.

> 수천 개 폴더 × fs.readdirSync = 이벤트 루프 2~5초 점유

### Freeze #2 — MD 파일 내용 수정

```
@parcel/watcher 'change' 이벤트 (단일 .md 파일)
  → handleEvents() → (50ms debounce) → applyEvents()   [fast — change 이벤트는 skip]
  → pushNoteChanged(workspaceId, [changedRelPaths])
  → 렌더러: note:changed 수신
      → invalidateQueries(['note', 'workspace', workspaceId])
      → note:readByWorkspace IPC 재호출
          → noteService.readByWorkspace()
               └─ readMdFilesRecursive()   ← fs.readdirSync() 재귀, 수천 회!
```

**핵심**: `noteService.readByWorkspace`는 매 호출마다 전체 워크스페이스를 동기 fs 스캔한다.
파일 내용이 단 한 번 수정되어도 수천 개 디렉토리를 전부 읽는다.
`folder` 패턴("DB only IPC, 백그라운드 sync")이 **note에는 적용되지 않은 상태**다.

---

## Issues Found (전체 목록)

### P0 — Freeze 직접 원인

| #    | 위치                                    | 문제                                                          |
| ---- | --------------------------------------- | ------------------------------------------------------------- |
| P0-1 | `folder.ts` `readDirRecursive`          | `fs.readdirSync` 동기 재귀 → 이벤트 루프 블로킹               |
| P0-2 | `note.ts` `noteService.readByWorkspace` | `readMdFilesRecursive` 동기 재귀 → 매 note:changed마다 블로킹 |

### P1 — noteReconciliation 도입 시 발생할 크래시

notes 테이블: 10 컬럼 (id, workspaceId, folderId, relativePath, title, description, preview, order, createdAt, updatedAt)

| #    | 위치                           | 문제                              | 한계                                       |
| ---- | ------------------------------ | --------------------------------- | ------------------------------------------ |
| P1-1 | `noteRepository.createMany`    | 청킹 없음 — 단일 INSERT           | 100행 이상 = 10×100=1000 > 999 → **crash** |
| P1-2 | `noteRepository.deleteOrphans` | `NOT IN (paths)` — 변수 수 무제한 | 1000개 이상 → **crash**                    |

```typescript
// 현재 문제 코드
createMany(items: NoteInsert[]): void {
  if (items.length === 0) return
  db.insert(notes).values(items).onConflictDoNothing().run()  // 청킹 없음!
}

deleteOrphans(workspaceId: string, existingPaths: string[]): void {
  db.delete(notes)
    .where(and(..., not(inArray(notes.relativePath, existingPaths))))  // NOT IN!
    .run()
}
```

### P2 — readByWorkspaceFromDb 교체 시 실시간 동기화 regression

`applyEvents`의 현재 MD 처리 범위:

- Step 3: delete+create 쌍 → rename/move 감지 (ID 보존) ✓
- **standalone create (외부에서 새 파일 생성) → DB 미처리** ✗
- **standalone delete (외부에서 파일 삭제) → DB 미처리** ✗

현재 구조에서는 `note:changed` → `readByWorkspace()` (fs 스캔) 가 이 역할을 대신한다.
`readByWorkspaceFromDb()`로 교체하면 **외부에서 새 MD 파일을 생성/삭제해도
렌더러에 반영되지 않는 regression**이 발생한다.

### P3 — handleEvents 이벤트 유실 버그

```typescript
private handleEvents(workspaceId, workspacePath, events): void {
  if (this.debounceTimer) clearTimeout(this.debounceTimer)
  this.debounceTimer = setTimeout(async () => {
    await this.applyEvents(workspaceId, workspacePath, events)  // 클로저 캡처
    ...
  }, 50)
}
```

50ms 내에 watcher 콜백이 두 번 이상 호출되면:

- 타이머는 reset되지만 이전 `events` 배열은 버려짐
- 첫 번째 배치 이벤트 유실 → 폴더/파일 변경이 DB에 미반영될 수 있음

---

## Fix Design

### 원칙 — folder 패턴을 note에도 완전 적용

| 역할              | folder (완료)                            | note (이번 수정)                                   |
| ----------------- | ---------------------------------------- | -------------------------------------------------- |
| IPC 핸들러        | `readTreeFromDb` — DB만                  | `readByWorkspaceFromDb` — DB만                     |
| 앱 시작 시 초기화 | `fullReconciliation` — background, async | `noteReconciliation` — background, async           |
| 실시간 sync       | `applyEvents` (folder only)              | `applyEvents` + note standalone create/delete 추가 |
| 완료 신호         | `pushFolderChanged`                      | `pushNoteChanged(workspaceId, [])`                 |

---

### Fix 1 — `readByWorkspaceFromDb` 추가 (P0-2 해소)

**파일**: `src/main/services/note.ts`

fs 스캔 없이 DB rows만 반환. `readTreeFromDb` 와 동일 패턴:

```typescript
readByWorkspaceFromDb(workspaceId: string): NoteNode[] {
  const workspace = workspaceRepository.findById(workspaceId)
  if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)
  return noteRepository.findByWorkspaceId(workspaceId).map(toNoteNode)
}
```

기존 `readByWorkspace`는 테스트용으로 유지 (IPC에서는 더 이상 사용 안 함).

---

### Fix 2 — `note:readByWorkspace` IPC 교체

**파일**: `src/main/ipc/note.ts`

```typescript
// Before
handle(() => noteService.readByWorkspace(workspaceId))

// After
handle(() => noteService.readByWorkspaceFromDb(workspaceId))
```

---

### Fix 3 — `applyEvents`에 standalone MD create/delete 처리 추가 (P2 해소)

**파일**: `src/main/services/workspace-watcher.ts`

Step 3 (rename/move 감지) 에 `pairedMdCreatePaths` 추적을 추가하고,
Step 4, 5를 신규 추가:

```typescript
// Step 3 수정: pairedMdCreatePaths 추가
const pairedMdCreatePaths = new Set<string>()
const pairedMdDeletePaths = new Set<string>()
for (const createEvent of mdCreates) {
  ...
  if (matchingDelete) {
    ...
    pairedMdDeletePaths.add(matchingDelete.path)
    pairedMdCreatePaths.add(createEvent.path)  // ← 신규
  }
}

// Step 4 (신규): standalone MD create → DB에 note 추가
for (const createEvent of mdCreates) {
  if (pairedMdCreatePaths.has(createEvent.path)) continue
  const rel = path.relative(workspacePath, createEvent.path).replace(/\\/g, '/')
  const existing = noteRepository.findByRelativePath(workspaceId, rel)
  if (!existing) {
    const parentRel = rel.includes('/') ? rel.split('/').slice(0, -1).join('/') : null
    const folder = parentRel ? folderRepository.findByRelativePath(workspaceId, parentRel) : null
    const now = new Date()
    noteRepository.create({
      id: nanoid(), workspaceId,
      relativePath: rel,
      folderId: folder?.id ?? null,
      title: path.basename(createEvent.path, '.md'),
      description: '', preview: '', order: 0,
      createdAt: now, updatedAt: now
    })
  }
}

// Step 5 (신규): standalone MD delete → DB에서 note 삭제
for (const deleteEvent of mdDeletes) {
  if (pairedMdDeletePaths.has(deleteEvent.path)) continue
  const rel = path.relative(workspacePath, deleteEvent.path).replace(/\\/g, '/')
  const existing = noteRepository.findByRelativePath(workspaceId, rel)
  if (existing) noteRepository.delete(existing.id)
}
```

---

### Fix 4 — `noteReconciliation` 백그라운드 추가 (P0-1 부분 해소)

**파일**: `src/main/services/workspace-watcher.ts`

`start()` 내에서 folder reconciliation 후 note reconciliation도 background 수행.
async readdir 사용 (Fix 6과 연계):

```typescript
private async noteReconciliation(workspaceId: string, workspacePath: string): Promise<void> {
  const fsEntries = await readMdFilesRecursiveAsync(workspacePath, '')
  const fsPaths = fsEntries.map((e) => e.relativePath)

  const dbNotes = noteRepository.findByWorkspaceId(workspaceId)
  const dbPathSet = new Set(dbNotes.map((n) => n.relativePath))

  const now = new Date()
  const toInsert: NoteInsert[] = fsEntries
    .filter((e) => !dbPathSet.has(e.relativePath))
    .map((e) => {
      const parentRel = e.relativePath.includes('/')
        ? e.relativePath.split('/').slice(0, -1).join('/') : null
      const folder = parentRel ? folderRepository.findByRelativePath(workspaceId, parentRel) : null
      return {
        id: nanoid(), workspaceId, relativePath: e.relativePath,
        folderId: folder?.id ?? null,
        title: e.name.replace(/\.md$/, ''),
        description: '', preview: '', order: 0,
        createdAt: now, updatedAt: now
      }
    })

  noteRepository.createMany(toInsert)         // Fix 5 적용 후 안전
  noteRepository.deleteOrphans(workspaceId, fsPaths)  // Fix 5 적용 후 안전
}

// start() 수정
async start(workspaceId: string, workspacePath: string): Promise<void> {
  await this.syncOfflineChanges(workspaceId, workspacePath)   // folder
  await this.noteReconciliation(workspaceId, workspacePath)   // note (신규)
  this.pushFolderChanged(workspaceId)
  this.pushNoteChanged(workspaceId, [])  // note list re-fetch 신호 (빈 배열)
  // watcher subscribe ...
}
```

---

### Fix 5 — `noteRepository` 크래시 수정 (P1 해소)

**파일**: `src/main/repositories/note.ts`

#### createMany — 청킹 추가 (folder 패턴 적용)

notes: 10 컬럼 → CHUNK = 99 (10×99 = 990 < 999)

```typescript
createMany(items: NoteInsert[]): void {
  if (items.length === 0) return
  const CHUNK = 99  // 10 cols × 99 = 990 < 999
  db.$client.transaction(() => {
    for (let i = 0; i < items.length; i += CHUNK) {
      db.insert(notes).values(items.slice(i, i + CHUNK)).onConflictDoNothing().run()
    }
  })()
}
```

#### deleteOrphans — JS-side diff + chunked delete (folder 패턴 적용)

```typescript
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
  const orphanIds = dbRows.filter((r) => !existingSet.has(r.relativePath)).map((r) => r.id)
  if (orphanIds.length === 0) return
  const CHUNK = 900
  for (let i = 0; i < orphanIds.length; i += CHUNK) {
    db.delete(notes).where(inArray(notes.id, orphanIds.slice(i, i + CHUNK))).run()
  }
}
```

---

### Fix 6 — `readDirRecursive` / `readMdFilesRecursive` 비동기화 (P0-1 완전 해소)

**파일**: `src/main/services/folder.ts`, `src/main/lib/fs-utils.ts`

`fs.readdirSync` → `fs.promises.readdir`. 비동기 버전을 watcher에서 사용:

```typescript
// fs-utils.ts에 추가
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
    if (entry.isSymbolicLink() || entry.name.startsWith('.')) continue
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

동일 패턴으로 `readDirRecursiveAsync` (폴더용) 도 `folder.ts`에 추가.
`fullReconciliation` 및 `noteReconciliation` 에서 async 버전 사용.
기존 sync 버전은 테스트 호환성을 위해 유지.

---

### Fix 7 — `handleEvents` 이벤트 누적 버그 수정 (P3 해소)

**파일**: `src/main/services/workspace-watcher.ts`

```typescript
// 클래스 멤버 추가
private pendingEvents: parcelWatcher.Event[] = []

private handleEvents(workspaceId, workspacePath, events): void {
  this.pendingEvents.push(...events)         // 누적
  if (this.debounceTimer) clearTimeout(this.debounceTimer)
  this.debounceTimer = setTimeout(async () => {
    const eventsToProcess = this.pendingEvents.splice(0)  // 전부 꺼내기
    await this.applyEvents(workspaceId, workspacePath, eventsToProcess)
    this.pushFolderChanged(workspaceId)
    const changedRelPaths = eventsToProcess
      .filter((e) => e.path.endsWith('.md') && !path.basename(e.path).startsWith('.'))
      .map((e) => path.relative(workspacePath, e.path).replace(/\\/g, '/'))
    this.pushNoteChanged(workspaceId, changedRelPaths)
  }, 50)
}
```

`stop()` 호출 시 `pendingEvents` 초기화 추가:

```typescript
async stop(): Promise<void> {
  this.pendingEvents = []  // ← 추가
  ...
}
```

---

## 실행 흐름 (Fix 후)

### Freeze #1 해소 — 워크스페이스 진입

```
folder:readTree IPC
  ├─ void ensureWatching()       ← background 시작
  └─ readTreeFromDb()            ← DB만, 즉시 응답 (수 ms)

note:readByWorkspace IPC
  └─ readByWorkspaceFromDb()     ← DB만, 즉시 응답 (수 ms) ★ Fix 1,2

[렌더러: 현재 DB 상태 즉시 표시]

[background: watcher start()]
  syncOfflineChanges → fullReconciliation → readDirRecursiveAsync    ★ Fix 6
  noteReconciliation → readMdFilesRecursiveAsync                     ★ Fix 4,6
  → pushFolderChanged + pushNoteChanged(workspaceId, [])

[렌더러: folder:changed + note:changed 수신 → re-fetch → 최신 상태 반영]
```

### Freeze #2 해소 — MD 파일 내용 수정

```
@parcel/watcher 'change' 이벤트
  pendingEvents.push(event)                  ★ Fix 7
  applyEvents() — change 이벤트는 Skip (fast)
  pushNoteChanged(workspaceId, [changedPath])

렌더러: note:changed 수신
  invalidateQueries(['note', 'workspace'])
  → note:readByWorkspace IPC
      → readByWorkspaceFromDb()   ← DB만, fast  ★ Fix 1,2
  refetchQueries(['note', 'content', n.id])   ← 단일 파일 read, fast
```

### 외부 MD 파일 생성/삭제 — Regression 없음

```
@parcel/watcher 'create' / 'delete' 이벤트
  applyEvents() Step 4/5: DB에 note 추가/삭제   ★ Fix 3
  pushNoteChanged(workspaceId, [path])

렌더러: invalidate → readByWorkspaceFromDb() → DB에 반영된 최신 목록 반환
```

---

## 변경 파일 목록 (7개)

| 파일                                     | Fix # | 변경 내용                                        |
| ---------------------------------------- | ----- | ------------------------------------------------ |
| `src/main/services/note.ts`              | 1     | `readByWorkspaceFromDb()` 추가                   |
| `src/main/ipc/note.ts`                   | 2     | `readByWorkspace` → `readByWorkspaceFromDb`      |
| `src/main/services/workspace-watcher.ts` | 3,4,7 | Step 4/5, `noteReconciliation`, 이벤트 누적 수정 |
| `src/main/repositories/note.ts`          | 5     | `createMany` 청킹, `deleteOrphans` JS-side diff  |
| `src/main/lib/fs-utils.ts`               | 6     | `readMdFilesRecursiveAsync` 추가                 |
| `src/main/services/folder.ts`            | 6     | `readDirRecursiveAsync` 추가                     |

> preload / renderer 변경 없음 — `note:changed(workspaceId, [])` 는 기존 preload API로 처리 가능

---

## UX

| 상황                       | 변경 전           | 변경 후                                 |
| -------------------------- | ----------------- | --------------------------------------- |
| 워크스페이스 진입 (최초)   | 5초 freeze → 표시 | 즉시 DB 상태 표시 → 수초 후 자동 갱신   |
| 워크스페이스 진입 (재진입) | 5초 freeze        | 즉시 DB 상태 표시 (snapshot diff, fast) |
| MD 파일 내용 수정          | 5초 freeze        | 즉시 응답 (DB only)                     |
| 외부에서 MD 파일 신규 생성 | 동기화됨 (느리게) | 동기화됨 (Step 4로 즉시 DB 반영)        |
| 외부에서 MD 파일 삭제      | 동기화됨 (느리게) | 동기화됨 (Step 5로 즉시 DB 반영)        |
| 빠른 파일 변경 (50ms 내)   | 이벤트 유실 가능  | 누적 처리, 유실 없음 ★ Fix 7            |

---

## Acceptance Criteria

- [ ] 수천 개 폴더 워크스페이스 진입 시 `folder:readTree` IPC 응답 < 500ms
- [ ] 수천 개 폴더 워크스페이스 진입 시 `note:readByWorkspace` IPC 응답 < 500ms
- [ ] 진입 후 폴더 트리 + 노트 목록이 background sync 완료 후 자동 갱신
- [ ] MD 파일 내용 수정 후 5초 freeze 없음
- [ ] 외부에서 MD 파일 생성 → 렌더러에 즉시 반영
- [ ] 외부에서 MD 파일 삭제 → 렌더러에 즉시 반영
- [ ] 100개 초과 note insert 크래시 없음 (Fix 5)
- [ ] 1000개 초과 note deleteOrphans 크래시 없음 (Fix 5)
- [ ] 기존 folder / note 서비스 테스트 전체 통과
- [ ] `UnhandledPromiseRejection` 없음

---

## Out of Scope

- node_modules 등 특정 디렉토리 자동 제외 (watcher ignore 옵션)
- `@parcel/watcher.getEventsSince` 성능 문제 (native 레이어, 별도 이슈)
- 폴더 `createMany` transaction wrap 성능 최적화 (별도 이슈)
- note `preview` 자동 갱신 최적화
