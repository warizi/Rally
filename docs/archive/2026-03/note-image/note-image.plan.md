# Plan: Note Image (MD 에디터 이미지 삽입)

## 1. 개요

Milkdown MD 에디터에 이미지 삽입 기능을 구현한다. 외부에서 이미지 파일을 에디터 영역에 드래그 앤 드롭(DnD)하면 해당 위치에 이미지가 삽입된다.

**핵심 원칙**: 노트용 이미지는 워크스페이스 폴더의 `.images/` 경로에 저장되며, 기존의 folder tree, watcher 이벤트 처리, image entity 등과 **완전히 격리**된다. 오직 노트 에디터 내에서만 사용된다.

## 2. 요구사항

### 기능 요구사항

| ID    | 요구사항                                                                        | 우선순위 |
| ----- | ------------------------------------------------------------------------------- | -------- |
| FR-01 | 외부 이미지 파일을 에디터에 DnD하면 해당 드롭 위치에 이미지를 삽입한다          | P0       |
| FR-02 | DnD된 이미지 파일은 `{workspace}/.images/` 폴더에 복사·저장한다                 | P0       |
| FR-03 | 저장된 이미지 파일명은 `{nanoid}.{ext}` 형식으로 충돌 없이 고유하게 생성한다    | P0       |
| FR-04 | 에디터에 삽입된 이미지는 인라인으로 렌더링한다 (markdown `![](path)` 구문)      | P0       |
| FR-05 | `.images/` 폴더는 folder tree, watcher 이벤트, image entity에서 완전히 제외한다 | P0       |
| FR-06 | 클립보드 붙여넣기(Ctrl+V)로도 이미지를 삽입할 수 있다                           | P1       |

### 비기능 요구사항

| ID     | 요구사항                                                |
| ------ | ------------------------------------------------------- |
| NFR-01 | 대용량 이미지(10MB+)도 문제없이 처리한다                |
| NFR-02 | 이미지 삽입 후 에디터가 블로킹되지 않는다 (비동기 처리) |
| NFR-03 | `.images/` 폴더가 없으면 자동 생성한다                  |

## 3. 현재 상태 분석

### `.images/` 격리 현황

| 컴포넌트                                                             | 현재 상태                                          | 추가 조치          |
| -------------------------------------------------------------------- | -------------------------------------------------- | ------------------ |
| `readDirRecursive` (folder 탐색)                                     | `.` 접두사 디렉토리 **이미 스킵**                  | 불필요             |
| `readMdFilesRecursiveAsync` (note 탐색)                              | `.` 접두사 디렉토리 **이미 스킵**                  | 불필요             |
| `readImageFilesRecursiveAsync` (image entity)                        | `.` 접두사 디렉토리 **이미 스킵**                  | 불필요             |
| `readCsvFilesRecursiveAsync` / `readPdfFilesRecursiveAsync`          | `.` 접두사 디렉토리 **이미 스킵**                  | 불필요             |
| `workspace-watcher.ts` — `handleEvents` (line 176~179)               | `.images/` 하위 이미지 이벤트가 수집됨             | **필터 추가 필요** |
| `workspace-watcher.ts` — `applyEvents` imageDeletes (line 611~612)   | `.images/` 하위 이벤트 통과                        | **필터 추가 필요** |
| `workspace-watcher.ts` — `applyEvents` imageCreates (line 614~615)   | `.images/` 하위 이벤트 통과                        | **필터 추가 필요** |
| `workspace-watcher.ts` — `applyEvents` Step 2 폴더 create (line 292) | `basename.startsWith('.')` 체크로 **이미 스킵**    | 불필요             |
| `imageReconciliation`                                                | `readImageFilesRecursiveAsync`가 `.` 디렉토리 스킵 | 불필요             |

**필터 조건**:

```typescript
const rel = path.relative(workspacePath, e.path).replace(/\\/g, '/')
// .images/ 하위 파일이면 건너뛰기
if (rel.startsWith('.images/') || rel.includes('/.images/')) → 제외
```

### Milkdown 에디터 현재 구성

