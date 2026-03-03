# Plan: PDF 뷰어 구현

> 작성일: 2026-03-01
> 기능: pdf-viewer
> 레벨: Dynamic

---

## 1. 배경 및 목적

Rally 앱에 PDF 파일 뷰어를 추가한다. CSV/Note와 동일한 패턴으로 백엔드(DB, Repository, Service, IPC)를 구축하고, `react-pdf` 라이브러리로 렌더링하며, 탭 시스템에 통합한다.

**핵심 원칙**: CSV 파일 패턴을 **그대로 복제**하되 편집 기능을 제외 (PDF는 읽기 전용).

---

## 2. 기술 선택

| 항목        | 선택                                  | 사유                                             |
| ----------- | ------------------------------------- | ------------------------------------------------ |
| PDF 렌더링  | `react-pdf` + `pdfjs-dist`            | React 래퍼 제공, 커뮤니티 최대, 텍스트 선택 지원 |
| 콘텐츠 전달 | IPC → `Buffer` (ArrayBuffer)          | Electron structured clone으로 효율적 전달        |
| Worker      | `pdfjs-dist/build/pdf.worker.min.mjs` | Electron renderer에서 Web Worker 사용            |

---

## 3. CSV vs PDF 차이점

| 측면        | CSV                        | PDF                            |
| ----------- | -------------------------- | ------------------------------ |
| 편집        | readContent + writeContent | **readContent만** (읽기 전용)  |
| 생성        | `create()` — 빈 .csv 생성  | **`import()`** — 외부 PDF 복사 |
| 메타 필드   | columnWidths               | 없음 (description만)           |
| 콘텐츠 타입 | string (인코딩 감지)       | **Buffer** (바이너리)          |
| 뷰어        | CsvTable (커스텀)          | **react-pdf Document/Page**    |

---

## 4. 구현 범위

### Phase A: Main Process (DB + 백엔드)

#### A-1. DB 스키마

**파일**: `src/main/db/schema/pdf-file.ts`

```typescript
export const pdfFiles = sqliteTable(
  'pdf_files',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    folderId: text('folder_id').references(() => folders.id, { onDelete: 'set null' }),
    relativePath: text('relative_path').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    preview: text('preview').notNull().default(''),
    order: integer('order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
  },
  (t) => [unique().on(t.workspaceId, t.relativePath)]
)
```

- `src/main/db/schema/index.ts`에 export 추가
- `npm run db:generate` → `npm run db:migrate`

#### A-2. Repository

**파일**: `src/main/repositories/pdf-file.ts`

CSV repository 패턴 복제. 메서드:

- `findByWorkspaceId`, `findById`, `findByRelativePath`
- `create`, `createMany`, `update`, `delete`, `deleteOrphans`
- `bulkDeleteByPrefix`, `bulkUpdatePathPrefix`

#### A-3. Service

**파일**: `src/main/services/pdf-file.ts`

| 메서드                  | 설명                                  | CSV 대비 차이                       |
| ----------------------- | ------------------------------------- | ----------------------------------- |
| `readByWorkspace`       | fs 스캔 + lazy upsert (최초 로드 시)  | CSV와 동일 패턴                     |
| `readByWorkspaceFromDb` | DB에서 PDF 목록 조회                  | 동일                                |
| `import`                | 외부 PDF를 workspace로 복사 + DB 등록 | CSV `create` 대신 `fs.copyFileSync` |
| `rename`                | 이름 변경 (DB + 파일시스템)           | 동일 (.pdf 확장자)                  |
| `remove`                | 삭제 (DB + 파일시스템)                | 동일                                |
| `readContent`           | 파일 읽기 → `Buffer` 반환             | CSV는 string, PDF는 **Buffer**      |
| `move`                  | 폴더 이동 + reindex                   | 동일                                |
| `updateMeta`            | description 업데이트                  | columnWidths 제외                   |

> `writeContent` 없음 — PDF는 읽기 전용

> **주의**: `readByWorkspace()`는 CSV와 동일하게 fs에서 `.pdf` 파일을 스캔하여 DB에 없는 파일을 자동 등록(lazy upsert)하고, DB에만 있고 fs에 없는 orphan을 삭제한다. 워크스페이스 최초 로드 및 reconciliation에 사용.

