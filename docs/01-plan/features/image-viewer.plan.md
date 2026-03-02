# Plan: 이미지 뷰어 구현

> 작성일: 2026-03-02
> 기능: image-viewer
> 레벨: Dynamic

---

## 1. 배경 및 목적

Rally 앱에 이미지 파일 뷰어를 추가한다. PDF와 동일한 패턴으로 백엔드(DB, Repository, Service, IPC)를 구축하고, `react-zoom-pan-pinch` 라이브러리로 줌/팬 기능을 제공하며, 탭 시스템 및 폴더 시스템에 통합한다.

**핵심 원칙**: PDF 파일 패턴을 **그대로 복제**하되, 뷰어를 이미지 전용으로 교체.

---

## 2. 기술 선택

| 항목 | 선택 | 사유 |
|------|------|------|
| 이미지 줌/팬 | `react-zoom-pan-pinch` | 가볍고 사용 간편, 줌/팬/핀치 제스처 지원 |
| 콘텐츠 전달 | IPC → `Buffer` (ArrayBuffer) | PDF와 동일, Electron structured clone |
| 지원 확장자 | `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.bmp`, `.svg` | 주요 이미지 포맷 커버 |

---

## 3. PDF vs Image 차이점

| 측면 | PDF | Image |
|------|-----|-------|
| 생성 | `import()` — 외부 PDF 복사 | `import()` — 외부 이미지 복사 (동일) |
| 확장자 | `.pdf` 1개 | **7개** (png/jpg/jpeg/gif/webp/bmp/svg) |
| 콘텐츠 타입 | Buffer (바이너리) | Buffer (바이너리) — 동일 |
| 뷰어 | react-pdf Document/Page | **`<img>` + react-zoom-pan-pinch** |
| 줌 | PDF 자체 scale | **TransformWrapper/TransformComponent** |
| 페이지 | 다중 페이지 네비게이션 | **단일 이미지** (페이지 개념 없음) |
| preview | 빈 문자열 | 빈 문자열 (동일) |
| 파일 다이얼로그 필터 | `['pdf']` | `['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']` |

---

## 4. 구현 범위

### Phase A: Main Process (DB + 백엔드)

#### A-1. DB 스키마
**파일**: `src/main/db/schema/image-file.ts`

```typescript
export const imageFiles = sqliteTable('image_files', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  folderId: text('folder_id').references(() => folders.id, { onDelete: 'set null' }),
  relativePath: text('relative_path').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  preview: text('preview').notNull().default(''),
  order: integer('order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
}, (t) => [unique().on(t.workspaceId, t.relativePath)])
```

- `src/main/db/schema/index.ts`에 export 추가
- `npm run db:generate` → `npm run db:migrate`

#### A-2. Repository
**파일**: `src/main/repositories/image-file.ts`

PDF repository 패턴 복제. 메서드:
- `findByWorkspaceId`, `findById`, `findByRelativePath`
- `create`, `createMany`, `update`, `delete`, `deleteOrphans`
- `bulkDeleteByPrefix`, `bulkUpdatePathPrefix`

#### A-3. Service
**파일**: `src/main/services/image-file.ts`

| 메서드 | 설명 | PDF 대비 차이 |
|--------|------|--------------|
| `readByWorkspace` | fs 스캔 + lazy upsert | 이미지 확장자 7개 탐색, title 추출 동적 |
| `readByWorkspaceFromDb` | DB에서 이미지 목록 조회 | 동일 |
| `import` | 외부 이미지를 workspace로 복사 + DB 등록 | **단일 파일** (PDF와 동일 시그니처), title 추출 동적 |
| `rename` | 이름 변경 (DB + 파일시스템) | 확장자 유지 로직 필요, title 추출 동적 |
| `remove` | 삭제 (DB + 파일시스템) | 동일 |
| `readContent` | 파일 읽기 → `Buffer` 반환 | 동일 |
| `move` | 폴더 이동 + reindex | title 추출 동적, kind='image' |
| `updateMeta` | description 업데이트 | 동일 |

> `writeContent` 없음 — 이미지는 읽기 전용

**⚠️ 핵심 차이: title 추출 5곳 모두 수정 필수**