- **설치된 패키지**: `@milkdown/core`, `@milkdown/kit`, `@milkdown/react`, `@milkdown/preset-commonmark`, `@milkdown/plugin-listener`, `@milkdown/theme-nord`
- **사용 가능한 내장 기능**:
  - `@milkdown/plugin-upload` (`@milkdown/kit`에 포함) — DnD/Paste 자동 처리, 커스텀 `uploader` 함수 지원
  - `imageSchema` (commonmark preset 내장) — `![alt](src)` 구문 지원 (inline, atom, draggable)
  - `$view` (`@milkdown/utils`) — 커스텀 nodeView 생성 가능 (**vanilla DOM 전용**, React nodeView 유틸리티 없음)
  - `$prose` (`@milkdown/utils`) — ProseMirror 플러그인 래핑 가능

### CSP 제약

**현재 CSP** (`src/renderer/index.html`):

```
img-src 'self' data: blob:
```

- `file:` 프로토콜 **미허용** → `file://` URL로 이미지 직접 로드 불가
- dev 모드: `localhost` origin → `file://` 완전 차단
- prod 모드: `file://` origin → 동일 origin이지만 불안정
- **기존 ImageViewer 패턴**: `IPC Buffer → ArrayBuffer → Blob → blob:// URL`

### Electron DnD 파일 접근

- Electron renderer에서 `DragEvent.dataTransfer.files[0].path`로 **절대 경로 접근 가능** (Electron 전용 API)
- 일반 브라우저에서는 보안상 File.path 불가, Electron에서만 가능
- 기존 `image.import()`도 `sourcePath: string`을 IPC로 전달하는 패턴

### workspacePath 접근

- `NoteEditor`에는 `workspaceId`만 전달됨 (workspacePath 없음)
- **해결**: IPC에 `workspaceId`만 전달하면 main에서 workspace path 조회
- uploader 콜백에서 `workspaceId`는 **클로저로 캡처** (NoteEditor 컴포넌트 스코프)

## 4. 구현 전략

### 4.1 이미지 삽입 — `@milkdown/plugin-upload` 활용

커스텀 ProseMirror 플러그인 대신 내장 `@milkdown/plugin-upload`를 사용한다:

```typescript
import { upload, uploadConfig } from '@milkdown/plugin-upload'

// NoteEditor에서 플러그인 등록
Editor.make()
  .config((ctx) => {
    // ... 기존 config
    ctx.set(uploadConfig.key, {
      uploader: async (files: FileList, schema, ctx, insertPos) => {
        const nodes: Node[] = []
        for (let i = 0; i < files.length; i++) {
          const file = files.item(i)
          if (!file || !file.type.startsWith('image/')) continue

          let relativePath: string
          if (file.path) {
            // DnD: Electron File.path 사용 → 파일 경로만 전달 (바이너리 전송 없음)
            const res = await window.api.noteImage.saveFromPath(workspaceId, file.path)
            if (!res.success) continue
            relativePath = res.data!
          } else {
            // Clipboard paste: ArrayBuffer 전달
            const buffer = await file.arrayBuffer()
            const ext = file.name.split('.').pop() || 'png'
            const res = await window.api.noteImage.saveFromBuffer(workspaceId, buffer, ext)
            if (!res.success) continue
            relativePath = res.data!
          }

          const node = schema.nodes.image.createAndFill({
            src: relativePath,
            alt: file.name
          })
          if (node) nodes.push(node)
        }
        return nodes
      }
    })
  })
  .use(commonmark)
  .use(listener)
  .use(upload) // DnD + Paste 자동 처리
```

**upload 플러그인 기능**:

- `handleDrop`: 외부 파일 DnD 처리 — 드롭 좌표로 삽입 위치 계산 (`view.posAtCoords()`)
- `handlePaste`: 클립보드 이미지 붙여넣기 처리 (FR-06)
- Upload widget: 업로드 중 "Upload in progress..." placeholder 표시
- `uploader` 시그니처: `(files: FileList, schema: Schema, ctx: Ctx, insertPos: number) => Promise<Fragment | Node | Node[]>`

### 4.2 이미지 렌더링 — blob:// URL + vanilla DOM NodeView

`.images/` 상대 경로를 blob URL로 변환하는 **vanilla DOM NodeView** (`$view` 사용):