`readContent` 반환 타입:

- main process: `{ data: Buffer }`
- renderer (IPC 후): `{ data: ArrayBuffer }` (Electron structured clone이 Buffer → ArrayBuffer 자동 변환)

#### A-4. IPC 핸들러

**파일**: `src/main/ipc/pdf-file.ts`

채널 이름: `pdf:readByWorkspace`, `pdf:import`, `pdf:rename`, `pdf:remove`, `pdf:readContent`, `pdf:move`, `pdf:updateMeta`, **`pdf:selectFile`**

`pdf:selectFile` 핸들러:

```typescript
ipcMain.handle('pdf:selectFile', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  return result.canceled ? null : result.filePaths[0]
})
```

> 기존 프로젝트에는 `workspace:selectDirectory`(디렉토리 선택)만 있고, 파일 선택 다이얼로그는 없으므로 신규 구현 필요.

`src/main/index.ts`에 `registerPdfFileHandlers()` 등록.

#### A-5. Leaf Reindex 확장

**파일**: `src/main/lib/leaf-reindex.ts`

현재 `LeafSibling.kind`가 `'note' | 'csv'`만 지원. PDF의 `move()`가 `reindexLeafSiblings()`를 호출하므로 확장 필요:

```typescript
// 변경 전
export interface LeafSibling {
  id: string
  kind: 'note' | 'csv'
  order: number
}

// 변경 후
export interface LeafSibling {
  id: string
  kind: 'note' | 'csv' | 'pdf'
  order: number
}
```

`getLeafSiblings()`: pdf_files 테이블도 쿼리하여 병합
`reindexLeafSiblings()`: pdf_files 테이블용 prepared statement 추가

#### A-6. Workspace Watcher 확장

**파일**: `src/main/services/workspace-watcher.ts`

추가해야 할 내용:

1. `pdfReconciliation()` — CSV와 동일 패턴으로 `.pdf` 파일 탐색
2. `start()`에 `pdfReconciliation()` 호출 + `pushPdfChanged()` 추가
3. `handleEvents()` → `applyEvents()`:
   - **Step 1 (폴더 rename)**: `pdfFileRepository.bulkUpdatePathPrefix()` 호출 추가 (note/csv와 동일)
   - **Step 1 (폴더 delete)**: `pdfFileRepository.bulkDeleteByPrefix()` 호출 추가 — 폴더가 물리적으로 삭제될 때 하위 PDF 레코드 정리
   - **Step 2 (폴더 이벤트 필터)**: `if (absPath.endsWith('.pdf')) continue` 추가 — 없으면 PDF 파일이 폴더 이벤트로 잘못 처리됨
   - Step 6~8: `.pdf` 파일 rename/move 감지 (`.csv` 패턴 복제)
   - `orphanPdfPaths` 수집
4. `pushPdfChanged()` 메서드 — `pdf:changed` 이벤트 전송
5. `fs-utils.ts` 확장:
   - `PdfFileEntry` 인터페이스 정의 (`{ name: string; relativePath: string }`)
   - `readPdfFilesRecursive()` (sync — service.readByWorkspace에서 사용)
   - `readPdfFilesRecursiveAsync()` (async — watcher.pdfReconciliation에서 사용)

---

### Phase B: Preload Bridge

#### B-1. 타입 정의

**파일**: `src/preload/index.d.ts`

```typescript
interface PdfFileNode {
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

interface PdfAPI {
  readByWorkspace: (workspaceId: string) => Promise<IpcResponse<PdfFileNode[]>>
  import: (
    workspaceId: string,
    folderId: string | null,
    sourcePath: string
  ) => Promise<IpcResponse<PdfFileNode>>
  rename: (workspaceId: string, pdfId: string, newName: string) => Promise<IpcResponse<PdfFileNode>>
  remove: (workspaceId: string, pdfId: string) => Promise<IpcResponse<void>>
  readContent: (workspaceId: string, pdfId: string) => Promise<IpcResponse<{ data: ArrayBuffer }>>
  move: (
    workspaceId: string,
    pdfId: string,
    folderId: string | null,
    index: number
  ) => Promise<IpcResponse<PdfFileNode>>
  updateMeta: (
    workspaceId: string,
    pdfId: string,
    data: { description?: string }
  ) => Promise<IpcResponse<PdfFileNode>>
  selectFile: () => Promise<string | null>
  onChanged: (callback: (workspaceId: string, changedRelPaths: string[]) => void) => () => void
}
```

