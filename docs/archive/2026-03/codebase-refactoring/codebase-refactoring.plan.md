# Codebase Refactoring Plan (v3 - Final Verified)

## Overview

- **Feature**: codebase-refactoring
- **Current Quality Score**: 58/100
- **Target Quality Score**: 85+/100
- **Primary Goal**: 중복 코드 제거, 비효율 코드 개선, 가독성 향상, 잠재적 버그 수정
- **핵심 원칙**: 사이드 이펙트 제로 — 모든 기존 동작을 100% 보존

## Problem Statement

파일 타입(note, csv, pdf, image) 추가 시 동일한 패턴의 코드가 15+ 파일에 복사-붙여넣기되어 약 **2,500줄 이상의 중복 코드**가 존재. 새로운 파일 타입 추가 시 유지보수 비용이 선형적으로 증가하며, 버그 수정 시 동일한 변경을 4곳에 반복해야 하는 상황.

---

## 발견된 버그 (리팩토링 전 우선 수정)

### BUG-1: Note own-write-tracker가 Set 사용 (timer 누수)

- **파일**: `src/renderer/src/entities/note/model/own-write-tracker.ts`
- **현상**: `Set<string>` 사용으로 rapid save 시 이전 setTimeout을 clear하지 않음
- **영향**: 빠르게 저장할 때 stale entry가 남아 외부 변경 알림이 무시될 수 있음
- **수정**: CSV/PDF/Image와 동일하게 `Map<string, ReturnType<typeof setTimeout>>` + `clearTimeout` 패턴으로 변경

### BUG-2: Note useRenameNote에 markAsOwnWrite 누락

- **파일**: `src/renderer/src/entities/note/api/queries.ts` (useRenameNote mutation)
- **현상**: CSV/PDF/Image의 rename mutation은 `onMutate`에서 `markAsOwnWrite(id)` 호출하지만, Note는 `markWorkspaceOwnWrite(workspaceId)`만 호출
- **영향**: 노트 이름 변경 시 파일시스템 변경 이벤트가 외부 변경으로 잘못 인식될 수 있음
- **수정**: `onMutate`에 `markAsOwnWrite(noteId)` 추가

### BUG-3: Note entity barrel export에 isOwnWrite 누락 (신규 발견)

- **파일**: `src/renderer/src/entities/note/index.ts`
- **현상**: CSV/PDF/Image entity는 barrel export에서 `isOwnWrite`를 export하지만, Note entity는 export하지 않음
- **영향**: 현재는 watcher hook이 직접 import하므로 동작에 영향 없으나, FSD 레이어 규칙 위반 가능성
- **수정**: barrel export에 `export { isOwnWrite } from './model/own-write-tracker'` 추가
- **사이드 이펙트**: 없음 (export 추가는 기존 동작에 영향 없음)

---

## Phase 1: Generic File Repository Factory (~520줄 제거)

### 현상
- 4개 repository가 12개 메서드 중 11개 동일 (테이블 참조만 다름)

### 상세 비교 매트릭스 (문자 수준 검증 완료)

| 메서드 | 동일 여부 | 비고 |
|--------|----------|------|
| findByWorkspaceId | 100% 동일 | `.select().from(table).where(eq(...)).all()` |
| findById | 100% 동일 | `.select().from(table).where(eq(...)).get()` |
| findByRelativePath | 100% 동일 | `.where(and(eq(...), eq(...))).get()` |
| findByIds | 100% 동일 | CHUNK=900, `inArray()` 패턴 |
| create | 100% 동일 | `.insert(table).values(data).returning().get()` |
| createMany | 100% 동일 | CHUNK=99, `onConflictDoNothing()` |
| delete | 100% 동일 | `.delete(table).where(eq(...)).run()` |
| deleteOrphans | 100% 동일 | Set 기반 orphan 필터링 + chunk 삭제 |
| bulkDeleteByPrefix | 100% 동일 | `like(table.relativePath, prefix+'/%')` |
| bulkUpdatePathPrefix | 구조 동일 | **Raw SQL에 테이블명 하드코딩** |
| reindexSiblings | 구조 동일 | **Raw SQL에 테이블명 하드코딩** |
| **update** | **다름** | **CSV만 `columnWidths` 필드 포함** |

### 사이드 이펙트 주의사항

1. **update() 시그니처 차이**: CSV는 `columnWidths` 필드를 허용
   - **대응**: `update()`는 팩토리에 포함하지 않고, 각 repository에 개별 유지
   - 팩토리는 `update()`를 제외한 11개 메서드만 생성