```
에디터 마운트 / 노트 재열람 시
  ↓
commonmark가 ![alt](.images/xxx.png) 파싱 → image node 생성
  ↓
$view(imageSchema.node, ...) — vanilla DOM NodeView
  ↓
src가 ".images/"로 시작하는지 확인
  ↓ (Yes)                              ↓ (No: http 등 외부 URL)
placeholder 표시 (로딩 중)             <img src={원본 URL}> 그대로 렌더링
  ↓
IPC: window.api.noteImage.readImage(workspaceId, src)
  ↓
Main: fs.readFile → Buffer 반환
  ↓
Renderer: ArrayBuffer → Blob → blob:// URL
  ↓
<img src="blob://..." /> 렌더링
  ↓ (nodeView destroy 시)
URL.revokeObjectURL(blobUrl) — 메모리 해제
```

**NodeView 구현 패턴** (vanilla DOM):

```typescript
// ProseMirror NodeView interface (React 불필요)
class NoteImageNodeView implements NodeView {
  dom: HTMLElement
  private blobUrl: string | null = null

  constructor(node: Node, view: EditorView, getPos: () => number | undefined) {
    this.dom = document.createElement('div')
    const img = document.createElement('img')
    const src = node.attrs.src

    if (src.startsWith('.images/')) {
      img.src = '' // placeholder
      this.loadBlobUrl(src, img)
    } else {
      img.src = src
    }
    this.dom.appendChild(img)
  }

  private async loadBlobUrl(src: string, img: HTMLImageElement) {
    const res = await window.api.noteImage.readImage(workspaceId, src)
    if (res.success && res.data) {
      const blob = new Blob([res.data.data])
      this.blobUrl = URL.createObjectURL(blob)
      img.src = this.blobUrl
    }
  }

  destroy() {
    if (this.blobUrl) URL.revokeObjectURL(this.blobUrl)
  }
}
```

### 4.3 데이터 흐름 (전체)

```
[삽입 흐름]
사용자 DnD (File.path 있음) / Paste (File.path 없음)
  ↓
@milkdown/plugin-upload → uploader 콜백
  ↓ (DnD)                                    ↓ (Paste)
IPC: noteImage.saveFromPath(wId, filePath)   IPC: noteImage.saveFromBuffer(wId, buffer, ext)
  ↓                                            ↓
Main: fs.copyFile → .images/{nanoid}.{ext}   Main: fs.writeFile → .images/{nanoid}.{ext}
  ↓                                            ↓
return ".images/{nanoid}.{ext}"              return ".images/{nanoid}.{ext}"
  ↓
uploader: schema.nodes.image.createAndFill({ src: relativePath, alt })
  ↓
ProseMirror: insert image node at drop/selection position
  ↓
NodeView: src ".images/..." 감지 → IPC readImage → blob URL 렌더링
  ↓
Milkdown listener: markdownUpdated → compactMarkdown → 자동 저장
  - 저장 형식: ![alt](.images/{nanoid}.{ext})

[렌더링 흐름 — 노트 재열람 시]
에디터 마운트 → expandMarkdown(content) → Milkdown 파싱
  ↓
![alt](.images/xxx.png) → image node 생성
  ↓
NodeView: IPC readImage → blob URL → <img> 렌더링
```

### 4.4 IPC 네임스페이스

기존 `note` 네임스페이스를 확장하지 않고 **`noteImage` 별도 네임스페이스**를 사용한다:

- 노트 이미지는 노트 엔티티와 별개의 도메인 (파일 저장/읽기 전용)
- 기존 `image` 네임스페이스(image entity)와 혼동 방지

```typescript
interface NoteImageAPI {
  // DnD: Electron File.path로 파일 복사 (바이너리 전송 없음, 대용량 최적)
  saveFromPath: (workspaceId: string, sourcePath: string) => Promise<IpcResponse<string>>
  // Clipboard paste: ArrayBuffer 전달 (File.path 없는 경우)
  saveFromBuffer: (
    workspaceId: string,
    buffer: ArrayBuffer,
    ext: string
  ) => Promise<IpcResponse<string>>
  // nodeView 렌더링: .images/ 파일 읽기
  readImage: (
    workspaceId: string,
    relativePath: string
  ) => Promise<IpcResponse<{ data: ArrayBuffer }>>
}
```

### 4.5 영향 범위