API 인터페이스에 `pdf: PdfAPI` 추가.

#### B-2. Bridge 구현

**파일**: `src/preload/index.ts`

CSV bridge 패턴 복제. 각 메서드는 `ipcRenderer.invoke('pdf:...')` 호출.

`selectFile`: `ipcRenderer.invoke('pdf:selectFile')` → main process의 `dialog.showOpenDialog` 호출 (preload에서 dialog 직접 호출 불가).

`onChanged`: `ipcRenderer.on('pdf:changed', handler)` + cleanup 반환.

---

### Phase C: Renderer — 기반 레이어

#### C-1. 탭 시스템 등록

**파일**: `src/renderer/src/shared/constants/tab-url.ts`

```diff
+ import { FileType } from 'lucide-react'

- export type TabType = 'dashboard' | 'todo' | 'todo-detail' | 'folder' | 'note' | 'csv' | 'calendar'
+ export type TabType = 'dashboard' | 'todo' | 'todo-detail' | 'folder' | 'note' | 'csv' | 'pdf' | 'calendar'

  TAB_ICON에 pdf: FileType 추가

  ROUTES에 PDF_DETAIL: '/folder/pdf/:pdfId' 추가
```

#### C-2. Entity 레이어

**디렉토리**: `src/renderer/src/entities/pdf-file/`

```
api/queries.ts           → usePdfFilesByWorkspace, useImportPdfFile, useRenamePdfFile,
                           useRemovePdfFile, useReadPdfContent, useMovePdfFile, useUpdatePdfMeta
model/types.ts           → PdfFileNode 타입 (preload에서 import)
model/own-write-tracker.ts → isOwnWrite 추적 (import/rename/move/delete 시 markOwnWrite)
model/use-pdf-watcher.ts → pdf:changed 이벤트 리스너 + PDF_EXTERNAL_CHANGED_EVENT 커스텀 이벤트 디스패치
index.ts                 → barrel export
```

React Query 패턴은 기존 `entities/csv-file/` 구조와 동일.

#### C-3. 라우팅 등록

**파일**: `src/renderer/src/app/layout/model/pane-routes.tsx`

```typescript
const PdfPage = lazy(() => import('@pages/pdf'))

// PANE_ROUTES에 추가
{ pattern: ROUTES.PDF_DETAIL, component: PdfPage }
```

---

### Phase D: Renderer — 폴더 트리 통합

#### D-1. 트리 노드 타입

**파일**: `src/renderer/src/features/folder/manage-folder/model/types.ts`

```typescript
export interface PdfTreeNode {
  kind: 'pdf'
  id: string
  name: string
  relativePath: string
  description: string
  preview: string
  folderId: string | null
  order: number
}

export type WorkspaceTreeNode = FolderTreeNode | NoteTreeNode | CsvTreeNode | PdfTreeNode
```

#### D-2. 트리 빌더

**파일**: `src/renderer/src/features/folder/manage-folder/model/use-workspace-tree.ts`

- `convertPdf()` 함수 추가 (CSV convertCsv 패턴)
- `buildWorkspaceTree()` 시그니처에 `pdfFiles: PdfFileNode[]` 파라미터 추가
- `getLeafChildren()`에 PDF 노드 병합 (notes + csvs + pdfs)
- `useWorkspaceTree()`에 `usePdfFilesByWorkspace` query 추가

#### D-3. FolderTree.tsx 수정

**파일**: `src/renderer/src/features/folder/manage-folder/ui/FolderTree.tsx`

- PDF import 뮤테이션 추가 (`useImportPdfFile`)
- PDF 삭제 뮤테이션 + 확인 Dialog
- PDF move 뮤테이션 추가 (`useMovePdfFile`)
- NodeRenderer에 `kind === 'pdf'` 분기 추가
- 컨텍스트 메뉴에 "PDF 가져오기" 항목 추가
- **4개 가드에 PDF 분기 추가** (누락 시 폴더 동작으로 잘못 처리됨):
  - `disableDrop`: `|| parentNode?.data.kind === 'pdf'` 추가
  - `disableEdit`: `|| n.kind === 'pdf'` 추가
  - `onMove`: `else if (kind === 'pdf') { movePdfFile(...) }` 분기 추가 (없으면 폴더 이동으로 fallthrough)
  - `onDelete`: `else if (kind === 'pdf') { removePdfFile(...) }` 분기 추가