PDF 서비스는 `title = name.replace(/\.pdf$/, '')`로 hardcoded 확장자 제거를 **5곳**에서 사용:

| 위치 | PDF 패턴 | Image 패턴 |
|------|----------|-----------|
| `readByWorkspace()` orphan 업데이트 | `entry.name.replace(/\.pdf$/, '')` | `path.basename(entry.name, path.extname(entry.name))` |
| `readByWorkspace()` 신규 삽입 | `entry.name.replace(/\.pdf$/, '')` | `path.basename(entry.name, path.extname(entry.name))` |
| `import()` | `finalFileName.replace(/\.pdf$/, '')` | `path.basename(finalFileName, path.extname(finalFileName))` |
| `rename()` | `finalFileName.replace(/\.pdf$/, '')` | `path.basename(finalFileName, path.extname(finalFileName))` |
| `move()` | `finalFileName.replace(/\.pdf$/, '')` | `path.basename(finalFileName, path.extname(finalFileName))` |

> **1곳이라도 누락하면 title에 확장자가 포함되는 버그 발생** (예: "photo.png" → title이 "photo.png"이 됨)

추가로 `move()` 메서드의 `reindexLeafSiblings` 호출에서:
```typescript
// PDF: withoutSelf.splice(index, 0, { id: pdfId, kind: 'pdf', order: 0 })
// Image: withoutSelf.splice(index, 0, { id: imageId, kind: 'image', order: 0 })
```

**`rename()` 시 원본 확장자 유지**:

PDF는 `const desiredFileName = newName.trim() + '.pdf'`로 확장자를 하드코딩. 이미지는 원본 확장자를 동적으로 추출:
```typescript
const ext = path.extname(image.relativePath) // ".png", ".jpg" 등
const desiredFileName = newName.trim() + ext
const finalFileName = resolveNameConflict(parentAbs, desiredFileName)
const title = path.basename(finalFileName, ext)
```

**이미지 확장자 판별 헬퍼** (fs-utils.ts에서 import):
```typescript
import { isImageFile, IMAGE_EXTENSIONS } from '../lib/fs-utils'
```

#### A-4. IPC 핸들러
**파일**: `src/main/ipc/image-file.ts`

채널 이름: `image:readByWorkspace`, `image:import`, `image:rename`, `image:remove`, `image:readContent`, `image:move`, `image:updateMeta`, `image:selectFile`

`image:selectFile` 핸들러:
```typescript
ipcMain.handle('image:selectFile', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'] }]
  })
  return result.canceled ? null : result.filePaths
})
```

> PDF와 달리 `multiSelections` 지원 — 여러 이미지를 한 번에 선택 가능.
> 반환 타입: `string[]` (PDF는 `string`)

**다중 파일 import 처리 전략**:
- `image:selectFile` IPC는 `string[]` 반환 (다중 선택)
- `image:import` IPC는 **단일 파일** 시그니처 유지 (PDF와 동일: `import(workspaceId, folderId, sourcePath)`)
- **Renderer에서 루프 처리**: `handleImportImage()`에서 선택된 파일 배열을 순회하며 `importImageFile()` 뮤테이션을 각각 호출
- 마지막 가져온 이미지만 탭으로 열기 (모든 이미지를 탭으로 열면 과다)

```typescript
// FolderTree.tsx 내 — mutation 선언
const { mutateAsync: importImageFile } = useImportImageFile()
// 주의: PDF는 mutate를 사용하지만, 이미지는 다중 파일 루프를 위해 mutateAsync 필요

// handleImportImage 패턴
const handleImportImage = useCallback(
  async (folderId: string | null) => {
    const filePaths = await window.api.image.selectFile()
    if (!filePaths || filePaths.length === 0) return
    let lastImported: ImageFileNode | undefined
    for (const sourcePath of filePaths) {
      lastImported = await importImageFile({ workspaceId, folderId, sourcePath })
    }
    if (lastImported) {
      openRightTab(
        { type: 'image', title: lastImported.title, pathname: `/folder/image/${lastImported.id}` },
        sourcePaneId
      )
    }
  },
  [workspaceId, sourcePaneId, importImageFile, openRightTab]
)
```

