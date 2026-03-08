# CSV Feature Plan

## Overview

Rally 앱에 CSV 파일 뷰어/편집 기능을 추가한다.
Note와 동일하게 **파일시스템이 content의 source of truth**이고, SQLite는 메타데이터(description, preview, order)와 DB 관계(folderId 링크)를 위한 stable identity를 저장한다.

사이드바 파일 탐색기(FolderTree)에 CSV 파일이 노트와 함께 표시되고, CSV를 클릭하면 **오른쪽 탭(openRightTab)** 에 테이블 뷰어/에디터가 열린다.

노트와 CSV 파일은 **같은 폴더 내에서 order가 공유**되어, DnD로 노트와 CSV의 순서를 자유롭게 섞을 수 있다.

---

## 아키텍처 원칙

```
파일시스템 (workspace.path/**/*.csv) → 실제 CSV 내용 (content)
SQLite (csv_files 테이블)            → stable id + 메타데이터 (description, preview, order)
FolderTree (Renderer)                → Folder + Note + CSV 혼합 트리 렌더링
```

### 기존 기능과의 비교

| 항목           | Folder                        | Note                                   | CSV                                                             |
| -------------- | ----------------------------- | -------------------------------------- | --------------------------------------------------------------- |
| FS entity      | 디렉토리                      | `.md` 파일                             | `.csv` 파일                                                     |
| DB 주요 역할   | color, order, stable id       | description, preview, order, stable id | description, preview, order, stable id (encoding은 런타임 감지) |
| 트리 표시      | react-arborist (children)     | react-arborist (leaf node)             | react-arborist (leaf node)                                      |
| 외부 변경 감지 | @parcel/watcher (폴더 이벤트) | @parcel/watcher (파일 이벤트)          | @parcel/watcher (파일 이벤트)                                   |
| 생성 UX        | Dialog (이름 입력)            | 즉시 생성 ("새로운 노트")              | Dialog (이름 입력) + 빈 CSV 생성                                |
| 클릭 동작      | toggle (열기/닫기)            | openRightTab (에디터 열기)             | openRightTab (테이블 뷰어/에디터 열기)                          |
| 순서 공유      | 폴더끼리 독립 order           | 폴더 내 order (CSV와 공유)             | 폴더 내 order (Note와 공유)                                     |

---

## 데이터 스키마

### SQLite `csv_files` 테이블

| 필드           | 타입                       | 설명                                                 |
| -------------- | -------------------------- | ---------------------------------------------------- |
| `id`           | text (PK)                  | nanoid — DB 관계 전용 stable key                     |
| `workspaceId`  | text NOT NULL              | `workspaces.id` 참조 (onDelete: cascade)             |
| `folderId`     | text NULL                  | `folders.id` 참조 (onDelete: set null) — null = 루트 |
| `relativePath` | text NOT NULL              | workspace 루트 기준 상대경로 (`"folder/data.csv"`)   |
| `title`        | text NOT NULL              | 파일명 (`.csv` 제외), 화면 표시용                    |
| `description`  | text NOT NULL DEFAULT ''   | 사용자가 작성하는 짧은 설명 (메타데이터)             |
| `preview`      | text NOT NULL DEFAULT ''   | 헤더 행 + 첫 2행 요약 (메타데이터)                   |
| `order`        | integer NOT NULL DEFAULT 0 | 같은 폴더 내 정렬 순서 (**Note와 공유**)             |
| `createdAt`    | integer (timestamp_ms)     |                                                      |
| `updatedAt`    | integer (timestamp_ms)     |                                                      |