#### D-4. PDF 전용 UI

새 파일:

- `PdfNodeRenderer.tsx` — 트리 항목 렌더 (빨간색 FileType 아이콘)
- `PdfContextMenu.tsx` — 우클릭 메뉴
- `PdfDeleteDialog.tsx` — 삭제 확인

---

### Phase E: Renderer — PDF 뷰어 위젯

#### E-1. 라이브러리 설치

```bash
npm install react-pdf pdfjs-dist
```

Worker 설정 (한 번만):

```typescript
import { pdfjs } from 'react-pdf'
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()
```

#### E-2. PdfViewer 위젯

**디렉토리**: `src/renderer/src/widgets/pdf-viewer/`

```
ui/PdfViewer.tsx       → 메인 래퍼 (Document + Page 렌더)
ui/PdfToolbar.tsx      → 페이지 네비게이션 + 줌 컨트롤
model/use-pdf-viewer.ts → 상태 관리 (currentPage, scale, numPages)
index.ts               → barrel export
```

**PdfViewer 핵심 구조**:

```tsx
<Document file={{ data: arrayBuffer }} onLoadSuccess={({ numPages }) => setNumPages(numPages)}>
  <Page pageNumber={currentPage} scale={scale} />
</Document>
```

**PdfToolbar 기능**:

- 이전/다음 페이지 버튼
- 페이지 번호 입력 (직접 이동)
- 줌 인/아웃 (25%~400%)
- 줌 리셋 (100%)
- 현재 페이지 / 총 페이지 표시

---

### Phase F: Renderer — 페이지 + Feature

#### F-1. PdfPage

**디렉토리**: `src/renderer/src/pages/pdf/`

```
ui/PdfPage.tsx  → TabContainer + PdfHeader + PdfViewer
index.ts        → barrel export
```

`useReadPdfContent(workspaceId, pdfId)` → ArrayBuffer를 PdfViewer에 전달.

**외부 변경 새로고침**: `PDF_EXTERNAL_CHANGED_EVENT` 커스텀 이벤트를 리스닝하여, 외부에서 PDF 파일이 교체되면 `useReadPdfContent` 쿼리를 refetch하고 뷰어를 새로고침한다. CSV의 `CSV_EXTERNAL_CHANGED_EVENT` 리스닝 패턴과 동일.

#### F-2. PdfHeader (Feature)

**디렉토리**: `src/renderer/src/features/pdf/view-pdf/`

```
ui/PdfHeader.tsx → TabHeader 재사용 (제목 편집, description 편집)
index.ts         → barrel export
```

CSV의 CsvHeader 패턴과 동일. `writeContent` 관련 로직만 제외.

---

## 5. 구현 순서

| 순서 | Phase | 파일 수 | 설명                                                   |
| ---- | ----- | ------- | ------------------------------------------------------ |
| 1    | A-1   | 2       | DB 스키마 + 마이그레이션                               |
| 2    | A-2   | 1       | Repository                                             |
| 3    | A-3   | 1       | Service (readByWorkspace + readByWorkspaceFromDb 포함) |
| 4    | A-4   | 1       | IPC 핸들러 (selectFile 포함)                           |
| 5    | A-5   | 1       | Leaf reindex 확장 (kind + 쿼리 + statement)            |
| 6    | B-1~2 | 2       | Preload bridge (타입 + 구현)                           |
| 7    | A-6   | 2       | Workspace watcher + fs-utils 확장                      |
| 8    | C-1   | 1       | TabType + Route + Icon 등록                            |
| 9    | C-2   | 5       | Entity 레이어 (queries, types, watcher)                |
| 10   | C-3   | 1       | 라우팅 등록                                            |
| 11   | D-1~4 | 5       | 폴더 트리 통합 (4개 가드 포함)                         |
| 12   | E-1~2 | 4       | PDF 뷰어 위젯                                          |
| 13   | F-1~2 | 3       | 페이지 + Feature                                       |