> **PDF와의 패턴 차이**: PDF는 `mutate()` + `onSuccess` 콜백, 이미지는 `mutateAsync()` + for-of await. `useMutation`의 `mutateAsync`는 `mutationFn`의 반환값을 직접 resolve한다.

`src/main/index.ts`에 `registerImageFileHandlers()` 등록.

#### A-5. Leaf Reindex 확장
**파일**: `src/main/lib/leaf-reindex.ts`

```typescript
// 변경 전
export interface LeafSibling {
  id: string
  kind: 'note' | 'csv' | 'pdf'
  order: number
}

// 변경 후
export interface LeafSibling {
  id: string
  kind: 'note' | 'csv' | 'pdf' | 'image'
  order: number
}
```

`getLeafSiblings()`: image_files 테이블도 쿼리하여 병합
`reindexLeafSiblings()`: image_files 테이블용 prepared statement 추가

#### A-6. Entity Link 확장

**3개 파일 수정 필요:**

**파일 1**: `src/main/db/schema/entity-link.ts`

```typescript
// 변경 전
export type LinkableEntityType = 'todo' | 'schedule' | 'note' | 'pdf' | 'csv'

// 변경 후
export type LinkableEntityType = 'todo' | 'schedule' | 'note' | 'pdf' | 'csv' | 'image'
```

`LINKABLE_ENTITY_TYPES` 배열에도 `'image'` 추가.

**파일 2**: `src/main/services/entity-link.ts` — `findEntity()` switch문 확장

```typescript
// findEntity() 함수에 case 추가
case 'image':
  return imageFileRepository.findById(id)
```

> **누락 시 런타임 에러**: `findEntity()`에 'image' case가 없으면 entity link 조회/생성 시 undefined 반환 → NotFoundError 발생

**파일 3**: `src/preload/index.d.ts` — `LinkableEntityType` 타입 동기화

```typescript
// 변경 전
type LinkableEntityType = 'todo' | 'schedule' | 'note' | 'pdf' | 'csv'

// 변경 후
type LinkableEntityType = 'todo' | 'schedule' | 'note' | 'pdf' | 'csv' | 'image'
```

#### A-7. Workspace Watcher 확장
**파일**: `src/main/services/workspace-watcher.ts`

현재 watcher의 `applyEvents()`는 Step 1-2 (폴더), Step 3-5 (MD), Step 6-8 (CSV), Step 9-11 (PDF) 구조. 이미지는 **Step 12-14**로 추가.

추가해야 할 내용:

**1. `imageReconciliation()`** — PDF와 동일 패턴으로 이미지 파일 탐색
**2. `start()`에 `imageReconciliation()` 호출 + `pushImageChanged([], [])` 추가**
**3. `applyEvents()` 수정 — 총 5곳:**

**(3-a) Step 2 폴더 이벤트 필터** (line 245-247 부근):
```typescript
// 기존
if (absPath.endsWith('.md')) continue
if (absPath.endsWith('.csv')) continue
if (absPath.endsWith('.pdf')) continue
// 추가
if (isImageFile(absPath)) continue  // 7개 확장자 모두 필터
```

**(3-b) Step 2 폴더 rename (oldPath)** (line 258-261 부근):
```typescript
// 기존에 note/csv/pdf bulkUpdatePathPrefix가 있음
imageFileRepository.bulkUpdatePathPrefix(workspaceId, oldRel, rel)  // 추가
```

**(3-c) Step 2 폴더 delete** (line 291-318 부근):
```typescript
// orphan 수집 추가
const childImages = imageFileRepository
  .findByWorkspaceId(workspaceId)
  .filter((i) => i.relativePath.startsWith(rel + '/'))
orphanImagePaths.push(...childImages.map((i) => i.relativePath))

// entity link 정리 추가
for (const i of childImages) entityLinkRepository.removeAllByEntity('image', i.id)

// bulk delete 추가
imageFileRepository.bulkDeleteByPrefix(workspaceId, rel)
```

