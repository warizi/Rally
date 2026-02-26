# Note Feature Plan

## Overview

Rally 앱에 Note 기능을 추가한다.
Folder와 동일하게 **파일시스템이 content의 source of truth**이고, SQLite는 메타데이터(description, preview, order)와 DB 관계(folderId 링크)를 위한 stable identity를 저장한다.

사이드바 파일 탐색기(FolderTree)에 노트가 함께 표시되고, 노트를 클릭하면 **오른쪽 탭(openRightTab)** 에 Milkdown 에디터가 열린다.

---

## 아키텍처 원칙

```
파일시스템 (workspace.path/**/*.md) → 실제 노트 내용 (content)
SQLite (notes 테이블)                → stable id + 메타데이터 (description, preview, order)
FolderTree (Renderer)                → Folder + Note 혼합 트리 렌더링
```

### 폴더 기능과의 비교

| 항목           | Folder                        | Note                                   |
| -------------- | ----------------------------- | -------------------------------------- |
| FS entity      | 디렉토리                      | `.md` 파일                             |
| DB 주요 역할   | color, order, stable id       | description, preview, order, stable id |
| 트리 표시      | react-arborist (children)     | react-arborist (leaf node)             |
| 외부 변경 감지 | @parcel/watcher (폴더 이벤트) | @parcel/watcher (파일 이벤트)          |
| 생성 UX        | Dialog (이름 입력)            | 즉시 생성 ("새로운 노트")              |
| 클릭 동작      | toggle (열기/닫기)            | openRightTab (에디터 열기)             |

---

## 데이터 스키마

### SQLite `notes` 테이블

| 필드           | 타입                       | 설명                                                 |
| -------------- | -------------------------- | ---------------------------------------------------- |
| `id`           | text (PK)                  | nanoid — DB 관계 전용 stable key                     |
| `workspaceId`  | text NOT NULL              | `workspaces.id` 참조 (onDelete: cascade)             |
| `folderId`     | text NULL                  | `folders.id` 참조 (onDelete: set null) — null = 루트 |
| `relativePath` | text NOT NULL              | workspace 루트 기준 상대경로 (`"folder/note.md"`)    |
| `title`        | text NOT NULL              | 파일명 (`.md` 제외), 화면 표시용                     |
| `description`  | text NOT NULL DEFAULT ''   | 사용자가 작성하는 짧은 설명 (메타데이터)             |
| `preview`      | text NOT NULL DEFAULT ''   | 내용 앞부분 자동 추출 (최대 200자)                   |
| `order`        | integer NOT NULL DEFAULT 0 | 같은 폴더 내 정렬 순서                               |
| `createdAt`    | integer (timestamp_ms)     |                                                      |
| `updatedAt`    | integer (timestamp_ms)     |                                                      |

