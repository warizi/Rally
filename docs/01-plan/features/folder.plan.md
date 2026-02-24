# Folder Feature Plan

## Overview

Rally 앱에 폴더 기능을 추가한다.
**파일시스템이 source of truth**이고, SQLite는 각 폴더의 메타데이터(color, order)와 DB 관계(todo, note 링크)를 위한 stable identity를 저장한다.

사이드바 "파일 탐색기" 탭을 클릭하면 현재 워크스페이스의 `path` 디렉토리를 실제로 읽어 `react-arborist` 트리로 렌더링한다.

## 아키텍처 원칙

```
파일시스템 (workspace.path)      → 실제 폴더 트리 (구조 / 이름)
SQLite (folders 테이블)          → DB 관계용 stable id + 메타데이터 (color, order)
@parcel/watcher (네이티브 Watch) → 외부 변경 감지 (rename 이벤트 포함) → renderer push
```

### 이중 식별자 전략

| 필드 | 역할 | 안정성 |
|------|------|--------|
| `id` (nanoid) | DB 관계용 stable identifier | 항상 불변 |
| `relativePath` | 파일시스템 위치 | rename/move 시 변경됨 |

```
todos.folderId  → folders.id  ← relativePath가 바뀌어도 링크 유지
notes.folderId  → folders.id  ← 동일
```

- 앱 내 rename/move → `relativePath` + 하위 전체 일괄 업데이트 (LIKE prefix 벌크)
- 외부 rename → `@parcel/watcher`가 `{ type: 'rename', oldPath, path }` 이벤트 제공
  → DB relativePath 벌크 업데이트 → 메타데이터 + todo·note 링크 완전 유지
- 워크스페이스 이동 → `relativePath`는 상대경로이므로 영향 없음
- 볼륨 간 이동 (copy+delete) → rename 이벤트 없음 → 메타데이터 초기화 (감수)

## 데이터 스키마

SQLite `folders` 테이블:

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | text (PK) | nanoid — DB 관계 전용 stable key |
| `workspaceId` | text NOT NULL | `workspaces.id` 참조 (onDelete: cascade) |
| `relativePath` | text NOT NULL | 워크스페이스 루트 기준 상대경로 (`"a/b/c"`) |
| `color` | text NULL | 폴더 색상 |
| `order` | integer NOT NULL DEFAULT 0 | 같은 부모 내 정렬 순서 |
| `createdAt` | integer (timestamp_ms) | |
| `updatedAt` | integer (timestamp_ms) | |