**(3-d) Step 12: 이미지 파일 rename/move 감지** (Step 9-11 PDF 패턴 복제):
```typescript
// 다중 확장자 필터링
const imageDeletes = events.filter(
  (e) => e.type === 'delete' && isImageFile(e.path) && !path.basename(e.path).startsWith('.')
)
const imageCreates = events.filter(
  (e) => e.type === 'create' && isImageFile(e.path) && !path.basename(e.path).startsWith('.')
)
// ... paired matching 로직 (PDF와 동일)
// title 추출: path.basename(createEvent.path, path.extname(createEvent.path))
```

> **title 추출 주의**: PDF는 `path.basename(p, '.pdf')`로 하드코딩. 이미지는 확장자가 여러 개이므로 `path.basename(p, path.extname(p))`로 동적 추출.

**(3-e) Step 13-14: standalone create/delete** (PDF Step 10-11 복제):
- create: `isImageFile(createEvent.path)` 필터 + `path.extname()` 기반 title 추출
- delete: `isImageFile(deleteEvent.path)` 필터 + entity link 정리

**4. `pushImageChanged()` 메서드** — `image:changed` 이벤트 전송 (pushPdfChanged 패턴)
**5. `handleEvents()` 반환 객체에 `orphanImagePaths` 추가**

**파일**: `src/main/lib/fs-utils.ts`

```typescript
// 공용 상수 + 헬퍼 (service와 watcher 모두 사용)
export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg']

export function isImageFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  return IMAGE_EXTENSIONS.includes(ext)
}

export interface ImageFileEntry {
  name: string
  relativePath: string
}

export function readImageFilesRecursive(absBase: string, parentRel: string): ImageFileEntry[]
export async function readImageFilesRecursiveAsync(absBase: string, parentRel: string): Promise<ImageFileEntry[]>
```

> `IMAGE_EXTENSIONS`와 `isImageFile()`은 **fs-utils.ts에 정의**하여 service, watcher, 기타 모듈에서 공용 사용

---

### Phase B: Preload Bridge

#### B-1. 타입 정의
**파일**: `src/preload/index.d.ts`

```typescript
interface ImageFileNode {
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

interface ImageAPI {
  readByWorkspace: (workspaceId: string) => Promise<IpcResponse<ImageFileNode[]>>
  import: (workspaceId: string, folderId: string | null, sourcePath: string) => Promise<IpcResponse<ImageFileNode>>
  rename: (workspaceId: string, imageId: string, newName: string) => Promise<IpcResponse<ImageFileNode>>
  remove: (workspaceId: string, imageId: string) => Promise<IpcResponse<void>>
  readContent: (workspaceId: string, imageId: string) => Promise<IpcResponse<{ data: ArrayBuffer }>>
  move: (workspaceId: string, imageId: string, folderId: string | null, index: number) => Promise<IpcResponse<ImageFileNode>>
  updateMeta: (workspaceId: string, imageId: string, data: { description?: string }) => Promise<IpcResponse<ImageFileNode>>
  selectFile: () => Promise<string[] | null>
  onChanged: (callback: (workspaceId: string, changedRelPaths: string[]) => void) => () => void
}
```

API 인터페이스에 `image: ImageAPI` 추가.

> `selectFile` 반환 타입이 `string[]` — 다중 선택 지원

#### B-2. Bridge 구현
**파일**: `src/preload/index.ts`

PDF bridge 패턴 복제. 각 메서드는 `ipcRenderer.invoke('image:...')` 호출.

---

### Phase C: Renderer — 기반 레이어

#### C-1. 탭 시스템 등록
**파일**: `src/renderer/src/shared/constants/tab-url.ts`

```diff
+ import { ImageIcon } from 'lucide-react'

- export type TabType = 'dashboard' | 'todo' | 'todo-detail' | 'folder' | 'note' | 'csv' | 'pdf' | 'calendar'
+ export type TabType = 'dashboard' | 'todo' | 'todo-detail' | 'folder' | 'note' | 'csv' | 'pdf' | 'image' | 'calendar'

  TAB_ICON에 image: ImageIcon 추가

  ROUTES에 IMAGE_DETAIL: '/folder/image/:imageId' 추가
```

#### C-2. Entity 레이어
**디렉토리**: `src/renderer/src/entities/image-file/`