2. **Raw SQL 테이블명**: `bulkUpdatePathPrefix`, `reindexSiblings`는 Drizzle가 아닌 raw SQL 사용
   - **대응**: 팩토리 생성 시 `tableName: string` 파라미터를 받아 SQL 문자열에 삽입
   - SQL 패턴 검증됨: `UPDATE ${tableName} SET relative_path = ? || substr(relative_path, ?), updated_at = ? WHERE workspace_id = ? AND (relative_path = ? OR relative_path LIKE ?)`

3. **leaf-reindex.ts는 변경하지 않음**: `reindexLeafSiblings()`가 4개 repository의 `reindexSiblings()`를 호출하지 않고, 독자적으로 4개 prepared statement를 사용하여 단일 트랜잭션에서 처리
   - **대응**: leaf-reindex.ts의 코드는 그대로 유지. 팩토리 적용과 무관

4. **workspace-watcher.ts 비-트랜잭션 순차 호출**: 4개 repository의 `bulkDeleteByPrefix`/`bulkUpdatePathPrefix`가 트랜잭션 없이 순차 호출됨
   - **대응**: 팩토리가 자체 트랜잭션을 감싸지 않음. 현재 동작 그대로 보존

5. **entity-link.ts 연동**: workspace-watcher에서 파일 삭제 전 `entityLinkRepository.removeAllByEntity(type, id)` 호출
   - **대응**: 이는 watcher 로직이므로 repository 팩토리와 무관. 변경 없음

### 개선 방법
```typescript
// src/main/repositories/create-file-repository.ts
function createFileRepository<T extends FileTable>(table: T, tableName: string) {
  return {
    findByWorkspaceId(workspaceId: string) { ... },
    findById(id: string) { ... },
    // ... 11개 공통 메서드
  }
}

// src/main/repositories/note.ts
const base = createFileRepository(notes, 'notes')
export const noteRepository = {
  ...base,
  update(id: string, data: Partial<Pick<Note, 'relativePath' | 'title' | ...>>) { ... }
}
```

### 대상 파일
- `src/main/repositories/note.ts`
- `src/main/repositories/csv-file.ts`
- `src/main/repositories/pdf-file.ts`
- `src/main/repositories/image-file.ts`
- (신규) `src/main/repositories/create-file-repository.ts`

### 변경하지 않는 파일
- `src/main/lib/leaf-reindex.ts` (독자 SQL 사용, repository 호출하지 않음)

---

## Phase 2: Generic Recursive File Scanner (~200줄 제거)

### 현상
- `src/main/lib/fs-utils.ts`에 8개 함수 (sync 4 + async 4)
- 확장자 체크만 다르고 나머지 로직 동일

### 상세 차이점 (라인별 검증 완료)

| 함수 | 확장자 체크 방식 | 대소문자 | 비고 |
|------|----------------|---------|------|
| readMdFiles | `entry.name.endsWith('.md')` | 대소문자 구분 | |
| readCsvFiles | `entry.name.endsWith('.csv')` | 대소문자 구분 | |
| readPdfFiles | `entry.name.endsWith('.pdf')` | 대소문자 구분 | |
| readImageFiles | `isImageFile(entry.name)` | **대소문자 무시** (.toLowerCase()) | 7개 확장자 |

### Async 함수 배열 처리 불일치 (신규 발견)

```typescript
// Md async (line 71): push 패턴
for (const sub of subResults) result.push(...sub)
return result

// CSV/PDF/Image async (lines 132, 192, 259): concat 패턴
return result.concat(...subResults)
```
- **기능적으로 동일** (동일한 결과 배열 생성)
- **대응**: 제네릭 함수에서 하나로 통일 (concat 패턴 채택)

### 사이드 이펙트 주의사항

1. **Image 대소문자 처리**: `isImageFile()`만 `path.extname().toLowerCase()` 사용
   - **대응**: matcher 함수를 타입별로 받으므로, 기존 동작 그대로 유지됨
   - `.PNG`, `.JPG` 파일은 현재도 이미지로 인식됨 → 변경 없음

2. **기존 함수명 보존**: 모든 호출부(services 4개 + workspace-watcher 4개)가 기존 함수명 사용
   - **대응**: 기존 함수를 wrapper로 유지하여 호출부 변경 불필요