- unique constraint: `(workspaceId, relativePath)`
- `relativePath`는 항상 `/` 구분자로 정규화 (Windows `\` 변환)
- 숨김 파일(`.` 시작)은 트리에서 제외

### 이중 식별자 전략 (folder, note와 동일)

| 필드           | 역할                | 안정성                |
| -------------- | ------------------- | --------------------- |
| `id` (nanoid)  | DB 관계용 stable id | 항상 불변             |
| `relativePath` | 파일시스템 위치     | rename/move 시 변경됨 |

---

## IPC 인터페이스

### 채널 목록

```
csv:readByWorkspace  (workspaceId)                       → CsvFileNode[]
csv:create           (workspaceId, folderId?, name)      → CsvFileNode
csv:rename           (workspaceId, csvId, newName)       → CsvFileNode
csv:remove           (workspaceId, csvId)                → void
csv:readContent      (workspaceId, csvId)                → { content: string, encoding: string }
csv:writeContent     (workspaceId, csvId, content)       → void  (preview 자동 업데이트)
csv:move             (workspaceId, csvId, folderId, idx) → CsvFileNode
csv:updateMeta       (workspaceId, csvId, { description? }) → CsvFileNode
```

### Push 이벤트 (Main → Renderer)

```
'csv:changed' (workspaceId, changedRelPaths: string[])
  // @parcel/watcher .csv 파일 변경 감지 → renderer에서 readByWorkspace 재요청
```

### Preload API 타입

```typescript
interface CsvFileNode {
  id: string
  title: string
  relativePath: string
  description: string
  preview: string
  folderId: string | null
  order: number
  createdAt: Date
  updatedAt: Date
}

interface CsvAPI {
  readByWorkspace: (workspaceId: string) => Promise<IpcResponse<CsvFileNode[]>>
  create: (
    workspaceId: string,
    folderId: string | null,
    name: string
  ) => Promise<IpcResponse<CsvFileNode>>
  rename: (workspaceId: string, csvId: string, newName: string) => Promise<IpcResponse<CsvFileNode>>
  remove: (workspaceId: string, csvId: string) => Promise<IpcResponse<void>>
  readContent: (
    workspaceId: string,
    csvId: string
  ) => Promise<IpcResponse<{ content: string; encoding: string }>>
  writeContent: (workspaceId: string, csvId: string, content: string) => Promise<IpcResponse<void>>
  move: (
    workspaceId: string,
    csvId: string,
    folderId: string | null,
    index: number
  ) => Promise<IpcResponse<CsvFileNode>>
  updateMeta: (
    workspaceId: string,
    csvId: string,
    data: { description?: string }
  ) => Promise<IpcResponse<CsvFileNode>>
  onChanged: (callback: (workspaceId: string, changedRelPaths: string[]) => void) => () => void
}
```

---

## Service Layer 상세 (Main Process)

### `csvService.readByWorkspace(workspaceId)`

note의 `readByWorkspace`와 동일한 lazy upsert 패턴. **이 메서드는 workspace-watcher의 csvReconciliation에서만 호출**되며, IPC 핸들러에서는 `readByWorkspaceFromDb`를 사용한다.

```
1. workspace.path 접근 가능 여부 확인
2. fs에서 .csv 파일 재귀 탐색 (숨김 제외, 심볼릭 링크 제외)
3. DB의 현재 csv_files rows 조회
4. fs에 있고 DB에 없는 것 → lazy upsert (folderId는 relativePath에서 폴더 DB lookup)
5. DB에 있고 fs에 없는 것 → orphan 삭제
6. 최신 DB rows 반환 (CsvFileNode[])
```

### `csvService.readByWorkspaceFromDb(workspaceId)`

DB-only 조회 (논블로킹). IPC 핸들러 `csv:readByWorkspace`에서 사용.

```
1. csvRepository.findByWorkspaceId(workspaceId) → rows
2. rows.map(toCsvFileNode) 반환
```

> **패턴 참고**: note의 `readByWorkspaceFromDb()`와 동일. fs scan은 watcher가 백그라운드로 처리하므로 IPC 응답 지연 없음.

### `toCsvFileNode` 변환 함수

Drizzle의 `timestamp_ms`는 `Date` 객체로 반환되나, IPC 직렬화를 위해 명시적 변환이 필요:

```typescript
function toCsvFileNode(row: typeof csvFiles.$inferSelect): CsvFileNode {
  return {
    id: row.id,
    title: row.title,
    relativePath: row.relativePath,
    description: row.description,
    preview: row.preview,
    folderId: row.folderId,
    order: row.order,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}
```

### `csvService.create(workspaceId, folderId, name)`

```
1. workspace 조회 (NotFoundError)
2. folderId 있으면 folder 조회 → relativePath 결정
3. resolveNameConflict(parentAbs, (name.trim() || '새로운 CSV') + '.csv')로 최종 파일명 결정
4. maxOrder 계산: 같은 folderId의 note siblings + csv siblings 모두 조회하여 최대값 결정
5. 빈 .csv 파일 생성 (fs.writeFileSync(absPath, ''))
6. DB insert (folderId, relativePath, title, description='', preview='', order=maxOrder+1)
7. CsvFileNode 반환
```

> **순서 공유 주의**: maxOrder 계산 시 `noteRepository`와 `csvRepository` 양쪽의 siblings를 모두 조회해야 함

### `csvService.readContent(workspaceId, csvId)`

```
1. csv 조회, workspace 조회
2. rawBuffer = fs.readFileSync(absPath)
3. encoding = chardet.detect(rawBuffer) → 결과 (예: 'UTF-8', 'EUC-KR', 'Shift_JIS')
4. fallback: encoding이 null이면 'utf-8' 사용
5. content = iconv.decode(rawBuffer, encoding)
6. BOM 제거 (UTF-8 BOM: \uFEFF)
7. { content, encoding } 반환
```

### `csvService.writeContent(workspaceId, csvId, content)`

```
1. csv 조회, workspace 조회
2. fs.writeFileSync(absPath, content, 'utf-8')  // 저장은 항상 UTF-8
3. preview 업데이트: 헤더 행 + 첫 2행 (최대 200자)
4. DB preview, updatedAt 업데이트
```

### `csvService.rename(workspaceId, csvId, newName)`

note의 rename과 동일한 패턴. resolveNameConflict 사용, 확장자 `.csv`.

### `csvService.remove(workspaceId, csvId)`

note의 remove와 동일. fs.unlinkSync + DB row 삭제.

### `csvService.move(workspaceId, csvId, folderId, index)`

note의 move와 동일한 패턴.

**순서 공유 (중요)**: reindex 시 같은 폴더 내의 note와 csv를 모두 포함해야 함.

```
1. csv 조회, workspace 조회
2. folderId가 변경된 경우 → fs 이동 (다른 폴더로)
3. 같은 폴더 내 siblings (notes + csvFiles) 조회
4. 혼합 siblings를 order 기준 정렬
5. 현재 csv를 index 위치에 삽입
6. 전체 siblings reindex (noteRepository + csvRepository 각각 업데이트)
```

### preview 생성 로직

```typescript
function generateCsvPreview(content: string): string {
  // 최대 3줄 (헤더 + 데이터 2줄) 추출, 200자 제한
  const lines = content.split('\n').slice(0, 3)
  return lines.join(' | ').slice(0, 200)
}
```

---

## 순서 공유 (Note + CSV 혼합 정렬)

### 핵심 원칙

같은 폴더 내에서 Note와 CSV 파일이 **하나의 order 공간**을 공유한다.

```
folder-A/
  ├─ [order=0] meeting-notes.md   (note)
  ├─ [order=1] sales-data.csv     (csv)
  ├─ [order=2] todo.md            (note)
  └─ [order=3] report.csv         (csv)
```

### reindex 전략

기존 note의 `reindexSiblings`는 note만 처리한다. CSV 추가로 인해 **혼합 reindex**가 필요하다.

```typescript
// src/main/lib/leaf-reindex.ts (신규 공유 유틸)
function reindexLeafSiblings(
  workspaceId: string,
  folderId: string | null,
  orderedItems: Array<{ id: string; kind: 'note' | 'csv' }>
): void {
  const noteIds: string[] = []
  const csvIds: string[] = []
  const noteOrders: number[] = []
  const csvOrders: number[] = []

  orderedItems.forEach((item, i) => {
    if (item.kind === 'note') {
      noteIds.push(item.id)
      noteOrders.push(i)
    } else {
      csvIds.push(item.id)
      csvOrders.push(i)
    }
  })

  // prepared statement + transaction으로 배치 실행 (성능: 개별 update 대비 10x+)
  const now = Date.now()
  const noteStmt = db.$client.prepare(
    `UPDATE notes SET "order" = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`
  )
  const csvStmt = db.$client.prepare(
    `UPDATE csv_files SET "order" = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`
  )
  db.$client.transaction(() => {
    noteIds.forEach((id, idx) => noteStmt.run(noteOrders[idx], now, workspaceId, id))
    csvIds.forEach((id, idx) => csvStmt.run(csvOrders[idx], now, workspaceId, id))
  })()
}

// 같은 폴더 내 모든 leaf siblings (note + csv) 조회
function getLeafSiblings(
  workspaceId: string,
  folderId: string | null
): Array<{ id: string; kind: 'note' | 'csv'; order: number }> {
  const notes = noteRepository
    .findByWorkspaceId(workspaceId)
    .filter((n) => n.folderId === folderId)
    .map((n) => ({ id: n.id, kind: 'note' as const, order: n.order }))
  const csvs = csvRepository
    .findByWorkspaceId(workspaceId)
    .filter((c) => c.folderId === folderId)
    .map((c) => ({ id: c.id, kind: 'csv' as const, order: c.order }))
  return [...notes, ...csvs].sort((a, b) => a.order - b.order)
}
```

### 기존 noteService 수정 필요 사항 (중요)

**`noteService.move()`와 `noteService.create()`가 반드시 수정되어야 함.** 그렇지 않으면 note를 이동/생성할 때 CSV 파일의 order가 깨진다.

#### noteService.move() 수정

```
기존: note siblings만 조회 → note만 reindex
변경: getLeafSiblings() (note + csv) 조회 → reindexLeafSiblings()로 혼합 reindex
```

#### noteService.create() 수정

```
기존: const siblings = noteRepository.findByWorkspaceId(workspaceId).filter(n => n.folderId === folderId)
      const maxOrder = Math.max(...siblings.map(s => s.order))
변경: const siblings = getLeafSiblings(workspaceId, folderId)
      const maxOrder = siblings.length > 0 ? Math.max(...siblings.map(s => s.order)) : -1
```

### DnD onMove 변경

FolderTree의 `onMove` 핸들러가 3가지 kind를 처리:

```typescript
onMove={({ dragIds, dragNodes, parentId, index }) => {
  const kind = dragNodes[0]?.data.kind
  if (kind === 'note') {
    moveNote({ workspaceId, noteId: dragIds[0], folderId: parentId ?? null, index })
  } else if (kind === 'csv') {
    moveCsv({ workspaceId, csvId: dragIds[0], folderId: parentId ?? null, index })
  } else {
    move({ workspaceId, folderId: dragIds[0], parentFolderId: parentId ?? null, index })
  }
}}
```

---

## Renderer Layer (FSD 구조)

### FSD 아키텍처 준수

Note와 동일한 전략: CSV 관련 tree UI 컴포넌트는 `features/folder/manage-folder/` 내에 배치.

```
features/folder/ → entities/csv   ✅ 허용 (features → entities)
features/folder/ → features/csv   ❌ 금지 (features → features)
```

### 레이어 구성

```
entities/csv-file/
  model/types.ts            → CsvFileNode 타입
  api/queries.ts            → useCsvFilesByWorkspace, useCreateCsv, useRenameCsv,
                               useRemoveCsv, useReadCsvContent, useWriteCsvContent,
                               useMoveCsv, useUpdateCsvMeta
  model/use-csv-watcher.ts  → push 이벤트 구독 훅
  index.ts                  → barrel export

features/folder/manage-folder/
  model/
    types.ts                → WorkspaceTreeNode = FolderTreeNode | NoteTreeNode | CsvTreeNode (확장)
    use-workspace-tree.ts   → useFolderTree + useNotesByWorkspace + useCsvFilesByWorkspace 병합
  ui/
    FolderTree.tsx           → csv DnD, context menu, delete dialog 추가
    CsvNodeRenderer.tsx      → CSV leaf 노드 렌더러 (NEW)
    CsvContextMenu.tsx       → CSV 전용 컨텍스트 메뉴 (이름 변경/삭제, NEW)
    FolderContextMenu.tsx    → "CSV 추가하기" 항목 추가

features/csv-viewer/
  model/
    use-csv-editor.ts            → CSV 파싱, 편집 상태, undo/redo, 변경 감지
    csv-history.ts               → Undo/Redo 커맨드 스택
    use-csv-external-sync.ts     → 외부 변경 감지 → 에디터 리마운트 (NEW)
    own-write-tracker.ts         → 자체 저장 vs 외부 변경 구분 (NEW, note 패턴)
    types.ts                     → CsvEditorState, CsvCommand 등 타입
  ui/
    CsvViewer.tsx                → 메인 뷰어/에디터 컴포넌트
    CsvToolbar.tsx               → 행/열 추가, 검색, undo/redo 버튼
    CsvTable.tsx                 → @tanstack/react-table + react-virtual 테이블
    CsvCell.tsx                  → 인라인 편집 셀
    CsvColumnHeader.tsx          → 정렬, 리사이즈, 필터, 이름 변경
    CsvSearchBar.tsx             → Ctrl+F 검색 바
  index.ts                       → barrel export

pages/csv/
  ui/CsvPage.tsx             → CSV 뷰어 페이지 (탭 내 렌더링)
  index.ts                   → barrel export
```

### CsvTreeNode 타입

```typescript
// features/folder/manage-folder/model/types.ts 확장

export interface CsvTreeNode {
  kind: 'csv'
  id: string
  name: string // CsvFileNode.title에서 매핑
  relativePath: string
  description: string
  preview: string
  folderId: string | null
  order: number
}

export type WorkspaceTreeNode = FolderTreeNode | NoteTreeNode | CsvTreeNode
```

### useWorkspaceTree 확장

`useWorkspaceTree` 훅도 CSV 데이터를 통합해야 함:

```typescript
// 기존
const { data: folders = [], isLoading: isFoldersLoading } = useFolderTree(workspaceId)
const { data: notes = [], isLoading: isNotesLoading } = useNotesByWorkspace(workspaceId)
const tree = buildWorkspaceTree(folders, notes)
return { tree, isLoading: isFoldersLoading || isNotesLoading }

// 변경
const { data: folders = [], isLoading: isFoldersLoading } = useFolderTree(workspaceId)
const { data: notes = [], isLoading: isNotesLoading } = useNotesByWorkspace(workspaceId)
const { data: csvFiles = [], isLoading: isCsvLoading } = useCsvFilesByWorkspace(workspaceId)
const tree = buildWorkspaceTree(folders, notes, csvFiles)
return { tree, isLoading: isFoldersLoading || isNotesLoading || isCsvLoading }
```

`buildWorkspaceTree` 함수 확장:

```typescript
// features/folder/manage-folder/model/use-workspace-tree.ts 확장

function buildWorkspaceTree(
  folders: FolderNode[],
  notes: NoteNode[],
  csvFiles: CsvFileNode[]     // 추가
): WorkspaceTreeNode[] {
  function convertCsv(csv: CsvFileNode): CsvTreeNode {
    return {
      kind: 'csv',
      id: csv.id,
      name: csv.title,
      relativePath: csv.relativePath,
      description: csv.description,
      preview: csv.preview,
      folderId: csv.folderId,
      order: csv.order
    }
  }

  function convertFolder(folder: FolderNode): FolderTreeNode {
    const childFolders = folder.children
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
      .map(convertFolder)

    // Note + CSV 혼합 정렬
    const childNotes = notes.filter((n) => n.folderId === folder.id).map(convertNote)
    const childCsvs = csvFiles.filter((c) => c.folderId === folder.id).map(convertCsv)
    const leafChildren = [...childNotes, ...childCsvs]
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))

    return {
      kind: 'folder',
      ...
      children: [...childFolders, ...leafChildren]  // 폴더 먼저, leaf 혼합 정렬
    }
  }

  // 루트 레벨도 동일하게 혼합
  const rootFolders = folders.sort(...).map(convertFolder)
  const rootLeaves = [
    ...notes.filter((n) => n.folderId === null).map(convertNote),
    ...csvFiles.filter((c) => c.folderId === null).map(convertCsv)
  ].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))

  return [...rootFolders, ...rootLeaves]
}
```

### FolderTree 변경 사항

#### Tree 속성 변경

```typescript
// disableDrop: CSV도 leaf 노드 → drop 대상 불가
disableDrop={({ parentNode }) =>
  parentNode?.data.kind === 'note' || parentNode?.data.kind === 'csv'
}