```
api/queries.ts              → useImageFilesByWorkspace, useImportImageFile, useRenameImageFile,
                              useRemoveImageFile, useReadImageContent, useMoveImageFile, useUpdateImageMeta
model/types.ts              → ImageFileNode 타입 (preload에서 import)
model/own-write-tracker.ts  → isOwnWrite 추적 (import/rename/move/delete 시 markOwnWrite)
model/use-image-watcher.ts  → image:changed 이벤트 리스너 + IMAGE_EXTERNAL_CHANGED_EVENT 커스텀 이벤트
index.ts                    → barrel export
```

React Query 패턴은 기존 `entities/pdf-file/` 구조와 동일.

#### C-3. 라우팅 등록
**파일**: `src/renderer/src/app/layout/model/pane-routes.tsx`

```typescript
const ImagePage = lazy(() => import('@pages/image'))

// PANE_ROUTES에 추가
{ pattern: ROUTES.IMAGE_DETAIL, component: ImagePage }
```

#### C-4. Watcher 등록
**파일**: `src/renderer/src/app/layout/MainLayout.tsx`

```typescript
import { useImageWatcher } from '@entities/image-file'

// MainLayout 함수 내부에 추가 (usePdfWatcher() 다음)
useImageWatcher()
```

> **누락 시**: 외부에서 이미지 파일 추가/삭제/교체해도 UI에 반영되지 않음

#### C-5. Entity Link 연동 (Renderer)
**수정 파일 3개:**

**파일 1**: `src/renderer/src/shared/lib/entity-link.ts`

```typescript
// LinkableEntityType에 'image' 추가 (preload와 별도로 renderer 측에도 정의됨)
// ENTITY_TYPE_LABEL에 추가
image: '이미지'

// ENTITY_TYPE_ICON에 추가
image: ImageIcon  // from lucide-react
```

**파일 2**: `src/renderer/src/features/entity-link/manage-link/lib/to-tab-options.ts`

```typescript
// toTabOptions() switch문에 case 추가
case 'image':
  return { type: 'image', pathname: `/folder/image/${linkedId}`, title }
```

> **누락 시**: Entity link에서 이미지 클릭해도 탭이 열리지 않음 (null 반환)

**파일 3**: `src/renderer/src/features/folder/manage-folder/ui/FolderContextMenu.tsx`

```typescript
// Props에 onImportImage 추가
onImportImage?: () => void

// 메뉴 항목 추가 (PDF 가져오기 다음)
<ContextMenuItem onClick={onImportImage}>
  <FileUp className="size-4 mr-2" />
  이미지 가져오기
</ContextMenuItem>
```

---

### Phase D: Renderer — 폴더 트리 통합

#### D-1. 트리 노드 타입
**파일**: `src/renderer/src/features/folder/manage-folder/model/types.ts`

```typescript
export interface ImageTreeNode {
  kind: 'image'
  id: string
  name: string
  relativePath: string
  description: string
  preview: string
  folderId: string | null
  order: number
}

export type WorkspaceTreeNode = FolderTreeNode | NoteTreeNode | CsvTreeNode | PdfTreeNode | ImageTreeNode
```

#### D-2. 트리 빌더
**파일**: `src/renderer/src/features/folder/manage-folder/model/use-workspace-tree.ts`

- `convertImage()` 함수 추가 (convertPdf 패턴)
- `buildWorkspaceTree()` 시그니처에 `imageFiles: ImageFileNode[]` 파라미터 추가
- `getLeafChildren()`에 Image 노드 병합 (notes + csvs + pdfs + images)
- `useWorkspaceTree()`에 `useImageFilesByWorkspace` query 추가

#### D-3. FolderTree.tsx 수정
**파일**: `src/renderer/src/features/folder/manage-folder/ui/FolderTree.tsx`

- Image import 뮤테이션 추가 (`useImportImageFile`)
- Image 삭제 뮤테이션 + 확인 Dialog
- Image move 뮤테이션 추가 (`useMoveImageFile`)
- NodeRenderer에 `kind === 'image'` 분기 추가
- 컨텍스트 메뉴에 "이미지 가져오기" 항목 추가
- **4개 가드에 Image 분기 추가** (PDF와 동일):
  - `disableDrop`: `|| parentNode?.data.kind === 'image'` 추가
  - `disableEdit`: `|| n.kind === 'image'` 추가
  - `onMove`: `else if (kind === 'image') { moveImageFile(...) }` 분기 추가
  - `onDelete`: `else if (kind === 'image') { removeImageFile(...) }` 분기 추가