### 개선 방법
```typescript
// 내부 제네릭 함수 (export하지 않음)
function readFilesRecursive(absBase, parentRel, matcher): FileEntry[] { ... }
async function readFilesRecursiveAsync(absBase, parentRel, matcher): Promise<FileEntry[]> { ... }

// 기존 함수는 wrapper (호출부 변경 없음)
export const readMdFilesRecursive = (abs, rel) => readFilesRecursive(abs, rel, n => n.endsWith('.md'))
export const readMdFilesRecursiveAsync = (abs, rel) => readFilesRecursiveAsync(abs, rel, n => n.endsWith('.md'))
// ... 나머지 동일
```

### 대상 파일
- `src/main/lib/fs-utils.ts`

---

## Phase 3: Service 공통 유틸 추출 (MEDIUM - ~120줄 제거)

### 현상
- `normalizePath`, `parentRelPath` 유틸이 4개 서비스에 복사-붙여넣기 (8개 복사본)
- `toXxxNode` 매퍼가 4개 서비스에 중복 (CSV만 `columnWidths` 추가 필드)

### normalizePath / parentRelPath 검증 결과
- **4개 파일 모두 문자 수준으로 동일** 확인 완료
- `normalizePath`: `p.replace(/\\/g, '/')`
- `parentRelPath`: `split('/') → length <= 1 ? null : slice(0, -1).join('/')`

### toXxxNode 매퍼 차이점

| 서비스 | 반환 타입 고유 필드 | Date 처리 |
|--------|-------------------|----------|
| Note | 없음 | `instanceof Date ? createdAt : new Date(createdAt)` |
| CSV | `columnWidths: string \| null` | 동일 |
| PDF | 없음 | 동일 |
| Image | 없음 | 동일 |

### 사이드 이펙트 주의사항

1. **타입 안전성**: `toFileNode` 베이스 매퍼에서 공통 필드만 처리
   - **대응**: CSV는 spread로 `columnWidths` 필드 병합
   ```typescript
   const toCsvFileNode = (row) => ({ ...toFileNode(row), columnWidths: row.columnWidths })
   ```

2. **import 경로 변경**: 4개 서비스 파일에서 import 경로가 바뀜
   - **대응**: 상대 import (`../lib/path-utils`)로 변경, barrel export 불필요

### 대상 파일
- (신규) `src/main/lib/path-utils.ts`
- (신규) `src/main/lib/file-node-mapper.ts`
- `src/main/services/note.ts`, `csv-file.ts`, `pdf-file.ts`, `image-file.ts` (import 변경만)

---

## Phase 4: Service 레벨 리팩토링 주의사항 (참고 — 추상화하지 않음)

> **결론: 서비스 레벨은 팩토리/베이스 추상화를 하지 않는다.**
> Phase 3의 유틸 추출만 진행한다.

### 근거: 서비스 간 차이가 크다 (검증 완료)

| 기능 | Note | CSV | PDF | Image |
|------|------|-----|-----|-------|
| 파일 생성 | `create()` 빈 .md 파일 | `create()` 빈 .csv 파일 | `import()` fs.copyFileSync | `import()` fs.copyFileSync |
| 내용 읽기 반환 | `string` (UTF-8 고정) | `{content, encoding, columnWidths}` (**chardet 인코딩 감지 + iconv-lite + BOM 제거**) | `{data: Buffer}` (바이너리) | `{data: Buffer}` (바이너리) |
| 내용 쓰기 | `writeContent()` + **noteImageService.cleanupRemovedImages()** | `writeContent()` + **generateCsvPreview()** (첫 3줄 `' \| '` 구분) | 없음 (읽기 전용) | 없음 (읽기 전용) |
| 삭제 시 | `fs.readFileSync` → **noteImageService.deleteAllImages()** → `fs.unlinkSync` | `fs.unlinkSync` | `fs.unlinkSync` | `fs.unlinkSync` |
| 제목 추출 | `name.replace(/\.md$/, '')` | `name.replace(/\.csv$/, '')` | `name.replace(/\.pdf$/, '')` | **`path.basename(name, path.extname(name))`** (다중 확장자 안전) |
| updateMeta | `{description}` | `{description, columnWidths}` | `{description}` | `{description}` |
| Preview 생성 | 첫 200자 공백 정규화 (`replace(/\s+/g, ' ')`) | 첫 3줄 `' \| '` join | 없음 | 없음 |
| 기본 파일명 | '새로운 노트' | '새로운 테이블' | (import이므로 없음) | (import이므로 없음) |

---