- unique constraint: `(workspaceId, relativePath)`
- `relativePath`는 항상 `/` 구분자로 정규화 (Windows `\` 변환)
- 숨김 파일(`.` 시작)은 트리에서 제외

### 이중 식별자 전략 (folder와 동일)

| 필드           | 역할                | 안정성                |
| -------------- | ------------------- | --------------------- |
| `id` (nanoid)  | DB 관계용 stable id | 항상 불변             |
| `relativePath` | 파일시스템 위치     | rename/move 시 변경됨 |

---

## IPC 인터페이스

### 채널 목록

```
note:readByWorkspace (workspaceId)                → NoteNode[]
note:create         (workspaceId, folderId?, name) → NoteNode
note:rename         (workspaceId, noteId, newName) → NoteNode
note:remove         (workspaceId, noteId)          → void
note:readContent    (workspaceId, noteId)          → string
note:writeContent   (workspaceId, noteId, content) → void  (preview 자동 업데이트)
note:updateMeta     (workspaceId, noteId, { description? }) → NoteNode
```

### Push 이벤트 (Main → Renderer)

```
'note:changed' (workspaceId)
  // @parcel/watcher .md 파일 변경 감지 → renderer에서 readByWorkspace 재요청
```

### Preload API 타입

```typescript
interface NoteNode {
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

interface NoteAPI {
  readByWorkspace: (workspaceId: string) => Promise<IpcResponse<NoteNode[]>>
  create: (
    workspaceId: string,
    folderId: string | null,
    name: string
  ) => Promise<IpcResponse<NoteNode>>
  rename: (workspaceId: string, noteId: string, newName: string) => Promise<IpcResponse<NoteNode>>
  remove: (workspaceId: string, noteId: string) => Promise<IpcResponse<void>>
  readContent: (workspaceId: string, noteId: string) => Promise<IpcResponse<string>>
  writeContent: (workspaceId: string, noteId: string, content: string) => Promise<IpcResponse<void>>
  updateMeta: (
    workspaceId: string,
    noteId: string,
    data: { description?: string }
  ) => Promise<IpcResponse<NoteNode>>
  onChanged: (callback: (workspaceId: string) => void) => () => void // push 구독
}
```

---

## Service Layer 상세 (Main Process)

### `noteService.readByWorkspace(workspaceId)`

folder의 `readTree`와 유사한 lazy upsert 패턴:

```
1. workspace.path 접근 가능 여부 확인
2. fs에서 .md 파일 재귀 탐색 (숨김 제외, 심볼릭 링크 제외)
3. DB의 현재 notes rows 조회
4. fs에 있고 DB에 없는 것 → lazy upsert (folderId는 relativePath에서 폴더 DB lookup으로 결정)
5. DB에 있고 fs에 없는 것 → orphan 삭제
6. 최신 DB rows 반환 (NoteNode[])
```

### `noteService.create(workspaceId, folderId, name)`

```
1. workspace 조회 (NotFoundError)
2. folderId 있으면 folder 조회 → relativePath 결정
3. resolveNameConflict(parentAbs, (name.trim() || '새로운 노트') + '.md')로 최종 파일명 결정
   → 반환값 예: '새로운 노트 (1).md', title = '.md' 제거한 순수 이름으로 저장
4. 빈 .md 파일 생성 (fs.writeFileSync(absPath, ''))
5. DB insert (folderId, relativePath, title, description='', preview='')
6. NoteNode 반환
```

### `noteService.rename(workspaceId, noteId, newName)`

```
1. note 조회, workspace 조회
2. 같은 이름이면 no-op
3. resolveNameConflict(parentAbs, newName.trim() + '.md') 로 최종 파일명 결정
4. fs.renameSync(oldAbs, newAbs)
5. DB relativePath, title 업데이트
6. NoteNode 반환
```

### `noteService.remove(workspaceId, noteId)`

```
1. note 조회, workspace 조회
2. fs.unlinkSync(absPath)
3. DB row 삭제
```

### `noteService.readContent(workspaceId, noteId)`

```
1. note 조회, workspace 조회
2. fs.readFileSync(absPath, 'utf-8') → string 반환
```

### `noteService.writeContent(workspaceId, noteId, content)`

```
1. note 조회, workspace 조회
2. fs.writeFileSync(absPath, content, 'utf-8')
3. preview = content.slice(0, 200).replace(/\s+/g, ' ').trim()
4. DB preview, updatedAt 업데이트
```

### 이름 충돌 해결 (`resolveNameConflict`)

folder와 동일한 패턴, 단 확장자 포함:

```
"새로운 노트.md" 존재 → "새로운 노트 (1).md" 시도
"새로운 노트 (1).md" 존재 → "새로운 노트 (2).md" 시도
```

내부적으로 `title`은 `.md` 없는 순수 이름 (`"새로운 노트 (1)"`)으로 저장.

> **구현 주의**: `folder.ts`의 `resolveNameConflict`는 이름에 확장자가 없다고 가정한다 (`/^(.*?) \((\d+)\)$/` 패턴).
> Note에서는 `.md` 확장자 포함 이름을 처리해야 하므로, `fs-utils.ts`로 추출 시 확장자를 인식하는 패턴 수정 필요:
>
> - 폴더: `"이름 (1)"` 패턴 → `"이름 (N)"`
> - 노트: `"이름 (1).md"` 패턴 → `"이름 (N).md"` (`.md` 앞의 `(N)` 처리)

> **구현 주의**: `folder.ts`의 `resolveNameConflict`는 해당 파일 내 **private 함수** (export 없음).
> Note 서비스에서 재사용하려면 `src/main/lib/fs-utils.ts`로 추출하거나, note 서비스 내에서 독자적으로 구현해야 한다.
> **권장**: `src/main/lib/fs-utils.ts`로 두 함수를 공유 유틸로 추출
>
> - `resolveNameConflict(parentAbs, desiredName): string`
> - `readMdFilesRecursive(absBase, parentRel): MdFileEntry[]` (신규, 아래 참조)

### `.md` 파일 탐색 함수 (`readMdFilesRecursive`) — 신규 필요

`folder.ts`의 `readDirRecursive`는 **디렉토리 전용** (`!entry.isDirectory()` 시 스킵).
노트를 위해 `.md` 파일을 탐색하는 별도 함수가 필요하다.

```typescript
// src/main/lib/fs-utils.ts (신규 파일 or 서비스 내 구현)
interface MdFileEntry {
  name: string // 파일명 (확장자 포함, "note.md")
  relativePath: string // '/' 구분자 ("docs/note.md")
}

function readMdFilesRecursive(absBase: string, parentRel: string): MdFileEntry[] {
  // readdirSync → .md 파일 수집 + 하위 디렉토리 재귀
  // 숨김 파일·디렉토리 (. 시작) 제외
  // 심볼릭 링크 제외
  // .git, .obsidian 등 숨김 디렉토리 내부 탐색 안 함
}
```

### folderId 자동 결정 (lazy upsert 시)

readByWorkspace의 lazy upsert에서:

```
relativePath = "docs/meeting.md"
→ parentRel = "docs"
→ folderRepository.findByRelativePath(workspaceId, "docs")?.id → folderId
→ 없으면 null (루트 노트)
```

---

## Renderer Layer (FSD 구조)

### FSD 아키텍처 준수 분석

ESLint `eslint.config.mjs`의 `boundaries/element-types` 규칙을 기준으로 Import 허용 방향을 확인했다.

```
// eslint.config.mjs (실제 설정)
{ from: 'features', allow: ['entities', 'shared'] }
```

| Import 방향                           | 허용 여부 | 이유                            |
| ------------------------------------- | --------- | ------------------------------- |
| `features/folder` → `entities/note`   | ✅ 허용   | features는 entities import 가능 |
| `features/folder` → `entities/folder` | ✅ 허용   | 동일                            |
| `features/folder` → `features/note`   | ❌ 금지   | features → features 금지        |
| `entities/note` → `entities/folder`   | ❌ 금지   | entities → entities 금지        |
| `pages/note` → `entities/note`        | ✅ 허용   | pages는 entities import 가능    |
| `pages/note` → `features/folder`      | ✅ 허용   | pages는 features import 가능    |

**핵심 결론: note UI 컴포넌트를 별도 `features/note/` 피처로 분리하면 안 된다.**

만약 `NoteNodeRenderer`를 `features/note/` 에 두면:

- `FolderTree.tsx` (`features/folder/`) 에서 `features/note/` 를 import → **ESLint 에러**

**해결책: note 관련 UI 컴포넌트를 `features/folder/manage-folder/` 내에 공존 배치**

- `NoteNodeRenderer.tsx`, `NoteContextMenu.tsx` → `features/folder/manage-folder/ui/` 내부
- 이 컴포넌트들이 `entities/note`에서 타입을 import → **ESLint 허용**
- `FolderTree.tsx`가 같은 feature 내 컴포넌트를 import → **문제 없음**

### 레이어 구성

```
entities/note/
  model/types.ts          → NoteNode 타입
  api/queries.ts          → useNotesByWorkspace, useCreateNote, useRenameNote, useRemoveNote,
                            useReadNoteContent, useWriteNoteContent, useUpdateNoteMeta
  index.ts                → barrel export

features/folder/manage-folder/
  model/
    use-workspace-tree.ts → useFolderTree + useNotesByWorkspace 병합 훅
    types.ts              → WorkspaceTreeNode union type (FolderTreeNode | NoteTreeNode)
  ui/
    FolderTree.tsx        → Tree<WorkspaceTreeNode> (리팩토링)
    FolderNodeRenderer.tsx → 기존 유지
    NoteNodeRenderer.tsx  → 노트 leaf 노드 렌더러 (NEW, context menu 별도)
    NoteContextMenu.tsx   → 노트 전용 컨텍스트 메뉴 (이름 변경/삭제, NEW)
    FolderContextMenu.tsx → "노트 추가하기" 항목 추가
    (기존 Dialog 파일들 유지)

pages/note/
  ui/NotePage.tsx         → Milkdown 에디터 페이지
  index.ts                → barrel export
```

### WorkspaceTreeNode 타입

```typescript
// features/folder/manage-folder/model/types.ts

export type WorkspaceTreeNode = FolderTreeNode | NoteTreeNode

export interface FolderTreeNode {
  kind: 'folder'
  id: string
  name: string
  relativePath: string
  color: string | null
  order: number
  children: WorkspaceTreeNode[] // 하위 폴더 + 노트 혼합
}

export interface NoteTreeNode {
  kind: 'note'
  id: string
  name: string
  relativePath: string
  description: string
  preview: string
  folderId: string | null
  order: number
}
```

### useWorkspaceTree 훅

```typescript
// features/folder/manage-folder/model/use-workspace-tree.ts
// entities/folder + entities/note 데이터를 WorkspaceTreeNode로 병합

function buildWorkspaceTree(folders: FolderNode[], notes: NoteNode[]): WorkspaceTreeNode[] {
  // 1. FolderNode → FolderTreeNode 변환 (재귀)
  // 2. 각 FolderTreeNode의 children 끝에 해당 folderId의 notes 추가 (order 기준 정렬)
  // 3. 루트 노트 (folderId=null)는 맨 끝에 추가
  // 4. 노트는 항상 폴더들 뒤에 표시
}

// 중요: NoteNode → NoteTreeNode 변환 시 필드명 주의
// NoteNode (Preload API): title: string
// NoteTreeNode (FSD model): name: string
// → 변환: name: note.title
```

### FolderTree 리팩토링

```tsx
// Tree<WorkspaceTreeNode>로 변경
<Tree<WorkspaceTreeNode>
  data={workspaceTree}
  idAccessor="id"
  childrenAccessor={(n) => (n.kind === 'folder' ? n.children : null)}
  // DnD는 폴더만 허용 (노트 DnD는 v1에서 제외)
  disableDrop={({ dragNodes }) => dragNodes.some((n) => n.data.kind === 'note')}
>
  {NodeRenderer}
</Tree>
```

NodeRenderer에서 `node.data.kind`로 분기:

- `'folder'` → `<FolderContextMenu>` + `<FolderNodeRenderer>` (기존과 동일)
- `'note'` → `<NoteContextMenu>` + `<NoteNodeRenderer>` (별도 파일, 폴더와 동일한 분리 구조)

### FolderContextMenu 변경

```
기존:          하위 폴더 생성 / 이름 변경 / 색상 변경 / ─── / 삭제
변경 후:       하위 폴더 생성 / 📝 노트 추가하기 / ─── / 이름 변경 / 색상 변경 / ─── / 삭제
```

`Props`에 `onCreateNote: () => void` 추가.
"노트 추가하기" 클릭 → 즉시 `note:create(workspaceId, folderId, '새로운 노트')` 호출 → 성공 시 `openRightTab` 실행

### NoteNodeRenderer + NoteContextMenu

`FolderNodeRenderer` / `FolderContextMenu`와 동일한 분리 구조:

**`NoteNodeRenderer.tsx`** (FolderNodeRenderer와 유사한 단순 렌더러):

```tsx
// NodeRendererProps<NoteTreeNode> + onOpen prop 수신
// node.data는 NoteTreeNode로 타입 좁힘 필요 (FolderTree에서 kind 체크 후 캐스팅)
export function NoteNodeRenderer({ node, style, dragHandle, onOpen }: NoteNodeRendererProps) {
  return (
    <div
      ref={dragHandle}
      style={style}
      className="flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer hover:bg-accent select-none"
      onClick={onOpen}
    >
      <Notebook className="ml-1 size-4 shrink-0 text-muted-foreground" />
      <span className="text-sm truncate">{node.data.name}</span>
    </div>
  )
}
```

> **TypeScript 주의**: `NoteNodeRenderer`의 `node` 타입은 `NodeRendererProps<NoteTreeNode>`이어야 한다.
> FolderTree의 NodeRenderer에서 `kind === 'note'` 체크 후 `props as unknown as NodeRendererProps<NoteTreeNode>`로 캐스팅하거나, `WorkspaceTreeNode`를 받아 내부에서 narrowing.

**FolderTree NodeRenderer에서의 조합 구조:**

```tsx
if (props.node.data.kind === 'note') {
  return (
    <NoteContextMenu
      onRename={() => setNoteRenameTarget({ id: props.node.data.id, name: props.node.data.name })}
      onDelete={() => setNoteDeleteTarget({ id: props.node.data.id, name: props.node.data.name })}
    >
      <NoteNodeRenderer
        {...(props as unknown as NodeRendererProps<NoteTreeNode>)}
        onOpen={() =>
          openRightTab(
            {
              type: 'note',
              title: props.node.data.name,
              pathname: `/folder/note/${props.node.data.id}`
            },
            sourcePaneId
          )
        }
      />
    </NoteContextMenu>
  )
}
```

노트 컨텍스트 메뉴 콜백(`onRename`, `onDelete`)은 `FolderTree.tsx`에서 상태로 관리하고 props로 주입.

### 노트 rename/delete 다이얼로그 (FolderTree 상태 관리)

`FolderTree.tsx`에 다음 state 추가:

```typescript
const [noteRenameTarget, setNoteRenameTarget] = useState<{ id: string; name: string } | null>(null)
const [noteDeleteTarget, setNoteDeleteTarget] = useState<{ id: string; name: string } | null>(null)
```

**컴포넌트 재사용 방침:**

- rename 다이얼로그: 기존 `FolderNameDialog` 재사용 (title="노트 이름 변경")
- delete 다이얼로그: 기존 `DeleteFolderDialog` 재사용하거나, 별도 `DeleteNoteDialog` 생성

### Tab 라우팅

- 라우트: `ROUTES.NOTE_DETAIL = '/folder/note/:noteId'` (이미 정의됨)
- 탭 타입: `'note'` (이미 정의됨)
- 탭 아이콘: `Notebook` — `createTab`에서 `icon: options.type`으로 자동 설정
- `pane-routes.tsx`에 `NotePage` 추가
- `TabOptions` 실제 인터페이스: `{ type, pathname, title, searchParams?, pinned? }`

```typescript
useTabStore.getState().openRightTab(
  {
    type: 'note', // TabOptions.type (not tabType)
    title: note.title,
    pathname: `/folder/note/${note.id}`
  },
  sourcePaneId
)
```

### sourcePaneId 획득 전략

NoteNodeRenderer는 `openRightTab(options, sourcePaneId)`에서 `sourcePaneId`가 필요하다.

```
FolderPage (tabId: props.tabId 수신)
  → FolderTree (tabId prop 추가)
    → useWorkspaceTree + NodeRenderer 콜백에 tabId 전달
      → openRightTab 시 findPaneByTabId(tabId)?.id 로 sourcePaneId 획득
```

**변경 필요 파일:**

- `FolderPage.tsx`: `{ tabId }: PageProps` 수신 → `<FolderTree workspaceId={workspaceId} tabId={tabId} />`
  - `PageProps.tabId`는 `string | undefined` (optional) → `tabId ?? ''` 또는 guard 처리
- `FolderTree.tsx`: `Props` 에 `tabId: string` 추가 → `useCallback` 클로저로 `workspaceId`, `tabId`, setter들 캡처
  - `const sourcePaneId = useTabStore(state => state.findPaneByTabId(tabId))?.id ?? ''`

**NodeRenderer 클로저 캡처 패턴 (전체 구조):**

```typescript
const NodeRenderer = useCallback(
  (props: NodeRendererProps<WorkspaceTreeNode>) => {
    if (props.node.data.kind === 'note') {
      return (
        <NoteContextMenu
          onRename={() => setNoteRenameTarget({ id: props.node.data.id, name: props.node.data.name })}
          onDelete={() => setNoteDeleteTarget({ id: props.node.data.id, name: props.node.data.name })}
        >
          <NoteNodeRenderer
            {...(props as unknown as NodeRendererProps<NoteTreeNode>)}  // kind 체크 후 안전한 캐스팅
            onOpen={() => openRightTab(
              { type: 'note', title: props.node.data.name, pathname: `/folder/note/${props.node.data.id}` },
              sourcePaneId
            )}
          />
        </NoteContextMenu>
      )
    }
    return (
      <FolderContextMenu
        onCreateNote={() => handleCreateNote(props.node.id)}
        onRename={() => setRenameTarget({ id: props.node.id, name: props.node.data.name })}
        onEditColor={() => setColorTarget({ id: props.node.id, color: (props.node.data as FolderTreeNode).color })}
        onDelete={() => setDeleteTarget({ id: props.node.id, name: props.node.data.name })}
      >
        <FolderNodeRenderer {...(props as unknown as NodeRendererProps<FolderTreeNode>)} />
      </FolderContextMenu>
    )
  },
  [workspaceId, sourcePaneId] // useState setters는 stable이므로 deps 불필요
)
```

### NotePage (Milkdown 에디터)

```
pages/note/ui/NotePage.tsx
  - TabContainer 내부
  - noteId: params.noteId에서 추출
  - useReadNoteContent(workspaceId, noteId)
      → staleTime: Infinity (창 포커스 복귀 시 자동 refetch 비활성화)
      → 편집 중 React Query가 내용 덮어쓰는 것 방지
  - Milkdown 에디터 렌더링 (초기값 = readContent 결과)
  - 내용 변경 시 debounce(800ms) → useWriteNoteContent 호출 (자동 저장)
  - 제목 표시: note.title (useNotesByWorkspace 또는 별도 메타 query에서)
  - note not found 시: 에러 메시지 표시 (삭제된 노트 복원 탭 방어)
```

---

## Milkdown Editor 통합

### 설치 패키지 현황

이미 설치된 패키지 (`package.json` 확인):

```
@milkdown/core              ^7.18.0  ✅
@milkdown/preset-commonmark ^7.18.0  ✅
@milkdown/react             ^7.18.0  ✅
@milkdown/theme-nord        ^7.18.0  ✅
```

추가 선언 필요:

```bash
npm install @milkdown/plugin-listener   # package.json 명시적 선언 (이미 설치됨)
```

> **주의**: `@milkdown/plugin-listener@7.18.0`은 `@milkdown/kit`의 transitive dependency로 이미 `node_modules`에 존재한다.
> `npm install` 없이도 import 가능하지만, 직접 사용하는 패키지는 `package.json`에 명시적으로 선언하는 것이 best practice.

### 기본 구조

```typescript
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core'
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
import { commonmark } from '@milkdown/preset-commonmark'
import { listener, listenerCtx } from '@milkdown/plugin-listener'

function NoteEditor({ initialContent, onSave }: Props) {
  useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, initialContent)
        ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
          onSave(markdown) // 앱 레벨 debounce 처리는 NoteEditor 외부에서
        })
      })
      .use(commonmark)
      .use(listener)
  )
  return <Milkdown />
}