| 레이어              | 파일                                                                     | 변경 유형 | 변경 내용                               |
| ------------------- | ------------------------------------------------------------------------ | --------- | --------------------------------------- |
| Main — Service      | `src/main/services/note-image.ts`                                        | 신규      | saveFromPath, saveFromBuffer, readImage |
| Main — IPC          | `src/main/ipc/note-image.ts`                                             | 신규      | IPC 핸들러 등록                         |
| Main — Entry        | `src/main/index.ts`                                                      | 수정      | `registerNoteImageHandlers()` 호출 추가 |
| Main — Watcher      | `src/main/services/workspace-watcher.ts`                                 | 수정      | `.images/` 이벤트 필터링 (3곳)          |
| Preload             | `src/preload/index.ts`                                                   | 수정      | noteImage API 브릿지 추가               |
| Preload Types       | `src/preload/index.d.ts`                                                 | 수정      | NoteImageAPI 인터페이스 + API에 추가    |
| Renderer — NodeView | `src/renderer/src/features/note/edit-note/model/note-image-node-view.ts` | 신규      | vanilla DOM NodeView (blob URL 렌더링)  |
| Renderer — Editor   | `src/renderer/src/features/note/edit-note/ui/NoteEditor.tsx`             | 수정      | upload 플러그인 + $view 등록            |

## 5. 구현 순서

```
1. Main: noteImageService 구현 (saveFromPath, saveFromBuffer, readImage)
2. Main: IPC 핸들러 등록 + index.ts에 register 호출 추가
3. Preload: noteImage API 브릿지 + 타입 정의
4. Watcher: .images/ 이벤트 필터링 (handleEvents 1곳 + applyEvents 2곳)
5. Renderer: note-image-node-view.ts (vanilla DOM NodeView — blob URL 렌더링)
6. Renderer: NoteEditor에 upload 플러그인 + $view(imageSchema.node, ...) 등록
```

## 6. 마크다운 저장 형식

```markdown
일반 텍스트 내용

![photo.png](.images/abc123.png)

다음 문단
```

- `src` 경로는 워크스페이스 루트 기준 상대 경로 (`.images/filename.ext`)
- alt text는 원본 파일명 (DnD 시 자동 설정)
- 이미지 노드는 독립 문단으로 삽입

### compactMarkdown / expandMarkdown 호환성

`![alt](.images/file.png)` 구문은 `isBlockMarker()`의 어떤 패턴(`#`, `- `, `* `, `> `, ` ``` `, `---`, `|`, `숫자.`)에도 해당하지 않아 일반 텍스트로 처리된다:

```
Milkdown 출력: text\n\n![alt](...)\n\nnext
  → compactMarkdown: text\n![alt](...)\nnext
  → expandMarkdown: text\n\n![alt](...)\n\nnext  ✅ 정상 round-trip
```

### 지원 이미지 형식

기존 `IMAGE_EXTENSIONS` 활용: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.bmp`, `.svg`

uploader에서는 `file.type.startsWith('image/')` MIME 체크로 필터링.

## 7. 리스크 및 고려사항

| 리스크                                          | 대응                                                                                                        |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 이미지 삭제 시 `.images/` 내 파일이 고아가 됨   | Phase 2에서 garbage collection 고려 (현재 scope 외)                                                         |
| 에디터 remount 시 이미지 경로 유지              | markdown 저장 형식이 상대 경로 기반이므로 자연스럽게 유지됨                                                 |
| nodeView blob URL 생성의 비동기 특성            | placeholder 표시 후 blob URL 로드 완료 시 교체                                                              |
| TabBar DnD(`@dnd-kit`)와 에디터 DnD 이벤트 충돌 | upload 플러그인이 에디터 영역 내부에서만 drop 이벤트 처리 (ProseMirror view 한정)                           |
| `.images/` 폴더가 git 추적에 포함될 수 있음     | 사용자 워크스페이스의 `.gitignore` 관리는 사용자 책임 (앱 범위 외)                                          |
| 대용량 이미지(10MB+) IPC 전송                   | DnD: File.path로 경로만 전달하여 바이너리 전송 회피. Paste: ArrayBuffer 전달 (Electron IPC ~100MB까지 안전) |
| nodeView에서 workspaceId 접근                   | $view 팩토리가 클로저로 workspaceId를 캡처 (NoteEditor 리마운트 시 갱신됨)                                  |