## Phase 5: Workspace Watcher Refactoring (~400줄 제거)

### 현상
- 총 944줄 모놀리스
- `applyEvents` 510줄 (14단계, 4개 파일 타입 반복)
- 4개 `xxxReconciliation` 메서드 (~200줄)
- 5개 `pushXxxChanged` 메서드

### 상세 처리 순서 (순서 의존성 검증 완료)

```
Step 1-2:  폴더 처리 (반드시 먼저 — 파일의 folderId 조회에 필요)
Step 3-5:  .md 파일 처리 (rename → create → delete)
Step 6-8:  .csv 파일 처리 (동일 패턴)
Step 9-11: .pdf 파일 처리 (동일 패턴)
Step 12-14: 이미지 파일 처리 (동일 패턴 + 고유 필터)
```

**파일 타입 간 순서 의존성 없음**: Step 3-5와 6-8과 9-11과 12-14는 서로 독립적. 각 타입 내에서만 rename→create→delete 순서가 중요.

### 블록별 정밀 비교 결과

**Rename/Move Detection (Step 3/6/9/12):**
- 로직 100% 동일: delete+create 쌍 매칭 → 같은 디렉토리에서 같은 basename → rename 판정
- **차이 1**: Image만 `.images/` 디렉토리 필터링 추가
- **차이 2**: Image만 `path.basename(path, path.extname(path))` 제목 추출

**Standalone Create (Step 4/7/10/13):**
- 로직 100% 동일: `fs.promises.stat()` → file 확인 → DB 조회 → 없으면 create
- **차이 1**: Image만 `.images/` 디렉토리 필터링 추가
- **차이 2**: Image만 `path.basename()` 제목 추출

**Standalone Delete (Step 5/8/11/14):**
- 로직 100% 동일: DB 조회 → `entityLinkRepository.removeAllByEntity(type, id)` → repository.delete()
- **차이 없음** (entity type 문자열만 다름: 'note'/'csv'/'pdf'/'image')

**Reconciliation Methods:**
- 로직 100% 동일: FS 스캔 → DB 조회 → 신규 항목 createMany → orphan 삭제
- **차이**: Image만 `path.basename(e.name, path.extname(e.name))` 제목 추출

**Push Methods:**
- 로직 100% 동일: `BrowserWindow.getAllWindows().forEach(win => win.webContents.send(channel, ...))`
- **차이 없음** (채널명만 다름)

### 파일 타입별 고유 로직 정리

| 구분 | Note/CSV/PDF | Image |
|------|-------------|-------|
| 이벤트 필터링 | 없음 | `rel.startsWith('.images/') \|\| rel.includes('/.images/')` 제외 |
| 확장자 매칭 | `.endsWith('.ext')` 단일 | `isImageFile()` 7개 확장자 + 대소문자 무시 |
| 제목 추출 | `path.basename(p, '.ext')` (하드코딩) | `path.basename(p, path.extname(p))` (동적) |
| entityLink type | 'note' / 'csv' / 'pdf' | 'image' |

### handleEvents() 수집 로직

- 각 파일 타입별 changedPaths를 수집하여 push 메서드 호출
- Image만 `.images/` 필터가 있음 (lines 181-182)
- **대응**: config에 포함하여 일관되게 처리

### 사이드 이펙트 주의사항

1. **폴더 → 파일 순서**: Step 1-2가 완료된 후에 파일 처리해야 함
   - **대응**: `processFileTypeEvents()`를 폴더 처리 이후에 순차 호출. for-of 루프 사용

2. **Image `.images/` 필터**: applyEvents 3곳(rename/create/delete) + handleEvents 1곳에 적용
   - **대응**: config에 `skipFilter?: (relativePath: string) => boolean` 옵션
   - **주의**: 4곳 모두 동일한 필터 로직이어야 함

3. **Image 제목 추출 방식**: regex가 아닌 `path.basename()` 사용 — 다중 확장자 파일(photo.backup.png)에서 동작이 다름
   - **대응**: config에 `extractTitle: (fileName: string) => string` 함수 파라미터

4. **entityLink type 문자열**: 삭제 시 `entityLinkRepository.removeAllByEntity(type, id)` 호출
   - **대응**: config에 `entityType: string` 포함

5. **pushXxxChanged 채널명 보존**: 채널명이 바뀌면 renderer의 `onChanged` 리스너가 동작 안 함
   - **대응**: config에 `channelName: string` 포함, 절대 변경 불가