// markdownUpdated 내부 동작:
// - plugin-listener가 내장 200ms debounce 적용 후 콜백 호출
// - 앱 레벨에서 추가 debounce(800ms) 적용 → 실제 writeContent IPC 호출
// - 총 지연: ~200ms(플러그인) + 800ms(앱) = 약 1초 후 파일 저장
```

---

## 외부 파일 변경 감지 (Watcher) — v1 지원

folder와 동일하게 `@parcel/watcher`를 사용해 외부 `.md` 파일 변경을 감지한다.

### 네이밍: `folder-watcher.ts` → `workspace-watcher.ts`

현재 `folder-watcher.ts`는 폴더 이벤트만 처리하므로 이름이 정확하다.
하지만 note 파일 이벤트까지 처리하게 되면 **폴더+노트 = 워크스페이스 전체를 감시**하는 역할이므로 이름 변경이 필요하다.

| 변경 전                                  | 변경 후                                  |
| ---------------------------------------- | ---------------------------------------- |
| `src/main/services/folder-watcher.ts`    | `src/main/services/workspace-watcher.ts` |
| `FolderWatcherService`                   | `WorkspaceWatcherService`                |
| `folderWatcher` (export)                 | `workspaceWatcher` (export)              |
| `ipc/folder.ts`의 `folderWatcher` import | `workspaceWatcher` import로 업데이트     |

### 구현 전략: `workspace-watcher.ts`에서 단일 구독으로 처리

기존 `WorkspaceWatcherService`(구 Folder)는 이미 workspace를 구독 중이므로, **동일 구독에서 `.md` 파일 이벤트도 처리**한다. 별도 watcher 추가 없이 단일 OS 레벨 구독 유지.

```
applyEvents() 확장:
  - 기존: isDirectory → folderRepository 업데이트 + pushFolderChanged
  - 추가: .endsWith('.md') && !basename.startsWith('.') → pushNoteChanged