// disableEdit: CSV도 인라인 편집 차단 (이름 변경은 context menu로)
disableEdit={(n) => n.kind === 'note' || n.kind === 'csv'}

// onDelete: CSV 분기 추가
onDelete={({ ids, nodes }) => {
  if (nodes[0].data.kind === 'note') {
    setNoteDeleteTarget({ id: ids[0], name: nodes[0].data.name })
  } else if (nodes[0].data.kind === 'csv') {
    setCsvDeleteTarget({ id: ids[0], name: nodes[0].data.name })
  } else {
    setDeleteTarget({ id: ids[0], name: nodes[0].data.name })
  }
}}
```

#### handleCreateCsv 콜백

```typescript
const handleCreateCsv = useCallback(
  (folderId: string | null) => {
    createCsv(
      { workspaceId, folderId, name: '새로운 CSV' },
      {
        onSuccess: (csv) => {
          if (!csv) return
          openRightTab(
            { type: 'csv', title: csv.title, pathname: `/folder/csv/${csv.id}` },
            sourcePaneId
          )
        }
      }
    )
  },
  [workspaceId, sourcePaneId, createCsv, openRightTab]
)
```

#### CSV rename/delete 다이얼로그 렌더링

FolderTree JSX 하단에 기존 노트 삭제 다이얼로그(`noteDeleteTarget`)와 동일한 패턴으로 CSV용 다이얼로그 추가:

```tsx
{
  /* CSV 이름 변경 다이얼로그 (FolderNameDialog 재사용) */
}
;<FolderNameDialog
  open={csvRenameTarget !== null}
  onOpenChange={(open) => {
    if (!open) setCsvRenameTarget(null)
  }}
  title="CSV 이름 변경"
  defaultValue={csvRenameTarget?.name ?? ''}
  submitLabel="변경"
  isPending={isRenamingCsv}
  onSubmit={(name) => {
    if (csvRenameTarget) {
      renameCsv(
        { workspaceId, csvId: csvRenameTarget.id, newName: name },
        { onSuccess: () => setCsvRenameTarget(null) }
      )
    }
  }}