6. **reconciliation bare catch {}**: 16개의 bare catch 블록 — 의도적 설계 (watcher 크래시 방지)
   - **대응**: `console.warn('[workspace-watcher]', e)` 수준의 로깅만 추가. 에러 전파하지 않음

### 개선 방법

```typescript
interface FileTypeConfig {
  extensions: string[] | ((name: string) => boolean) // Image: isImageFile
  repository: FileRepository
  channelName: string                                 // 'note:changed' etc.
  entityType: string                                  // 'note'/'csv'/'pdf'/'image'
  extractTitle: (fileName: string) => string
  skipFilter?: (relativePath: string) => boolean      // Image: .images/ 제외
}

const fileTypeConfigs: FileTypeConfig[] = [
  {
    extensions: ['.md'],
    repository: noteRepository,
    channelName: 'note:changed',
    entityType: 'note',
    extractTitle: (name) => path.basename(name, '.md'),
  },
  // ... csv, pdf 동일 패턴
  {
    extensions: isImageFile, // 함수 전달
    repository: imageFileRepository,
    channelName: 'image:changed',
    entityType: 'image',
    extractTitle: (name) => path.basename(name, path.extname(name)),
    skipFilter: (rel) => rel.startsWith('.images/') || rel.includes('/.images/'),
  },
]
```

### 대상 파일
- `src/main/services/workspace-watcher.ts`

---

## Phase 6: Renderer 중복 통합 (~170줄 제거)

### 6-1. Own-Write Tracker 통합 + 버그 수정

**현재 구현 비교:**
```typescript
// Note (BUG): Set 기반 — timer 참조 없음
const pendingWrites = new Set<string>()
export function markAsOwnWrite(noteId: string): void {
  pendingWrites.add(noteId)
  setTimeout(() => pendingWrites.delete(noteId), 2000) // timer 미추적
}

// CSV/PDF/Image: Map 기반 — timer 참조 관리
const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>()
export function markAsOwnWrite(csvId: string): void {
  const prev = pendingWrites.get(csvId)
  if (prev) clearTimeout(prev)  // 이전 timer 정리
  const timer = setTimeout(() => pendingWrites.delete(csvId), 2000)
  pendingWrites.set(csvId, timer)
}
```

**통합 방식**: `createOwnWriteTracker()` 팩토리를 `@shared/lib/`에 생성
- `workspace-own-write.ts`는 이미 올바른 Map 패턴 사용 → 그대로 유지
- 4개 entity별 tracker → 팩토리로 생성, 각 entity에서 re-export

**사이드 이펙트**: Map 패턴으로 통일하면 Note의 동작이 **개선됨** (BUG-1 수정). 기존 API(`markAsOwnWrite`, `isOwnWrite`) 시그니처 동일하므로 호출부 변경 없음.

### 6-2. File Watcher Hook 통합

**4개 hook 비교 결과: 로직 100% 동일**
- 차이: 아이콘(FileText/Sheet/PdfIcon/ImageIcon), 이벤트명, API 메서드명(`window.api.note.onChanged` vs `window.api.csv.onChanged`...), queryKey prefix

**markAsOwnWrite 호출 패턴 불일치 (BUG-2 관련):**

| Mutation | Note | CSV | PDF | Image |
|----------|------|-----|-----|-------|
| rename | markWorkspaceOwnWrite만 | markWorkspaceOwnWrite + **markAsOwnWrite** | markWorkspaceOwnWrite + **markAsOwnWrite** | markWorkspaceOwnWrite + **markAsOwnWrite** |
| writeContent | markWorkspaceOwnWrite + markAsOwnWrite | markWorkspaceOwnWrite + markAsOwnWrite | N/A (읽기전용) | N/A (읽기전용) |
| create/import | markWorkspaceOwnWrite만 | markWorkspaceOwnWrite만 | markWorkspaceOwnWrite만 | markWorkspaceOwnWrite만 |
| remove | markWorkspaceOwnWrite만 | markWorkspaceOwnWrite만 | markWorkspaceOwnWrite만 | markWorkspaceOwnWrite만 |
| move | markWorkspaceOwnWrite만 | markWorkspaceOwnWrite만 | markWorkspaceOwnWrite만 | markWorkspaceOwnWrite만 |

→ Note rename에만 `markAsOwnWrite` 누락 (BUG-2)

**사이드 이펙트 주의:**
- 각 이벤트명 (`NOTE_EXTERNAL_CHANGED_EVENT` 등)은 반드시 고유 유지
- `queryClient.invalidateQueries()` 키가 타입별로 달라야 함
- **대응**: config 객체로 모든 차이점을 파라미터화