- unique constraint: `(workspaceId, relativePath)`
- `relativePath`는 항상 `/` 구분자로 정규화해서 저장 (Windows `\` 변환 포함)

### order 관리 전략

**integer reindex** 방식 사용.

```
같은 부모 내 형제 폴더 이동/삽입 시 siblings 전체 order 재할당:
  [a, b, c, d] → b를 맨 앞으로 → [b(0), a(1), c(2), d(3)]
```

- 형제 폴더 수가 보통 적어 reindex 비용 낮음
- fractional indexing 대비 부동소수점 정밀도 문제 없음
- 순서 변경 시 siblings 전체 UPDATE를 단일 transaction으로 처리

## IPC 인터페이스

### 읽기
```
window.api.folder.readTree(workspaceId)
  → FolderNode[]  // fs 트리 + DB 메타데이터 merge
```

### 파일시스템 조작 (disk I/O + DB 동기화)
```
window.api.folder.create(workspaceId, parentFolderId | null, name)
  → FolderNode
  // parentFolderId null → 루트에 생성

window.api.folder.rename(workspaceId, folderId, newName)
  → FolderNode
  // id → relativePath 변환 → fs.rename + DB 벌크 업데이트

window.api.folder.remove(workspaceId, folderId)
  → void
  // id → relativePath 변환 → fs.rm(recursive) + DB 벌크 삭제

window.api.folder.move(workspaceId, folderId, parentFolderId | null, index)
  → FolderNode
  // id → relativePath 변환 → fs.rename + DB 벌크 업데이트
  // siblings reindex (integer 재할당)
```

### 메타데이터 전용
```
window.api.folder.updateMeta(workspaceId, folderId, { color?, order? })
  → FolderNode
```

### Push 구독 등록
```
window.api.folder.onChanged(callback: (workspaceId: string) => void)
  → unsubscribe 함수 반환
```

### Push 이벤트 (Main → Renderer)
```
'folder:changed' (workspaceId)
  // @parcel/watcher 감지 → DB 동기화 완료 후 → renderer에서 readTree 재요청
```

### Push 이벤트 → React Query 연결 패턴

`MainLayout`에서 `useFolderWatcher` hook을 통해 구독:

```typescript
// src/renderer/src/app/layout/MainLayout.tsx
useFolderWatcher()  // push 이벤트 구독 + React Query invalidation

// src/renderer/src/entities/folder/model/use-folder-watcher.ts
function useFolderWatcher() {
  const queryClient = useQueryClient()
  useEffect(() => {
    const unsub = window.api.folder.onChanged((workspaceId) => {
      queryClient.invalidateQueries({ queryKey: ['folder', 'tree', workspaceId] })
    })
    return unsub
  }, [queryClient])
}
```

## 앱 오프라인 중 변경사항 처리

### snapshot 기반 offline 동기화

`@parcel/watcher`의 `writeSnapshot` / `getEventsSince` API를 사용한다.

```
앱 종료 직전:
  watcher.writeSnapshot(workspacePath, snapshotFilePath)
  → OS별 현재 시점 저장:
    macOS  → 현재 FSEvents event ID
    Windows → 현재 NTFS USN (Update Sequence Number)
    Linux  → 현재 디렉토리 상태 (path + inode 목록)

앱 꺼진 동안:
  macOS  → Apple 커널이 FSEvents journal에 이벤트 영구 기록
  Windows → NTFS가 USN journal에 모든 변경 기록
  Linux  → 기록 없음 (재시작 시 inode 비교로 보완)

앱 재시작 시:
  events = await watcher.getEventsSince(workspacePath, snapshotFilePath)
  → macOS/Windows: journal에서 그동안의 이벤트 정확히 재현
  → Linux: snapshot inode vs 현재 inode 비교로 rename 추론

  events 처리:
    rename → DB relativePath 벌크 업데이트 → 메타데이터 + 링크 유지 ✅
    create → DB upsert (기본 메타데이터)
    delete → DB 해당 row 삭제

  처리 완료 후 새 snapshot 저장 + 실시간 watcher 시작
```

### snapshot 파일 위치

```
{app.getPath('userData')}/snapshots/{workspaceId}.snapshot
```

워크스페이스별로 독립적인 snapshot 파일 관리.

### 첫 실행 / snapshot 없음 / crash 후 fallback

```
snapshot 파일 없음 (첫 등록 or crash)
→ getEventsSince 스킵
→ fs 전체 읽기 vs DB 비교 (full reconciliation)
    fs에 있고 DB에 없음 → DB upsert (기본 메타데이터)
    DB에 있고 fs에 없음 → DB row 삭제 (orphan 제거)
→ 새 snapshot 생성 후 watcher 시작
```

### 워크스페이스 전환 시 watcher 재시작

```
워크스페이스 A → B 전환 시:
  1. A watcher 종료 + A snapshot 저장
  2. B: snapshot 있으면 getEventsSince → offline 동기화
         없으면 full reconciliation
  3. B watcher 시작
```

### workspace.path 접근 불가 처리

```
workspace.path가 없거나 접근 불가 (삭제됨 / 외장하드 미연결 / 권한 없음)
→ readTree: IpcError 반환, renderer에서 "경로에 접근할 수 없음" 표시
→ watcher 시작: try-catch로 감싸고 실패 시 watcher 없이 fallback
→ 앱 crash 방지
```

### Symbolic link 무한 루프 방지

```
fs.readdir(path, { withFileTypes: true })
→ entry.isSymbolicLink() → 재귀 탐색 제외
→ entry.isDirectory() → 재귀 탐색 진행
```

### workspace.path 자체 변경 시 watcher 재시작

```
workspaces 테이블 path 업데이트 발생
→ 기존 watcher 종료 + old path snapshot 저장
→ new path로 watcher 재시작 (snapshot 없으니 full reconciliation)
```

### 연속 이벤트 debounce

```
상위 폴더 rename → 하위 수백 개 이벤트 동시 발생
→ watcher 이벤트 수신 후 50~100ms debounce
→ 배치로 DB 업데이트 + renderer push 1회
```

### DB 트랜잭션 원자성

bulk rename/delete 시 SQLite transaction으로 감싸 중간 실패 시 rollback:

```
BEGIN TRANSACTION
  UPDATE folders SET relativePath = ... WHERE relativePath LIKE 'a/%' OR relativePath = 'a'
COMMIT  ← 전체 성공
ROLLBACK ← 하나라도 실패 시 전체 취소
```

fs 작업(fs.rename)과 DB 작업이 순서상 분리되므로:
- fs 성공 → DB transaction 실패 → fs는 이미 변경됨 (감수, 재시작 시 reconciliation으로 복구)
- fs 실패 → DB transaction 시작 안 함

### getEventsSince 실패 시 fallback (journal 만료)

macOS FSEvents / Windows USN journal 모두 크기·기간 제한 존재.
앱이 오랜 기간 꺼져 있었거나 journal이 purge된 경우 `getEventsSince` throws.

```
try {
  events = await watcher.getEventsSince(workspacePath, snapshotFilePath)
} catch {
  // journal 만료 → full reconciliation으로 fallback
  await fullReconciliation(workspaceId, workspacePath)
}
```

### 숨김 폴더 필터링

`.`으로 시작하는 폴더는 기본적으로 트리에서 제외한다.

```
readdir 결과에서: entry.name.startsWith('.') → 제외
예: .git, .DS_Store, .obsidian, .rally 등
```

### watcher 파일 이벤트 필터링

`@parcel/watcher`는 파일 변경 이벤트도 함께 수신한다.
폴더 이벤트만 처리하도록 필터링한다.

```
watcher 이벤트 수신
→ create/rename: fs.stat(path).isDirectory() === false → 무시
→ delete: DB에서 해당 path row 존재 여부로 폴더 판단
```

### DB row 없는 폴더 접근 처리 (lazy insert)

`FolderNode.id`는 DB row가 없으면 `relativePath`를 임시 id로 사용한다.
IPC 호출 시 서비스 레이어에서 id가 실제 nanoid인지 판별이 불가하므로,
**readTree 시 모든 폴더를 DB에 upsert (lazy insert)** 한다.

```
readTree 실행
→ fs에서 읽은 모든 폴더를 DB에 upsert
    이미 있으면 → 그대로 (relativePath 기준)
    없으면 → nanoid 발급 + 기본 메타데이터로 insert
→ 이후 모든 FolderNode.id는 항상 nanoid 보장
→ IPC folderId 입력이 항상 유효한 DB id
```

### 자기 자신의 하위로 move 차단

```
move(folderId, parentFolderId)
→ 서비스에서:
    folderPath   = id로 relativePath 조회 ("a")
    parentPath   = parentFolderId로 relativePath 조회 ("a/b")
    parentPath.startsWith(folderPath + '/') → true
    → IpcError('순환 이동 불가')
```

react-arborist UI 레벨에서 막더라도 서비스에서 이중 차단.

### 폴더 삭제 확인 다이얼로그

재귀 삭제 위험성으로 인해 renderer에서 확인 다이얼로그 필수:

```
사용자가 삭제 선택
→ "폴더와 하위 항목이 모두 삭제됩니다. 계속하시겠습니까?" 다이얼로그
→ 확인 → folder.remove IPC 호출
→ 취소 → 아무것도 하지 않음
```

### 폴더 이름 충돌 처리

같은 부모에 동일한 이름의 폴더가 이미 존재하면 `(N)` suffix를 붙인다.

```
create/rename 시 target 이름 충돌 감지:
  "c" 존재 → "c (1)" 시도
  "c (1)" 존재 → "c (2)" 시도
  ... 빈 이름을 찾을 때까지 반복
```

서비스 레이어에서 `fs.access`로 존재 여부 확인 후 이름 결정, 최종 이름으로 fs + DB 작업.

### 앱 내 IPC 작업과 watcher 이벤트 중복 처리

앱에서 rename/create/delete를 수행하면 watcher도 동일한 이벤트를 받는다.
DB 업데이트는 **멱등성(idempotent)** 으로 구현하여 중복 처리를 무시한다.

```
IPC rename → DB relativePath 업데이트 (A → B)
watcher rename 이벤트 수신 → DB에서 A 조회 → 이미 B로 변경됨 → no-op
```

구체적으로: DB upsert / update 시 현재 값과 동일하면 updatedAt만 갱신하거나 스킵.

## 렌더러 데이터 타입

```typescript
interface FolderNode {
  id: string              // DB id (없으면 relativePath를 임시 id로 사용) — react-arborist node id로 사용
  name: string            // 마지막 path segment
  relativePath: string    // 워크스페이스 기준 상대경로 (항상 '/' 구분자)
  color: string | null
  order: number
  children: FolderNode[]
}
```

### react-arborist 콜백 ↔ IPC 매핑

react-arborist의 DnD 콜백은 `FolderNode.id` (nanoid) 기준으로 동작한다.

```typescript
// Tree 컴포넌트 콜백
onMove: ({ dragIds, parentId, index }) => {
  // dragIds[0] → folders.id (nanoid)
  // parentId   → 부모 folders.id (nanoid) — null이면 루트
  // index      → 새 위치 (siblings reindex에 사용)
  folder.move(workspaceId, dragId, parentId, index)
}

onRename: ({ id, name }) => {
  // id → folders.id
  folder.rename(workspaceId, id, name)
}

onCreate: ({ parentId, index, type }) => {
  // parentId → 부모 folders.id
  folder.create(workspaceId, parentId, '새 폴더')
}
```

IPC 인터페이스 입력을 `relativePath` 대신 `id` (nanoid) 기반으로 변경:

```
window.api.folder.rename(workspaceId, folderId, newName)
window.api.folder.remove(workspaceId, folderId)
window.api.folder.move(workspaceId, folderId, parentFolderId | null, index)
window.api.folder.updateMeta(workspaceId, folderId, { color?, order? })
```

서비스 레이어에서 `id → relativePath` 변환 후 fs 작업.

## 외부 변경 처리 시나리오

### 외부 rename (완전히 처리)
```
Finder에서 "a" → "a2" rename
→ @parcel/watcher: { type: 'rename', oldPath: 'a', path: 'a2' }
→ DB: relativePath "a" → "a2" 벌크 업데이트 (하위 전체 포함)
→ 메타데이터(color, order) 유지 ✅
→ todos/notes folderId 링크 유지 ✅
→ renderer: 'folder:changed' push → 트리 새로고침
```

### 외부 create / delete (처리)
```
→ @parcel/watcher: { type: 'create' | 'delete', path }
→ create: 트리 새로고침 (메타데이터 없이 기본값으로 표시)
→ delete: DB 해당 row 삭제 + 트리 새로고침
```

### 볼륨 간 이동 (감수)
```
외장하드 등 다른 볼륨으로 이동 = copy + delete
→ rename 이벤트 없음 → 메타데이터 초기화
→ 워크스페이스 시나리오에서 실질적으로 발생하지 않음
```

## Implementation Scope

### Main Process
1. `src/main/db/schema/folder.ts` — Drizzle 스키마
2. `src/main/db/schema/index.ts` — export 추가
3. DB migration
4. `src/main/repositories/folder.ts` — 메타데이터 CRUD (bulk prefix update 포함)
5. `src/main/services/folder.ts` — fs I/O + DB merge + bulk 업데이트 로직
   - path normalize: `path.replace(/\\/g, '/')` (Windows `\` → `/`)
   - symlink 제외: `withFileTypes: true` + `isSymbolicLink()` 체크
   - 숨김 폴더 제외: `name.startsWith('.')` 필터
   - 이름 충돌: `(N)` suffix 자동 부여 (`fs.access`로 존재 확인)
   - bulk rename/delete: SQLite transaction 래핑
   - workspace.path 접근 불가 시 에러 반환 (crash 방지)
   - readTree 시 전체 폴더 lazy upsert → FolderNode.id 항상 nanoid 보장
   - move 시 순환 참조 사전 체크 (`parentPath.startsWith(folderPath + '/')`) → IpcError
6. `src/main/services/folder-watcher.ts` — @parcel/watcher 인스턴스 관리
   - 앱 시작: getEventsSince 시도 → 실패 시 full reconciliation fallback
   - snapshot 없음: full reconciliation
   - 실시간: subscribe() → 폴더 이벤트만 필터 → debounce(50ms) → 배치 DB 동기화 + push 1회
   - 앱 종료: writeSnapshot()
   - 워크스페이스 전환: 기존 watcher 종료 + snapshot 저장 → 새 watcher 시작
   - workspace.path 변경 감지: watcher 재시작
7. `src/main/ipc/folder.ts` — IPC 핸들러 + 'folder:changed' push
8. `src/main/index.ts` — IPC 등록 + app 종료 시 writeSnapshot 훅

### Preload
9. `src/preload/index.d.ts` — folder IPC 타입 추가

### Renderer
10. `src/renderer/src/entities/folder/` — FolderNode 타입, React Query hooks
11. `src/renderer/src/features/folder/manage-folder/` — mutations + FolderTree 컴포넌트
12. `src/renderer/src/pages/folder/ui/FolderPage.tsx` — 트리 통합

## Dependencies
- `@parcel/watcher` — 설치 필요 (`npm install @parcel/watcher`)
  - macOS: FSEvents / Windows: ReadDirectoryChangesW / Linux: inotify
  - rename 이벤트를 네이티브 수준에서 감지 (VS Code 동일 사용)
  - **Native addon → Electron rebuild 필요**
    - `electron-rebuild` 또는 `electron-builder` extraMetadata 설정
    - `package.json`의 `build.nativeRebuilder` 또는 postinstall 스크립트 추가
- `react-arborist` — 이미 설치됨
- Node.js `fs/promises`
- `workspaces.path` — 워크스페이스 루트 경로
- `useCurrentWorkspaceStore`

## Future Links (Out of Scope, 설계 고려)
- `todos.folderId TEXT REFERENCES folders(id)` — 추후 추가
- `notes.folderId TEXT REFERENCES folders(id)` — 추후 추가

## Success Criteria
- [ ] 워크스페이스 path의 실제 폴더 트리가 UI에 표시됨
- [ ] 생성/이름변경/삭제/이동이 실제 디스크에 반영됨
- [ ] 앱 내 rename/move 시 메타데이터 + 하위 폴더 DB 일괄 업데이트
- [ ] 앱 실행 중 외부 rename → 메타데이터 + 링크 완전 유지 (실시간 watch)
- [ ] 앱 오프라인 중 외부 rename → 재시작 시 snapshot으로 복원, 메타데이터 + 링크 유지
- [ ] 외부 create/delete → 트리 자동 새로고침 (실시간 + 재시작 모두)
- [ ] crash / 첫 실행 시 snapshot 없어도 full reconciliation으로 정상 동작
- [ ] 워크스페이스 전환 시 watcher 정상 교체
- [ ] IPC + watcher 중복 이벤트 멱등성 처리 (이중 DB 업데이트 없음)
- [ ] Windows `\` → `/` path 정규화
- [ ] react-arborist id null 없이 동작 (relativePath 임시 id 사용)
- [ ] todo/note가 `folders.id`로 링크 가능한 구조
- [ ] workspace.path 접근 불가 시 앱 crash 없이 에러 표시
- [ ] symlink 폴더 재귀 무한 루프 없음
- [ ] workspace.path 변경 시 watcher 정상 재시작
- [ ] 연속 이벤트 debounce (불필요한 DB 업데이트 / renderer push 없음)
- [ ] @parcel/watcher Electron rebuild 정상 동작
- [ ] bulk 작업 중 실패 시 DB rollback (데이터 손상 없음)
- [ ] journal 만료 시 getEventsSince 실패 → full reconciliation fallback
- [ ] 숨김 폴더(`.` 시작) 트리에서 제외
- [ ] watcher 파일 이벤트 필터링 (폴더만 처리)
- [ ] 이름 충돌 시 `(N)` suffix 자동 부여
- [ ] DnD 이동 시 siblings integer reindex 정상 동작
- [ ] react-arborist 콜백이 folderId 기반으로 IPC 호출
- [ ] 'folder:changed' push → MainLayout hook → React Query invalidation
- [ ] readTree 시 lazy upsert로 FolderNode.id 항상 nanoid 보장
- [ ] move 시 자기 자신 하위로 이동 차단 (순환 참조 IpcError)
- [ ] 삭제 전 확인 다이얼로그 표시
- [ ] TypeScript 컴파일 에러 없음