#### D-4. Image 전용 UI
새 파일:
- `ImageNodeRenderer.tsx` — 트리 항목 렌더 (ImageIcon 아이콘, lucide-react)
- `ImageContextMenu.tsx` — 우클릭 메뉴 (PdfContextMenu 패턴 복제)

> **삭제 다이얼로그**: 별도 컴포넌트 불필요. 기존 `DeleteFolderDialog`를 재사용 (PDF/CSV/Note와 동일 패턴). FolderTree.tsx 내부에 `imageDeleteTarget` state + `DeleteFolderDialog` 렌더 추가.

---

### Phase E: Renderer — 이미지 뷰어 위젯

#### E-1. 라이브러리 설치

```bash
npm install react-zoom-pan-pinch
```

#### E-2. ImageViewer 위젯
**디렉토리**: `src/renderer/src/widgets/image-viewer/`

```
ui/ImageViewer.tsx         → 메인 래퍼 (TransformWrapper + TransformComponent + img)
ui/ImageToolbar.tsx        → 줌 컨트롤 바
model/use-image-viewer.ts  → 상태 관리 (scale, rotation)
index.ts                   → barrel export
```

**ImageViewer 핵심 구조**:
```tsx
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'

<TransformWrapper
  initialScale={1}
  minScale={0.1}
  maxScale={10}
  centerOnInit
>
  {({ zoomIn, zoomOut, resetTransform }) => (
    <>
      <ImageToolbar
        onZoomIn={() => zoomIn()}
        onZoomOut={() => zoomOut()}
        onReset={() => resetTransform()}
      />
      <TransformComponent
        wrapperStyle={{ width: '100%', height: '100%' }}
        contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <img src={objectUrl} alt={title} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      </TransformComponent>
    </>
  )}
</TransformWrapper>
```

**ImageToolbar 기능**:
- 줌 인/아웃 버튼
- 줌 리셋 (맞추기)
- 현재 줌 레벨 표시

**ArrayBuffer → ObjectURL 변환**:
```typescript
const objectUrl = useMemo(() => {
  if (!arrayBuffer) return ''
  const blob = new Blob([arrayBuffer])
  return URL.createObjectURL(blob)
}, [arrayBuffer])

useEffect(() => {
  return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
}, [objectUrl])
```

---

### Phase F: Renderer — 페이지 + Feature

#### F-1. ImagePage
**디렉토리**: `src/renderer/src/pages/image/`

```
ui/ImagePage.tsx  → TabContainer + ImageHeader + ImageViewer
index.ts          → barrel export
```

`useReadImageContent(workspaceId, imageId)` → ArrayBuffer를 ImageViewer에 전달.

**외부 변경 새로고침**: `IMAGE_EXTERNAL_CHANGED_EVENT` 커스텀 이벤트를 리스닝하여, 외부에서 이미지 파일이 교체되면 `useReadImageContent` 쿼리를 refetch하고 뷰어를 새로고침한다.

#### F-2. ImageHeader (Feature)
**디렉토리**: `src/renderer/src/features/image/view-image/`

```
ui/ImageHeader.tsx → TabHeader 재사용 (제목 편집, description 편집)
index.ts           → barrel export
```

PDF의 PdfHeader 패턴과 동일. `writeContent` 관련 로직 제외.

---

## 5. 구현 순서

| 순서 | Phase | 파일 수 | 설명 |
|------|-------|---------|------|
| 1 | A-1 | 2 | DB 스키마 + 마이그레이션 |
| 2 | A-2 | 1 | Repository |
| 3 | A-3 | 1 | Service (readByWorkspace + readByWorkspaceFromDb 포함) |
| 4 | A-4 | 1 | IPC 핸들러 (selectFile 포함) |
| 5 | A-5 | 1 | Leaf reindex 확장 (kind + 쿼리 + statement) |
| 6 | A-6 | 3 | Entity link 확장 (schema + service + preload types) |
| 7 | B-1~2 | 2 | Preload bridge (타입 + 구현) |
| 8 | A-7 | 2 | Workspace watcher + fs-utils 확장 |
| 9 | C-1 | 1 | TabType + Route + Icon 등록 |
| 10 | C-2 | 5 | Entity 레이어 (queries, types, watcher) |
| 11 | C-3 | 1 | 라우팅 등록 |
| 12 | C-4 | 1 | MainLayout에 useImageWatcher() 등록 |
| 13 | C-5 | 3 | Entity Link 연동 (label/icon + toTabOptions + FolderContextMenu) |
| 14 | D-1~4 | 4 | 폴더 트리 통합 (4개 가드 포함) |
| 15 | E-1~2 | 4 | 이미지 뷰어 위젯 |
| 16 | F-1~2 | 3 | 페이지 + Feature |