### 6-3. Context Menu 통합

- 4개 컴포넌트(`NoteContextMenu`, `CsvContextMenu`, `PdfContextMenu`, `ImageContextMenu`) **100% 동일** 확인
- Props: `{ children: React.ReactNode, onDelete: () => void }`
- 내용: `<ContextMenu>` → `<ContextMenuTrigger>` → `<ContextMenuItem variant="destructive">삭제</ContextMenuItem>`
- **사이드 이펙트 없음**: 순수 UI 컴포넌트, 호출부(`FolderTree.tsx`)는 동일 인터페이스 유지

### 대상 파일
- `src/renderer/src/entities/*/model/own-write-tracker.ts` → `src/renderer/src/shared/lib/create-own-write-tracker.ts`
- `src/renderer/src/entities/*/model/use-*-watcher.ts` → `src/renderer/src/shared/hooks/use-file-watcher.ts`
- `src/renderer/src/features/folder/manage-folder/ui/*ContextMenu.tsx` → `FileContextMenu.tsx`
- 각 entity의 `index.ts` barrel export 업데이트

---

## Phase 7: Preload & IPC 정리 (~80줄 제거)

### 현상
- `src/preload/index.ts`: `onChanged` 콜백 5곳 동일 패턴 (note, csv, pdf, image, folder)
- `src/main/ipc/`: 4개 파일 타입 IPC 핸들러 등록 파일 구조 동일

### onChanged 콜백 비교 (검증 완료)

| 대상 | 콜백 시그니처 | 패턴 동일 |
|------|-------------|----------|
| note | `(workspaceId: string, changedRelPaths: string[]) => void` | 동일 |
| csv | 동일 | 동일 |
| pdf | 동일 | 동일 |
| image | 동일 | 동일 |
| folder | 동일 | 동일 |
| **entity-link** | **`() => void`** (파라미터 없음) | **다름** |

→ entity-link의 onChanged는 시그니처가 다르므로 통합 대상에서 **제외**

### IPC 핸들러 불일치 발견 (신규)

**pdf:selectFile, image:selectFile이 handle() 래퍼를 사용하지 않음:**
```typescript
// 다른 모든 핸들러 (일관된 패턴)
ipcMain.handle('note:readByWorkspace', (_, workspaceId) => handle(() => noteService.readByWorkspaceFromDb(workspaceId)))

// pdf:selectFile, image:selectFile (불일치)
ipcMain.handle('pdf:selectFile', async (): Promise<string | null> => {
  const result = await dialog.showOpenDialog({ ... })
  return result.canceled ? null : result.filePaths[0]
})
```
- 다른 35+ 핸들러는 `handle()` 래퍼로 `IpcResponse<T>` 반환
- selectFile 2개만 raw 값 직접 반환
- **현재 동작 중이므로** preload 쪽에서도 이에 맞게 호출하는 것으로 확인됨
- **대응**: 이번 리팩토링에서는 **의도적으로 변경하지 않음** (동작 중인 코드를 무리하게 변경하면 사이드 이펙트 위험)

### 파일 타입별 IPC 고유 핸들러

| IPC | Note | CSV | PDF | Image |
|-----|------|-----|-----|-------|
| readByWorkspace | 공통 | 공통 | 공통 | 공통 |
| create | O | O | X | X |
| import | X | X | O | O |
| rename | 공통 | 공통 | 공통 | 공통 |
| remove | 공통 | 공통 | 공통 | 공통 |
| readContent | 공통 | 공통 | 공통 | 공통 |
| writeContent | O | O | X | X |
| move | 공통 | 공통 | 공통 | 공통 |
| updateMeta | 공통 | 공통(+columnWidths) | 공통 | 공통 |
| **selectFile** | X | X | O (단일 선택, handle() 미사용) | O (다중 선택, handle() 미사용) |

### 사이드 이펙트 주의사항
- onChanged 헬퍼 추출 시 `entity-link`는 제외 (시그니처 다름)
- `selectFile` 핸들러는 개별 유지 (handle() 래퍼 미사용 패턴)
- 채널명 정확히 보존 필수

### 대상 파일
- `src/preload/index.ts`
- `src/main/ipc/note.ts`, `csv-file.ts`, `pdf-file.ts`, `image-file.ts`

---

## Phase 8: 성능 개선 (MEDIUM)