/>

{
  /* CSV 삭제 다이얼로그 (DeleteFolderDialog 재사용) */
}
;<DeleteFolderDialog
  open={csvDeleteTarget !== null}
  onOpenChange={(open) => {
    if (!open) setCsvDeleteTarget(null)
  }}
  folderName={csvDeleteTarget?.name ?? ''}
  isPending={isRemovingCsv}
  onConfirm={() => {
    if (csvDeleteTarget) {
      removeCsv(
        { workspaceId, csvId: csvDeleteTarget.id },
        { onSuccess: () => setCsvDeleteTarget(null) }
      )
    }
  }}
/>
```

> **참고**: 기존 `FolderNameDialog`, `DeleteFolderDialog` 컴포넌트를 재사용. 별도의 CSV 전용 다이얼로그 불필요.

#### NodeRenderer에서 `node.data.kind === 'csv'` 분기 추가:

```tsx
if (props.node.data.kind === 'csv') {
  return (
    <CsvContextMenu
      onRename={() => setCsvRenameTarget({ id: props.node.data.id, name: props.node.data.name })}
      onDelete={() => setCsvDeleteTarget({ id: props.node.data.id, name: props.node.data.name })}
    >
      <div>
        <CsvNodeRenderer
          {...(props as unknown as NodeRendererProps<CsvTreeNode>)}
          onOpen={() =>
            openRightTab(
              {
                type: 'csv',
                title: props.node.data.name,
                pathname: `/folder/csv/${props.node.data.id}`
              },
              sourcePaneId
            )
          }
        />
      </div>
    </CsvContextMenu>
  )
}
```

### CsvNodeRenderer

```tsx
export function CsvNodeRenderer({ node, style, dragHandle, onOpen }: CsvNodeRendererProps) {
  return (
    <div
      ref={dragHandle}
      style={style}
      className="flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer hover:bg-accent select-none"
      onClick={onOpen}
    >
      <Sheet className="ml-1 size-4 shrink-0 text-muted-foreground" />
      <span className="text-sm truncate">{node.data.name}</span>
    </div>
  )
}
```

### Tab 라우팅

- 라우트: `ROUTES.CSV_DETAIL = '/folder/csv/:csvId'`
- 탭 타입: `'csv'` (TabType에 추가)
- 탭 아이콘: `Sheet` (lucide-react) 또는 `FileSpreadsheet`
- `pane-routes.tsx`에 `CsvPage` 추가

```typescript
useTabStore.getState().openRightTab(
  {
    type: 'csv',
    title: csv.title,
    pathname: `/folder/csv/${csv.id}`
  },
  sourcePaneId
)
```

### CsvPage — TabContainer 래핑 (필수)

CLAUDE.md 규칙: **탭 내 모든 페이지는 `<TabContainer>` 하위에 렌더링**해야 `@container` 쿼리가 동작함.

```tsx
// pages/csv/ui/CsvPage.tsx
export function CsvPage() {
  const { csvId } = useParams<{ csvId: string }>()
  return (
    <TabContainer header={<CsvPageHeader />} scrollable={false}>
      {/* scrollable={false}: 테이블 자체 가상 스크롤 사용, TabContainer의 ScrollArea 불필요 */}
      <CsvViewer csvId={csvId!} />
    </TabContainer>
  )
}
```

> **컨테이너 쿼리 적용**: CsvToolbar 등 레이아웃이 패인 너비에 반응해야 하는 경우 `@[400px]:`, `@[800px]:` breakpoint를 사용 (viewport `sm:`, `md:` 사용 금지). 예: `className="flex flex-col @[800px]:flex-row"`

---

## CSV 뷰어/에디터 상세

### 기술 스택

| 라이브러리                | 역할             | 비고                       |
| ------------------------- | ---------------- | -------------------------- |
| `papaparse`               | CSV 파싱/직렬화  | 스트리밍, 헤더 자동 감지   |
| `@tanstack/react-table`   | 테이블 로직      | 정렬, 필터, 컬럼 리사이즈  |
| `@tanstack/react-virtual` | 가상 스크롤      | 대용량 CSV 대비 (10만+ 행) |
| `chardet`                 | 인코딩 자동 감지 | Main process에서 사용      |
| `iconv-lite`              | 인코딩 변환      | 감지된 인코딩 → UTF-8 변환 |

### 인코딩 처리 흐름

```
[Main Process]
1. fs.readFileSync(path) → Buffer
2. chardet.detect(buffer) → 'EUC-KR' | 'UTF-8' | 'Shift_JIS' | ...
3. iconv.decode(buffer, detectedEncoding) → string
4. BOM 제거 (\uFEFF)
5. IPC 응답: { content: string, encoding: string }