총 **~35개 파일** (신규 ~22, 수정 ~13)

---

## 6. 수정 대상 기존 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/main/db/schema/index.ts` | imageFiles export 추가 |
| `src/main/db/schema/entity-link.ts` | LinkableEntityType에 'image' 추가 + LINKABLE_ENTITY_TYPES 배열 추가 |
| `src/main/services/entity-link.ts` | findEntity() switch문에 case 'image' 추가 |
| `src/main/index.ts` | registerImageFileHandlers() 등록 |
| `src/main/lib/leaf-reindex.ts` | LeafSibling kind에 'image' 추가 + getLeafSiblings/reindexLeafSiblings 확장 |
| `src/main/lib/fs-utils.ts` | ImageFileEntry + readImageFilesRecursive + readImageFilesRecursiveAsync + IMAGE_EXTENSIONS 상수 |
| `src/main/services/workspace-watcher.ts` | Image reconciliation + watcher 확장 |
| `src/preload/index.ts` | image API bridge 구현 |
| `src/preload/index.d.ts` | ImageFileNode, ImageAPI 타입 추가 + LinkableEntityType 'image' 추가 |
| `src/renderer/src/shared/constants/tab-url.ts` | TabType, ROUTES, TAB_ICON 추가 |
| `src/renderer/src/app/layout/model/pane-routes.tsx` | ImagePage 라우트 추가 |
| `src/renderer/src/app/layout/MainLayout.tsx` | useImageWatcher() 등록 |
| `src/renderer/src/shared/lib/entity-link.ts` | LinkableEntityType, ENTITY_TYPE_LABEL, ENTITY_TYPE_ICON에 'image' 추가 |
| `src/renderer/src/features/entity-link/manage-link/lib/to-tab-options.ts` | toTabOptions() switch에 case 'image' 추가 |
| `src/renderer/src/features/folder/manage-folder/ui/FolderContextMenu.tsx` | onImportImage prop + 메뉴 항목 추가 |
| `src/renderer/src/features/folder/manage-folder/model/types.ts` | ImageTreeNode 추가 |
| `src/renderer/src/features/folder/manage-folder/model/use-workspace-tree.ts` | buildWorkspaceTree 시그니처 + Image 노드 빌더 |
| `src/renderer/src/features/folder/manage-folder/ui/FolderTree.tsx` | Image import/delete/move + 4개 가드 |

---

## 7. 검증

```bash
npm run typecheck       # 타입 체크
npm run test            # 전체 테스트
npm run dev             # 수동 테스트
```

수동 검증 항목:
- [ ] 이미지 파일 가져오기 (다이얼로그 → workspace 복사)
- [ ] 다중 이미지 동시 가져오기
- [ ] 폴더 트리에 이미지 표시 (아이콘 구분)
- [ ] 탭으로 이미지 열기
- [ ] 줌 인/아웃 (react-zoom-pan-pinch)
- [ ] 줌 리셋 (맞추기)
- [ ] 마우스 휠 줌
- [ ] 드래그 팬
- [ ] 이름 변경 (확장자 유지)
- [ ] 폴더 이동 (드래그)
- [ ] 삭제
- [ ] Workspace watcher (외부에서 이미지 추가/삭제 시 자동 동기화)
- [ ] 외부에서 이미지 파일 교체 시 뷰어 자동 새로고침
- [ ] 폴더 삭제 시 하위 이미지 레코드 정리
- [ ] 폴더 이름 변경 시 이미지 relativePath 갱신
- [ ] 7개 확장자 모두 정상 표시 (png, jpg, jpeg, gif, webp, bmp, svg)
- [ ] Entity link 연결/해제 정상 동작
- [ ] Entity link에서 이미지 클릭 시 탭으로 열기
- [ ] 앱 재시작 후 이미지 탭 복원
- [ ] 탭 스냅샷 저장/복원 시 이미지 탭 포함