```

**처리 방식 (단순화):**

- `.md` 파일 이벤트 → `pushNoteChanged(workspaceId)` 만 호출
- DB 실제 sync는 renderer에서 `readByWorkspace` 재호출 시 lazy upsert로 처리
- (fullReconciliation은 폴더 DB 관리용이므로 note는 변경 불필요)

**숨김 파일 필터링:** `path.basename(event.path).startsWith('.')` → 무시

### 추가 구현 항목

| 항목                       | 파일                                              |
| -------------------------- | ------------------------------------------------- |
| `pushNoteChanged()` 메서드 | `workspace-watcher.ts` 추가                       |
| `'note:changed'` IPC 채널  | preload bridge에 추가                             |
| `onChanged` preload 메서드 | `NoteAPI` 인터페이스 추가                         |
| `useNoteWatcher` 훅        | `entities/note/model/use-note-watcher.ts` 신규    |
| `useNoteWatcher()` 호출    | `MainLayout.tsx` 등록 (`useFolderWatcher()` 옆에) |

### Renderer push 이벤트 패턴 (folder와 동일)

```typescript
// entities/note/model/use-note-watcher.ts
export function useNoteWatcher(): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    const unsub = window.api.note.onChanged((workspaceId: string) => {
      queryClient.invalidateQueries({ queryKey: ['note', 'workspace', workspaceId] })
    })
    return unsub
  }, [queryClient])
}
```

### Preload NoteAPI 추가 메서드

```typescript
onChanged: (callback: (workspaceId: string) => void) => () => void
```

---

## 예외 처리 및 에러 시나리오 (folder 로직 참조)

| 시나리오                          | 처리 방식                                              |
| --------------------------------- | ------------------------------------------------------ |
| workspace.path 접근 불가          | ValidationError → IpcError → UI 에러 메시지            |
| noteId로 DB 조회 실패             | NotFoundError                                          |
| .md 파일 읽기 실패 (외부 삭제 등) | NotFoundError → IpcError → 에디터에서 "파일 없음" 표시 |
| 이름 중복                         | resolveNameConflict로 자동 suffix 부여 (n)             |
| 제목 빈 문자열                    | `'새로운 노트'` fallback                               |
| 폴더 삭제 시 note.folderId        | `onDelete: set null` → 루트 노트로 이동 (orphan 방지)  |
| 외부에서 .md 파일 삭제            | readByWorkspace 재호출 시 orphan 삭제 (lazy sync)      |
| DnD (노트 드래그)                 | v1 미지원 — disableDrop으로 차단                       |

---

## 구현 범위 (Implementation Scope)

### Main Process

1. `src/main/db/schema/note.ts` — notes 테이블 Drizzle 스키마
2. `src/main/db/schema/index.ts` — notes export 추가
3. `npm run db:generate && npm run db:migrate` — 마이그레이션
4. `src/main/repositories/note.ts` — CRUD (findByWorkspaceId, findById, create, update, delete, deleteOrphans)
5. `src/main/services/note.ts` — fs I/O + DB merge + 이름 충돌 해결
   - `readByWorkspace` (lazy upsert 포함)
   - `create`, `rename`, `remove`, `readContent`, `writeContent`, `updateMeta`
6. `src/main/ipc/note.ts` — IPC 핸들러 등록 (handle() 래퍼)
7. `src/main/index.ts` — registerNoteHandlers() 호출 추가

### Preload

8. `src/preload/index.d.ts` — NoteNode, NoteAPI 타입 추가 + `window.api.note` 선언

### Renderer — Entity

9. `src/renderer/src/entities/note/model/types.ts` — NoteNode 타입
10. `src/renderer/src/entities/note/api/queries.ts` — React Query hooks
11. `src/renderer/src/entities/note/model/use-note-watcher.ts` — push 이벤트 구독 훅 (folder 패턴 동일)
12. `src/renderer/src/entities/note/index.ts` — barrel export

### Renderer — Layout

12a. `src/renderer/src/app/layout/MainLayout.tsx` — `useNoteWatcher()` 등록:

```tsx
useFolderWatcher() // 기존
useNoteWatcher() // 추가
```

### Renderer — Feature (FolderTree 리팩토링)

13. `src/renderer/src/features/folder/manage-folder/model/types.ts` — WorkspaceTreeNode union 타입
14. `src/renderer/src/features/folder/manage-folder/model/use-workspace-tree.ts` — 병합 훅
15. `src/renderer/src/features/folder/manage-folder/ui/FolderTree.tsx` — 변경 사항:
    - `Props`에 `tabId: string` 추가 (sourcePaneId 계산용)
    - `Tree<WorkspaceTreeNode>` 변경
    - 노트 rename/delete target state 추가
    - 노트 관련 mutation hook 추가
16. `src/renderer/src/features/folder/manage-folder/ui/FolderContextMenu.tsx` — `onCreateNote: () => void` prop 추가
17. `src/renderer/src/features/folder/manage-folder/ui/NoteNodeRenderer.tsx` — 새 노트 렌더러 (FolderNodeRenderer와 동일한 단순 렌더러 구조)
18. `src/renderer/src/features/folder/manage-folder/ui/NoteContextMenu.tsx` — 노트 전용 컨텍스트 메뉴 (이름 변경/삭제)
19. `src/renderer/src/features/folder/manage-folder/index.ts` — 업데이트
20. `src/renderer/src/pages/folder/ui/FolderPage.tsx` — `tabId` prop 수신 → FolderTree에 전달

### Renderer — Page

21. `src/renderer/src/pages/note/ui/NotePage.tsx` — Milkdown 에디터 페이지
22. `src/renderer/src/pages/note/index.ts` — barrel export

### 라우팅 연결

23. `src/renderer/src/app/layout/model/pane-routes.tsx` — NotePage 라우트 추가 (`ROUTES.NOTE_DETAIL`)

### 패키지 설치

24. `npm install @milkdown/plugin-listener` — package.json 명시적 선언 (node_modules엔 이미 존재; transitive dep)

### Main Process — Watcher 확장

25. `src/main/services/workspace-watcher.ts` — `folder-watcher.ts` 대체 신규 파일; `.md` 파일 이벤트 처리 + `pushNoteChanged()` 추가; `WorkspaceWatcherService` / `workspaceWatcher` export

- `src/main/ipc/folder.ts` — `folderWatcher` → `workspaceWatcher` import 경로 업데이트

### 공유 유틸 (신규)

26. `src/main/lib/fs-utils.ts` — `resolveNameConflict`, `readMdFilesRecursive` 공유 함수
    - `folder.ts`에서 `resolveNameConflict` 이동 (folder.ts import 경로 업데이트)

---

## 구현 우선순위 (권장 순서)

```
[0단계] 공유 유틸 + 패키지
  fs-utils.ts 신규 (resolveNameConflict 이동, readMdFilesRecursive 추가)
  npm install @milkdown/plugin-listener