### 8-1. N+1 쿼리 문제
- **현상**: `readByWorkspace`에서 `newFsEntries`마다 `folderRepository.findByRelativePath` 개별 호출
- **위치**: note.ts:102, csv-file.ts:104, pdf-file.ts:92, image-file.ts:90 (4곳 동일 패턴)
- **추가 발견**: workspace-watcher의 reconciliation 메서드 4곳에도 동일한 N+1 패턴 존재
- **영향**: 100개 신규 파일 감지 시 → 최대 100회 `findByRelativePath` 호출
- **개선**: 모든 폴더를 한 번에 로드 후 `Map<relativePath, folder>` 캐시
- **사이드 이펙트**: 없음 (동일 결과, 더 빠름)

### 8-2. getLeafSiblings 비효율 쿼리
- **현상**: 4개 `findByWorkspaceId()` 전체 조회 후 in-memory folderId 필터
- **위치**: `src/main/lib/leaf-reindex.ts:16-34`
- **호출 횟수**: 8곳 (모든 파일 타입의 create + move에서 호출)
- **영향**: 워크스페이스에 2000개 파일 → 전부 로드 후 특정 폴더의 ~50개만 사용
- **개선**: `findByFolderId(workspaceId, folderId)` 메서드를 repository factory에 추가
- **사이드 이펙트**: 없음 (동일 결과). 단, `folderId === null`인 경우 `IS NULL` 쿼리 필요
- **주의**: `reindexLeafSiblings()`의 트랜잭션에서 `Date.now()` 사용 (숫자 타입) — SQLite integer 컬럼에 직접 저장하므로 정상

### 8-3. Folder Service 비효율 (신규 발견)
- **현상**: `folder.ts:235-243`에서 `folderRepository.findByWorkspaceId(workspaceId)` 전체 로드 후 in-memory 필터
- **영향**: 1000개 폴더 → 전부 로드 후 직접 하위 폴더만 필터
- **개선**: `findChildFolders(workspaceId, parentRelPath)` DB 레벨 쿼리 추가
- **사이드 이펙트**: 없음

### 8-4. 동기 파일 I/O (참고만 — 이번 리팩토링 범위 밖)
- **현상**: 서비스 레이어에서 `fs.writeFileSync`, `fs.readFileSync`, `fs.renameSync`, `fs.unlinkSync` 등 30+ 곳에서 동기 I/O 사용
- **영향**: 대용량 파일 작업 시 메인 프로세스 블로킹 → UI 프리징
- **이번 범위**: 비동기 전환은 서비스 전체 구조 변경이 필요하므로 **제외**. 별도 리팩토링 계획 필요

### 8-5. Silent Error Swallowing
- **현상**: `workspace-watcher.ts`에 bare `catch {}` **16곳**
- **구분**:
  - 의도적 (reconciliation try-catch 4곳, watcher init 6곳): 주석으로 설명됨
  - `fs.promises.stat()` 실패 5곳: 파일 삭제 감지와 경합 → 의도적 무시
  - 기타 1곳: 스냅샷 쓰기 실패
- **개선**: `catch (e) { console.warn('[workspace-watcher]', e) }` 수준의 로깅
- **사이드 이펙트**: 없음 (에러 무시 동작 유지, 로깅만 추가)

---

## Implementation Order (최종 v3)

| 순서 | Phase | 제거 줄 수 | 위험도 | 검증 방법 |
|------|-------|----------|--------|----------|
| 0 | BUG-1, BUG-2, BUG-3 수정 | +15줄 | 낮음 | 노트 이름변경 + 빠른 저장 테스트 |
| 1 | Phase 2: fs-utils 통합 | ~200줄 | 낮음 | 워크스페이스 열기 + 파일 탐색 |
| 2 | Phase 3: 서비스 유틸 추출 | ~120줄 | 낮음 | 전 파일타입 CRUD 테스트 |
| 3 | Phase 1: Repository Factory | ~520줄 | 중간 | 전 파일타입 CRUD + leaf reindex |
| 4 | Phase 6: Renderer 통합 | ~170줄 | 낮음 | 외부 파일 변경 감지 + 컨텍스트 메뉴 |
| 5 | Phase 7: Preload/IPC 정리 | ~80줄 | 낮음 | IPC 전체 동작 확인 |
| 6 | Phase 5: Workspace Watcher | ~400줄 | **높음** | 파일 생성/삭제/이동/이름변경 + 동시다발 변경 |
| 7 | Phase 8: 성능 개선 | 가변 | 중간 | 대규모 워크스페이스 성능 |