---

## 8. 주의사항

- **다중 확장자 처리**: PDF(`.pdf` 1개)와 달리 이미지는 7개 확장자를 모두 매칭해야 함. `isImageFile()` 헬퍼 함수를 `IMAGE_EXTENSIONS` 상수와 함께 정의하여 일관되게 사용
- **rename 시 확장자 유지**: 사용자가 이름만 변경하면 원본 확장자(`.png`, `.jpg` 등)를 유지해야 함. `path.extname()`으로 추출
- **IPC Buffer 전달**: PDF와 동일하게 Electron structured clone이 Buffer → ArrayBuffer 자동 변환
- **ObjectURL 메모리 관리**: `URL.createObjectURL()`로 생성한 URL은 컴포넌트 언마운트 시 `URL.revokeObjectURL()`로 해제
- **SVG 파일**: SVG는 텍스트 기반이지만, 일관성을 위해 다른 이미지와 동일하게 바이너리로 처리
- **GIF 애니메이션**: `<img>` 태그가 자동으로 GIF 애니메이션을 지원하므로 추가 처리 불필요
- `leaf-reindex.ts`는 note/csv/pdf/image 4종의 혼합 정렬을 지원해야 함
- `workspace-watcher.ts` Step 2에서 이미지 파일을 폴더 이벤트에서 제외해야 함
- `FolderTree.tsx`의 `onMove`/`onDelete`에 Image 분기가 없으면 폴더 move/delete로 fallthrough되므로 반드시 추가
- `own-write-tracker`는 import/rename/move/delete 시에만 markOwnWrite (writeContent 없으므로)
- `selectFile()` IPC는 `multiSelections` 옵션으로 다중 선택 지원. 반환 타입 `string[]` (PDF의 `string`과 다름)
- `entity-link.ts` **서비스**의 `findEntity()` switch문에 `case 'image'` 반드시 추가 — 누락 시 image entity link 생성/조회 시 런타임 에러
- **title 추출 5곳 전부 동적 변환 필수**: PDF는 `.replace(/\.pdf$/, '')`로 하드코딩하지만, 이미지는 `path.basename(name, path.extname(name))`으로 동적 추출. 서비스의 `readByWorkspace`(2곳), `import`(1곳), `rename`(1곳), `move`(1곳) 총 5곳 + watcher의 `title` 추출에도 동일 적용
- `move()` 메서드의 `reindexLeafSiblings` 호출에서 `kind: 'image'`로 지정 (PDF는 `kind: 'pdf'`). 누락 시 reindex가 pdf update statement로 실행됨
- `handleImportImage`는 `mutateAsync` 사용 (PDF의 `mutate`와 다름) — for-of 루프로 순차 import 후 마지막 결과만 탭 열기
- `IMAGE_EXTENSIONS`와 `isImageFile()`은 **fs-utils.ts에 정의**하여 service, watcher 등에서 공용 import
- `MainLayout.tsx`에 `useImageWatcher()` 반드시 등록 — 누락 시 외부 이미지 변경이 UI에 반영되지 않음
- `to-tab-options.ts`에 `case 'image'` 반드시 추가 — 누락 시 entity link 클릭 시 탭 열기 실패 (null 반환)
- Renderer 측 `entity-link.ts`의 `ENTITY_TYPE_LABEL`과 `ENTITY_TYPE_ICON`에 'image' 추가 필요 (main/preload와 별개 파일)
- `FolderContextMenu.tsx`에 `onImportImage` prop + 메뉴 항목 추가 필요
- 삭제 다이얼로그는 별도 컴포넌트 불필요 — 기존 `DeleteFolderDialog` 재사용 (PDF/CSV/Note와 동일 패턴)
- 탭 스냅샷/복원은 `TabType`을 명시적으로 직렬화하므로 추가 코드 불필요 (자동 지원)