[1단계] DB + Main Process
  schema → migration → repository → service → ipc → index.ts 등록
  workspace-watcher.ts 신규 (folder-watcher.ts 대체, .md 이벤트 + pushNoteChanged 추가)

[2단계] Preload 타입
  NoteNode, NoteAPI (onChanged 포함) 추가

[3단계] entities/note (React Query + Watcher)
  types → queries → use-note-watcher → index
  MainLayout.tsx에 useNoteWatcher() 등록

[4단계] FolderTree 리팩토링
  WorkspaceTreeNode 타입 → useWorkspaceTree → FolderTree 수정 →
  NoteNodeRenderer + NoteContextMenu → FolderContextMenu 수정
  FolderPage: tabId 수신

[5단계] NotePage + 라우팅
  NotePage (Milkdown) → pane-routes.tsx 추가

[6단계] 통합 테스트 (수동)
  노트 생성 → 트리 표시 → 클릭 시 에디터 → 내용 자동 저장
  → 외부에서 .md 파일 수정 → 트리 자동 갱신 확인
```

---

## Success Criteria

- [ ] 노트 생성 시 workspace.path에 실제 `.md` 파일이 생성됨
- [ ] 이름 중복 시 `(n)` suffix 자동 부여 ("새로운 노트", "새로운 노트 (1)", ...)
- [ ] FolderTree에 폴더와 노트가 함께 표시됨 (폴더 하위에 해당 폴더의 노트 표시)
- [ ] 폴더 컨텍스트 메뉴에 "노트 추가하기" 표시 및 동작
- [ ] 노트 생성 후 자동으로 오른쪽 탭(openRightTab)에 에디터 열림
- [ ] 노트 클릭 시 오른쪽 탭에 Milkdown 에디터 열림
- [ ] 에디터에서 내용 수정 시 debounce 후 실제 .md 파일에 반영
- [ ] DB와 FS 동기화: readByWorkspace 호출 시 orphan 정리 + lazy upsert
- [ ] 폴더 삭제 시 하위 노트의 folderId가 null로 변경됨 (데이터 유실 없음)
- [ ] 노트 삭제 시 실제 .md 파일도 삭제됨
- [ ] 노트 이름 변경 시 파일명도 변경됨
- [ ] FSD Import 규칙 준수 (상위 레이어에서 하위 레이어만 import)
- [ ] TypeScript 컴파일 에러 없음
- [ ] Milkdown 에디터 정상 렌더링 (CommonMark 지원)
- [ ] workspace.path 접근 불가 시 앱 crash 없이 에러 처리
- [ ] ROUTES.NOTE_DETAIL 라우트로 NotePage 정상 렌더링
- [ ] `tabId`가 undefined일 때 `openRightTab` 방어 처리 (crash 없음)
- [ ] `resolveNameConflict`가 공유 유틸로 note/folder 양쪽에서 재사용
- [ ] `.md` 파일 탐색 시 숨김 디렉토리(.git 등) 내부 파일 제외
- [ ] Milkdown `staleTime: Infinity`로 편집 중 refetch 덮어쓰기 없음
- [ ] 외부에서 `.md` 파일 변경 시 `note:changed` push → FolderTree 자동 갱신
- [ ] `useNoteWatcher()` MainLayout에 등록, push 이벤트 정상 수신
- [ ] 외부에서 `.`으로 시작하는 파일 변경 이벤트는 무시