### 순서 결정 근거
- **버그 수정 최우선**: 독립적이고 위험도 낮음, 즉시 사용자 경험 개선
- **fs-utils → 유틸 추출 → Repository Factory**: 의존성 없는 것부터 안전하게 진행
- **Renderer 통합**: main process 변경 없이 독립 진행 가능
- **Workspace Watcher 최후순**: 가장 위험도 높으므로 다른 리팩토링 안정화 후 진행

---

## 리팩토링하지 않는 항목 (의도적 제외)

| 항목 | 제외 근거 |
|------|----------|
| Service 레벨 팩토리/베이스 | Note의 imageService 연동, CSV의 인코딩 감지, PDF/Image의 import 패턴 등 차이가 너무 커서 추상화 시 조건 분기가 오히려 복잡해짐 |
| Error 클래스 공유 (main↔renderer) | Electron 3-프로세스 모델에서 main/renderer 간 모듈 공유는 번들링 복잡성 증가. 3개 클래스 수준은 관리 가능 |
| selectFile IPC 통합 | PDF(단일 선택)와 Image(다중 선택, 다른 필터)의 dialog 옵션이 달라 통합 시 오히려 복잡 |
| selectFile handle() 래퍼 추가 | 현재 동작 중이며 preload와 짝이 맞음. 무리한 변경은 사이드 이펙트 위험 |
| leaf-reindex.ts 4개 prepared statement | 트랜잭션 내에서 kind별 dispatch가 필요하므로 현재 구조가 적절. repository factory와 무관 |
| 동기 파일 I/O → 비동기 전환 | 서비스 전체 구조 변경 필요. 별도 리팩토링 계획 필요 |

---

## Success Criteria

- [ ] BUG-1, BUG-2, BUG-3 수정 완료
- [ ] 전체 코드 중복률 60% 이상 감소 (서비스 제외 기준)
- [ ] 모든 기존 기능 정상 동작 (수동 테스트 체크리스트)
- [ ] 새 파일 타입 추가 시 변경 필요 파일 수: 15+ → 5-6개
- [ ] `workspace-watcher.ts` 600줄 이하
- [ ] **사이드 이펙트 제로** (기존 동작 100% 보존)

## 수동 테스트 체크리스트 (각 Phase 후 실행)

- [ ] 각 파일 타입(note, csv, pdf, image) 생성/열기/삭제
- [ ] 파일 이름 변경 (note 포함 — BUG-2 수정 검증)
- [ ] 파일 이동 (드래그&드롭)
- [ ] 외부 편집기에서 파일 수정 → Rally에서 변경 감지 확인
- [ ] 빠른 연속 저장 → 외부 변경 알림이 잘못 뜨지 않는지 확인 (BUG-1 수정 검증)
- [ ] 폴더 생성/삭제/이름변경 → 하위 파일 정상 처리
- [ ] 워크스페이스 열기 → reconciliation 정상 동작
- [ ] 컨텍스트 메뉴(우클릭) → 삭제 동작
- [ ] CSV 비-UTF8 파일 열기 → 인코딩 정상
- [ ] Image .images/ 하위 파일 → watcher에서 무시되는지 확인
- [ ] leaf reindex (파일 순서 변경) 정상 동작
- [ ] PDF/Image 파일 import (selectFile dialog) 정상 동작
- [ ] Entity link 생성/삭제 → onChanged 이벤트 정상

## Risk & Mitigation

| 리스크 | 완화 방안 |
|--------|----------|
| Repository 팩토리 타입 안전성 약화 | update()를 팩토리에서 제외, 개별 유지 |
| Workspace Watcher 리팩토링 시 이벤트 순서 깨짐 | 폴더 처리 → 파일 처리 순서 보장, 단위별 점진적 추출 |
| Image 전용 로직 누락 (.images/ 필터, basename 제목 추출, 대소문자 무시) | config 파라미터로 명시적 분리, 3가지 모두 검증 |
| 채널명 변경으로 IPC 통신 단절 | 채널명을 상수로 관리, 테스트에서 검증 |
| entity-link onChanged 시그니처 차이 | onChanged 헬퍼에서 entity-link 제외 |
| selectFile의 handle() 미사용 패턴 깨짐 | 이번 리팩토링에서 변경하지 않음 |
| 서비스 과도한 추상화 | **하지 않음** — 유틸 추출만 진행 |