총 **~29개 파일** (신규 ~22, 수정 ~7)

---

## 6. 수정 대상 기존 파일

| 파일                                                                         | 변경 내용                                                                             |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/main/db/schema/index.ts`                                                | pdfFiles export 추가                                                                  |
| `src/main/index.ts`                                                          | registerPdfFileHandlers() 등록                                                        |
| `src/main/lib/leaf-reindex.ts`                                               | LeafSibling kind에 'pdf' 추가 + getLeafSiblings/reindexLeafSiblings 확장              |
| `src/main/services/workspace-watcher.ts`                                     | PDF reconciliation + watcher 확장 (Step 1 경로 갱신/삭제, Step 2 필터, Step 6~8)      |
| `src/main/lib/fs-utils.ts`                                                   | PdfFileEntry + readPdfFilesRecursive (sync) + readPdfFilesRecursiveAsync (async) 추가 |
| `src/preload/index.ts`                                                       | pdf API bridge 구현                                                                   |
| `src/preload/index.d.ts`                                                     | PdfFileNode, PdfAPI 타입 추가                                                         |
| `src/renderer/src/shared/constants/tab-url.ts`                               | TabType, ROUTES, TAB_ICON 추가                                                        |
| `src/renderer/src/app/layout/model/pane-routes.tsx`                          | PdfPage 라우트 추가                                                                   |
| `src/renderer/src/features/folder/manage-folder/model/types.ts`              | PdfTreeNode 추가                                                                      |
| `src/renderer/src/features/folder/manage-folder/model/use-workspace-tree.ts` | buildWorkspaceTree 시그니처 + PDF 노드 빌더                                           |
| `src/renderer/src/features/folder/manage-folder/ui/FolderTree.tsx`           | PDF import/delete/move + disableDrop/disableEdit/onMove/onDelete 가드                 |

---

## 7. 검증

```bash
npm run typecheck       # 타입 체크
npm run test            # 전체 테스트
npm run dev             # 수동 테스트
```

수동 검증 항목:

- [ ] PDF 파일 가져오기 (다이얼로그 → workspace 복사)
- [ ] 폴더 트리에 PDF 표시 (아이콘 구분)
- [ ] 탭으로 PDF 열기
- [ ] 페이지 네비게이션 (이전/다음, 직접 입력)
- [ ] 줌 인/아웃
- [ ] 이름 변경
- [ ] 폴더 이동 (드래그)
- [ ] 삭제
- [ ] Workspace watcher (외부에서 PDF 추가/삭제 시 자동 동기화)
- [ ] 외부에서 PDF 파일 교체 시 뷰어 자동 새로고침
- [ ] 폴더 삭제 시 하위 PDF 레코드 정리
- [ ] 폴더 이름 변경 시 PDF relativePath 갱신

---

## 8. 주의사항

- `pdfjs-dist` worker를 Electron renderer에서 로드하려면 `import.meta.url` 기반 URL 생성 필요
- IPC로 Buffer 전달 시 Electron의 structured clone이 자동으로 ArrayBuffer 변환 처리 → main: `Buffer`, renderer: `ArrayBuffer`
- PDF preview는 텍스트 미리보기 대신 빈 문자열 또는 "PDF 문서" 고정 문자열 사용
- `selectFile()` IPC는 main process에 신규 핸들러 구현 필요 (기존에 파일 선택 다이얼로그 없음, 디렉토리만 있음)
- react-pdf의 CSS import 필요: `import 'react-pdf/dist/Page/TextLayer.css'` + `import 'react-pdf/dist/Page/AnnotationLayer.css'`
- `leaf-reindex.ts`는 note/csv/pdf 3종의 혼합 정렬을 지원해야 함 — kind 유니온 + 쿼리 + prepared statement 모두 확장
- `workspace-watcher.ts` Step 2에서 `.pdf` 파일을 폴더 이벤트에서 제외해야 함 (`.md`, `.csv`와 동일)
- `FolderTree.tsx`의 `onMove`/`onDelete`에 PDF 분기가 없으면 폴더 move/delete로 fallthrough되므로 반드시 추가
- `own-write-tracker`는 import/rename/move/delete 시에만 markOwnWrite (writeContent 없으므로)