[Renderer]
6. papaparse.parse(content) → { data, meta }
7. 뷰어 렌더링
```

### 가상 스크롤 구현

```typescript
// CsvTable.tsx
import { useVirtualizer } from '@tanstack/react-virtual'

function CsvTable({ table }: { table: Table<string[]> }) {
  const parentRef = useRef<HTMLDivElement>(null)
  const rows = table.getRowModel().rows

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,  // 행 높이
    overscan: 20             // 화면 밖 렌더링 여유
  })

  return (
    <div ref={parentRef} className="overflow-auto h-full">
      <table>
        <thead>...</thead>
        <tbody style={{ height: `${virtualizer.getTotalSize()}px` }}>
          {virtualizer.getVirtualItems().map((vRow) => {
            const row = rows[vRow.index]
            return (
              <tr key={row.id} style={{ transform: `translateY(${vRow.start}px)` }}>
                {row.getVisibleCells().map((cell) => (
                  <CsvCell key={cell.id} cell={cell} />
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

### 뷰어 기능

#### 컬럼 정렬

```typescript
// @tanstack/react-table sorting
const table = useReactTable({
  data,
  columns,
  state: { sorting },
  onSortingChange: setSorting,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel()
})
```

#### 컬럼 필터링

```typescript
// 각 컬럼 헤더에 필터 입력
const table = useReactTable({
  state: { columnFilters },
  onColumnFiltersChange: setColumnFilters,
  getFilteredRowModel: getFilteredRowModel()
})
```

#### 컬럼 리사이즈

```typescript
const table = useReactTable({
  columnResizeMode: 'onChange',
  enableColumnResizing: true
})
// 헤더에 resize handle 렌더링
```

#### 검색 (Ctrl+F)

```typescript
// CsvSearchBar: globalFilter 바인딩
const [globalFilter, setGlobalFilter] = useState('')

// 키보드 단축키
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault()
      setSearchBarOpen(true)
    }
  }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}, [])
```

### 편집 기능

#### 인라인 셀 편집

```typescript
// CsvCell.tsx
function CsvCell({ cell }: { cell: Cell<string[], unknown> }) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(cell.getValue() as string)

  if (isEditing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          commitEdit(cell.row.index, cell.column.getIndex(), value)
          setIsEditing(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') { setValue(cell.getValue() as string); setIsEditing(false) }
          if (e.key === 'Tab') { e.preventDefault(); e.currentTarget.blur(); /* 다음 셀로 포커스 */ }
        }}
      />
    )
  }

  return (
    <div onClick={() => setIsEditing(true)}>
      {cell.getValue() as string}
    </div>
  )
}
```

#### 행 추가/삭제

```typescript
// CsvToolbar에서 트리거
function addRow(index?: number): void {
  const newRow = columns.map(() => '') // 빈 행
  pushCommand({ type: 'addRow', index: index ?? data.length, row: newRow })
}

function deleteRow(index: number): void {
  pushCommand({ type: 'deleteRow', index, row: data[index] })
}
```

#### 열 추가/삭제/이름 변경

```typescript
function addColumn(index?: number, name?: string): void {
  const colName = name ?? `Column ${columns.length + 1}`
  pushCommand({ type: 'addColumn', index: index ?? columns.length, name: colName })
}

function deleteColumn(index: number): void {
  pushCommand({
    type: 'deleteColumn',
    index,
    name: headers[index],
    columnData: data.map((row) => row[index])
  })
}

function renameColumn(index: number, newName: string): void {
  pushCommand({ type: 'renameColumn', index, oldName: headers[index], newName })
}
```

### Undo/Redo (Command Pattern)

```typescript
// csv-history.ts
type CsvCommand =
  | { type: 'editCell'; row: number; col: number; oldValue: string; newValue: string }
  | { type: 'addRow'; index: number; row: string[] }
  | { type: 'deleteRow'; index: number; row: string[] }
  | { type: 'addColumn'; index: number; name: string }
  | { type: 'deleteColumn'; index: number; name: string; columnData: string[] }
  | { type: 'renameColumn'; index: number; oldName: string; newName: string }

interface CsvHistory {
  undoStack: CsvCommand[]
  redoStack: CsvCommand[]
  push(command: CsvCommand): void
  undo(): CsvCommand | undefined
  redo(): CsvCommand | undefined
  canUndo: boolean
  canRedo: boolean
}
```

키보드 단축키:

- `Ctrl+Z` / `Cmd+Z` → Undo
- `Ctrl+Y` / `Cmd+Shift+Z` → Redo

### 변경사항 표시

```
수정된 셀: bg-yellow-100/50 (하이라이트)
추가된 행: bg-green-100/50 (좌측 border)
삭제 예정 행: bg-red-100/50 + line-through (실제 삭제 전 표시 없음, 즉시 반영)
```

변경 추적은 `Set<string>` (key: `${row}-${col}`)으로 관리. 저장 완료 시 clear.

### 자동 저장

```typescript
// use-csv-editor.ts
// 데이터 변경 → debounce(800ms) → serialize → writeContent IPC 호출

// 에디터 상태: { headers: string[], rows: string[][] }
const debouncedSave = useDebouncedCallback((headers: string[], rows: string[][]) => {
  const csv = Papa.unparse({ fields: headers, data: rows })
  writeCsvContent({ workspaceId, csvId, content: csv })
}, 800)

// 모든 command 실행 후 debouncedSave 트리거
function applyCommand(cmd: CsvCommand): void {
  // ... 데이터 변경 로직 ...
  debouncedSave(currentData)
}
```

---

## 외부 파일 변경 감지 (Watcher) 확장

### workspace-watcher.ts 확장

기존 workspace-watcher는 `.md` 파일만 감지한다. `.csv` 파일도 동일하게 처리:

```typescript
// handleEvents() 확장
const changedCsvRelPaths = eventsToProcess
  .filter((e) => e.path.endsWith('.csv') && !path.basename(e.path).startsWith('.'))
  .map((e) => path.relative(workspacePath, e.path).replace(/\\/g, '/'))
this.pushCsvChanged(workspaceId, changedCsvRelPaths)
```

### 추가 구현 항목

| 항목                       | 파일                                             |
| -------------------------- | ------------------------------------------------ |
| `.csv` 이벤트 필터링       | `workspace-watcher.ts` (handleEvents 확장)       |
| `pushCsvChanged()` 메서드  | `workspace-watcher.ts` 추가                      |
| `'csv:changed'` IPC 채널   | preload bridge에 추가                            |
| `onChanged` preload 메서드 | `CsvAPI` 인터페이스에 포함                       |
| `useCsvWatcher` 훅         | `entities/csv-file/model/use-csv-watcher.ts`     |
| `useCsvWatcher()` 호출     | `MainLayout.tsx` 등록                            |
| csvReconciliation 메서드   | `workspace-watcher.ts` (noteReconciliation 패턴) |
| applyEvents .csv 처리      | `workspace-watcher.ts` (Step 3~5 .csv 추가)      |

### applyEvents 확장

기존 Step 3~5 (.md 파일)를 `.csv` 파일에도 동일 적용:

```
Step 3: .csv 파일 rename/move 감지 → csvRepository.update
Step 4: standalone .csv create → DB에 csvFile 추가
Step 5: standalone .csv delete → DB에서 csvFile 삭제
```

> **구현 전략**: `.md`와 `.csv`의 이벤트 처리 로직이 거의 동일하므로, 확장자별 헬퍼 함수로 추출하여 코드 중복을 최소화한다.

```typescript
function processFileEvents(
  events: parcelWatcher.Event[],
  extension: '.md' | '.csv',
  repository: NoteRepository | CsvRepository,
  workspaceId: string,
  workspacePath: string
): void { ... }
```

### Step 1 폴더 rename 감지 필터 수정 (중요)

기존 Step 1의 non-`.md` 이벤트 필터가 `.csv` 파일을 폴더 rename으로 오인식할 수 있다. `.csv`도 제외해야 함:

```typescript
// 기존 (위험)
const nonMdDeletes = events.filter(
  (e) => e.type === 'delete' && !e.path.endsWith('.md') && !path.basename(e.path).startsWith('.')
)

// 수정 (안전)
const folderDeletes = events.filter(
  (e) =>
    e.type === 'delete' &&
    !e.path.endsWith('.md') &&
    !e.path.endsWith('.csv') &&
    !path.basename(e.path).startsWith('.')
)
```

---

## 외부 편집 동기화 (Renderer)

### use-csv-external-sync.ts

note의 `use-note-external-sync.ts`와 동일한 패턴:

```typescript
// features/csv-viewer/model/own-write-tracker.ts (note 패턴 동일)
const pendingWrites = new Set<string>()
export function markAsOwnWrite(csvId: string): void {
  pendingWrites.add(csvId)
  setTimeout(() => pendingWrites.delete(csvId), 2000) // IPC + watcher 지연 고려
}
export function isOwnWrite(csvId: string): boolean {
  return pendingWrites.has(csvId)
}

// useWriteCsvContent mutation에서 onMutate 호출:
onMutate: ({ csvId }) => {
  markAsOwnWrite(csvId)
}

// use-csv-external-sync.ts
// csv:changed push 수신 → 현재 열린 CSV의 relativePath와 비교
// isOwnWrite(csvId) → true면 무시 (자체 저장)
// 외부 변경 감지 시:
//   1. editorKey 변경 → CSV 에디터 리마운트
//   2. undo/redo 스택 초기화 (외부 변경 후 이전 스택은 무효)
```

---

## 예외 처리 및 에러 시나리오

| 시나리오                  | 처리 방식                                               |
| ------------------------- | ------------------------------------------------------- |
| workspace.path 접근 불가  | ValidationError → IpcError → UI 에러 메시지             |
| csvId로 DB 조회 실패      | NotFoundError                                           |
| .csv 파일 읽기 실패       | NotFoundError → IpcError → 뷰어에서 "파일 없음" 표시    |
| 인코딩 감지 실패          | fallback: UTF-8로 시도                                  |
| 이름 중복                 | resolveNameConflict로 자동 suffix 부여 (n)              |
| 제목 빈 문자열            | `'새로운 CSV'` fallback                                 |
| 폴더 삭제 시 csv.folderId | `onDelete: set null` → 루트로 이동 (orphan 방지)        |
| 외부에서 .csv 파일 삭제   | readByWorkspace 재호출 시 orphan 삭제 (lazy sync)       |
| 대용량 CSV (100MB+)       | 가상 스크롤로 렌더링, 파싱은 papaparse worker 옵션 검토 |
| 잘못된 CSV 형식           | papaparse errors 표시, 가능한 범위까지 렌더링           |
| 편집 중 외부 변경         | own-write 판별 → 외부이면 에디터 리마운트               |

---

## 구현 범위 (Implementation Scope)

### 패키지 설치

1. `npm install papaparse @types/papaparse` — CSV 파싱/직렬화
2. `npm install chardet` — 인코딩 자동 감지 (Main process)
3. `npm install iconv-lite` — 인코딩 변환 (Main process)
4. `npm install @tanstack/react-table` — 테이블 로직 (미설치 상태, 신규 설치 필요)
5. `npm install @tanstack/react-virtual` — 가상 스크롤 (미설치 상태, 신규 설치 필요)

### Main Process

6. `src/main/db/schema/csv-file.ts` — csv_files 테이블 Drizzle 스키마
7. `src/main/db/schema/index.ts` — csvFiles export 추가
8. `npm run db:generate && npm run db:migrate` — 마이그레이션
9. `src/main/repositories/csv-file.ts` — CRUD + bulkUpdatePathPrefix, deleteOrphans, reindexSiblings
10. `src/main/services/csv-file.ts` — fs I/O + DB merge + 인코딩 감지 + 이름 충돌 해결
11. `src/main/ipc/csv-file.ts` — IPC 핸들러 등록
12. `src/main/index.ts` — registerCsvHandlers() 호출 추가

### Main Process — Watcher 확장

13. `src/main/services/workspace-watcher.ts` — `.csv` 파일 이벤트 처리 추가
    - handleEvents: changedCsvRelPaths 수집 + pushCsvChanged
    - applyEvents: .csv rename/move/create/delete 처리
    - csvReconciliation: noteReconciliation과 동일 패턴
    - pushCsvChanged 메서드 추가

### Main Process — 공유 유틸 확장

14. `src/main/lib/fs-utils.ts` — `readCsvFilesRecursiveAsync` 추가 (readMdFilesRecursiveAsync 패턴)
    14a. `src/main/lib/leaf-reindex.ts` — `reindexLeafSiblings`, `getLeafSiblings` 공유 함수

### Main Process — 기존 서비스 수정 (순서 공유)

14b. `src/main/services/note.ts` — `move()`: getLeafSiblings + reindexLeafSiblings 사용으로 변경
14c. `src/main/services/note.ts` — `create()`: maxOrder 계산 시 CSV siblings도 포함
14d. `src/main/services/workspace-watcher.ts` — Step 1 필터에 `.csv` 제외 추가

### Preload

15. `src/preload/index.d.ts` — CsvFileNode, CsvAPI 타입 추가 + `window.api.csv` 선언
16. `src/preload/index.ts` — csv IPC bridge 등록

### Renderer — Entity

17. `src/renderer/src/entities/csv-file/model/types.ts` — CsvFileNode 타입
18. `src/renderer/src/entities/csv-file/api/queries.ts` — React Query hooks
19. `src/renderer/src/entities/csv-file/model/use-csv-watcher.ts` — push 이벤트 구독 훅
20. `src/renderer/src/entities/csv-file/index.ts` — barrel export

### Renderer — Layout

21. `src/renderer/src/app/layout/MainLayout.tsx` — `useCsvWatcher()` 등록

### Renderer — Feature (FolderTree 확장)

22. `src/renderer/src/features/folder/manage-folder/model/types.ts` — CsvTreeNode 추가, WorkspaceTreeNode 확장
23. `src/renderer/src/features/folder/manage-folder/model/use-workspace-tree.ts` — CSV 병합 로직 추가
24. `src/renderer/src/features/folder/manage-folder/ui/FolderTree.tsx` — 변경 사항:
    - csv mutations (useCreateCsv, useMoveCsv, useRemoveCsv, useRenameCsv) 추가
    - csv rename/delete target state 추가
    - NodeRenderer에 csv 분기 추가
    - onMove에 csv 분기 추가
    - 툴바에 CSV 추가 버튼
25. `src/renderer/src/features/folder/manage-folder/ui/CsvNodeRenderer.tsx` — CSV leaf 노드 렌더러
26. `src/renderer/src/features/folder/manage-folder/ui/CsvContextMenu.tsx` — CSV 전용 컨텍스트 메뉴

### Renderer — Feature (CSV Viewer/Editor)

27. `src/renderer/src/features/csv-viewer/model/types.ts` — CsvEditorState, CsvCommand 타입
28. `src/renderer/src/features/csv-viewer/model/csv-history.ts` — Undo/Redo 커맨드 스택
29. `src/renderer/src/features/csv-viewer/model/use-csv-editor.ts` — 파싱, 편집 상태, auto-save
30. `src/renderer/src/features/csv-viewer/ui/CsvViewer.tsx` — 메인 뷰어 컴포넌트
31. `src/renderer/src/features/csv-viewer/ui/CsvToolbar.tsx` — 행/열 추가, 검색, undo/redo
32. `src/renderer/src/features/csv-viewer/ui/CsvTable.tsx` — 테이블 + 가상 스크롤
33. `src/renderer/src/features/csv-viewer/ui/CsvCell.tsx` — 인라인 편집 셀
34. `src/renderer/src/features/csv-viewer/ui/CsvColumnHeader.tsx` — 정렬, 필터, 리사이즈, 이름 변경
35. `src/renderer/src/features/csv-viewer/ui/CsvSearchBar.tsx` — Ctrl+F 검색 바
36. `src/renderer/src/features/csv-viewer/index.ts` — barrel export

### Renderer — Page

37. `src/renderer/src/pages/csv/ui/CsvPage.tsx` — CSV 뷰어 페이지
38. `src/renderer/src/pages/csv/index.ts` — barrel export

### Renderer — 라우팅/상수

39. `src/renderer/src/shared/constants/tab-url.ts` — 변경:
    - TabType에 `'csv'` 추가
    - TAB_ICON에 `csv: Sheet` (또는 `FileSpreadsheet`) 추가
    - ROUTES에 `CSV_DETAIL: '/folder/csv/:csvId'` 추가
40. `src/renderer/src/app/layout/model/pane-routes.tsx` — CsvPage 라우트 추가

### Renderer — FolderContextMenu

41. `src/renderer/src/features/folder/manage-folder/ui/FolderContextMenu.tsx` — "CSV 추가하기" 항목

---

## 구현 우선순위 (권장 순서)

```
[0단계] 패키지 설치 + 공유 유틸
  npm install papaparse @types/papaparse chardet iconv-lite
  @tanstack/react-table, @tanstack/react-virtual 설치 확인
  fs-utils.ts에 readCsvFilesRecursiveAsync 추가

[1단계] DB + Main Process
  schema → migration → repository → service → ipc → index.ts 등록
  workspace-watcher.ts 확장 (.csv 이벤트 + csvReconciliation + pushCsvChanged)

[2단계] Preload 타입
  CsvFileNode, CsvAPI (onChanged 포함) 추가
  preload/index.ts에 csv bridge 등록

[3단계] entities/csv-file (React Query + Watcher)
  types → queries → use-csv-watcher → index
  MainLayout.tsx에 useCsvWatcher() 등록

[4단계] FolderTree 확장
  CsvTreeNode 타입 추가 → useWorkspaceTree 확장 → FolderTree 수정 →
  CsvNodeRenderer + CsvContextMenu → FolderContextMenu 수정
  DnD onMove csv 분기 + 혼합 reindex

[5단계] Tab 라우팅 + 상수
  tab-url.ts (TabType, ROUTES, TAB_ICON) 확장
  pane-routes.tsx에 CsvPage 추가

[6단계] CSV 뷰어/에디터 기본
  CsvPage → CsvViewer → CsvTable (가상 스크롤)
  papaparse 파싱 + @tanstack/react-table 기본 구성
  readContent IPC 연동 (인코딩 자동 감지)

[7단계] CSV 편집 기능
  인라인 셀 편집 (CsvCell)
  행 추가/삭제
  열 추가/삭제/이름 변경
  Undo/Redo (csv-history.ts)
  변경사항 하이라이트
  auto-save (debounce → writeContent IPC)

[8단계] 뷰어 고급 기능
  컬럼 정렬
  컬럼 필터링
  컬럼 리사이즈
  검색 (Ctrl+F)

[9단계] 외부 동기화
  use-csv-external-sync.ts
  own-write 판별
  에디터 리마운트

[10단계] 통합 테스트 (수동)
  CSV 생성 → 트리 표시 → 클릭 시 뷰어 → 셀 편집 → 자동 저장
  → 외부에서 .csv 파일 수정 → 트리 자동 갱신 확인
  → EUC-KR 파일 열기 → 정상 표시 확인
  → 10만행 CSV → 가상 스크롤 성능 확인
  → Note와 CSV 혼합 DnD 정렬 확인
```

---

## Success Criteria

- [ ] CSV 생성 시 workspace.path에 실제 `.csv` 파일이 생성됨
- [ ] 이름 중복 시 `(n)` suffix 자동 부여
- [ ] FolderTree에 폴더, 노트, CSV가 함께 표시됨
- [ ] Note와 CSV가 같은 폴더 내에서 order를 공유하여 DnD 혼합 정렬 가능
- [ ] CSV 클릭 시 오른쪽 탭에 테이블 뷰어 열림
- [ ] 인코딩 자동 감지 (UTF-8, EUC-KR, Shift_JIS 등)
- [ ] 대용량 CSV (10만+ 행)에서 가상 스크롤로 부드럽게 렌더링
- [ ] 컬럼 정렬 (오름/내림차순) 동작
- [ ] 컬럼 필터링 동작
- [ ] 컬럼 리사이즈 동작
- [ ] Ctrl+F 검색 동작
- [ ] 셀 클릭으로 인라인 편집 가능
- [ ] 행 추가/삭제 동작
- [ ] 열 추가/삭제/이름 변경 동작
- [ ] Undo/Redo (Ctrl+Z/Y) 동작
- [ ] 수정된 셀 하이라이트 표시
- [ ] 편집 시 debounce 후 자동 저장 (파일 반영)
- [ ] DB와 FS 동기화: readByWorkspace 시 orphan 정리 + lazy upsert
- [ ] 폴더 삭제 시 하위 CSV의 folderId가 null로 변경됨
- [ ] CSV 삭제 시 실제 .csv 파일도 삭제됨
- [ ] CSV 이름 변경 시 파일명도 변경됨
- [ ] 외부에서 `.csv` 파일 변경 시 `csv:changed` push → 자동 갱신
- [ ] FSD Import 규칙 준수
- [ ] TypeScript 컴파일 에러 없음
- [ ] Tab 라우팅 정상 동작
