# Note Image Design Document

> **Summary**: Milkdown MD 에디터에 이미지 DnD/Paste 삽입, `.images/` 폴더 격리 저장, blob URL 렌더링
>
> **Date**: 2026-03-03
> **Status**: Draft
> **Planning Doc**: [note-image.plan.md](../../01-plan/features/note-image.plan.md)

---

## 1. Overview

### 1.1 Design Goals

- 외부 이미지 파일을 에디터에 DnD하면 드롭 위치에 이미지 삽입
- 클립보드 Paste(Ctrl+V)로 이미지 삽입
- 이미지는 `{workspace}/.images/{nanoid}.{ext}`에 저장
- `.images/` 폴더는 folder tree, watcher 이벤트, image entity에서 완전 격리
- 에디터에서 이미지를 blob:// URL로 렌더링 (CSP 호환)
- 노트 재열람 시에도 이미지 정상 렌더링

### 1.2 Design Principles

- `@milkdown/plugin-upload` 내장 플러그인 활용 — 커스텀 ProseMirror 플러그인 불필요
- DnD는 `webUtils.getPathForFile(file)` (Electron 39+)로 경로만 전달 — 대용량 바이너리 IPC 전송 회피
- Paste는 `ArrayBuffer` 전달 — 파일 경로가 없는 경우 (클립보드 이미지)
- `$view` vanilla DOM NodeView — React nodeView 유틸리티 없음
- 기존 `handle()` 동기 래퍼 활용 — `fs.copyFileSync` / `fs.readFileSync` 패턴

---

## 2. Architecture

### 2.1 Data Flow

```
[삽입 흐름 — DnD]
User DnD image file → @milkdown/plugin-upload handleDrop
  → uploader(files) → webUtils.getPathForFile(file) 로 경로 획득
  → IPC: noteImage.saveFromPath(workspaceId, filePath)
  → Main: fs.copyFileSync(sourcePath, .images/{nanoid}.{ext})
  → return ".images/{nanoid}.{ext}"
  → schema.nodes.image.createAndFill({ src: relativePath, alt: file.name })
  → ProseMirror: insert node at drop position
  → NodeView: src ".images/" 감지 → IPC readImage → blob URL 렌더링
  → listener: markdownUpdated → compactMarkdown → 자동 저장

[삽입 흐름 — Paste]
User Ctrl+V → @milkdown/plugin-upload handlePaste
  → uploader(files) → webUtils.getPathForFile(file) 빈 문자열 반환 (클립보드 이미지)
  → file.arrayBuffer() → IPC: noteImage.saveFromBuffer(workspaceId, buffer, ext)
  → Main: fs.writeFileSync(.images/{nanoid}.{ext}, Buffer.from(buffer))
  → return ".images/{nanoid}.{ext}"
  → (이후 동일)

[렌더링 흐름 — 노트 재열람]
에디터 마운트 → expandMarkdown(content) → Milkdown 파싱
  → ![alt](.images/xxx.png) → image node 생성
  → NodeView: IPC readImage(workspaceId, ".images/xxx.png")
  → Main: fs.readFileSync → Buffer 반환
  → Renderer: ArrayBuffer → Blob → blob:// URL → <img src="blob://...">
  → NodeView destroy 시 URL.revokeObjectURL()
```

### 2.2 Layer Map

```
┌─ Main Process ─────────────────────────────────────────────────┐
│  services/note-image.ts          (신규) saveFromPath/Buffer, readImage │
│  ipc/note-image.ts               (신규) IPC 핸들러 등록               │
│  index.ts                        (수정) registerNoteImageHandlers()   │
│  services/workspace-watcher.ts   (수정) .images/ 이벤트 필터링 (3곳)  │
├─ Preload ──────────────────────────────────────────────────────┤
│  index.ts                        (수정) noteImage API 브릿지 추가     │
│  index.d.ts                      (수정) NoteImageAPI 인터페이스       │
├─ Renderer ─────────────────────────────────────────────────────┤
│  features/note/edit-note/model/note-image-node-view.ts  (신규) │
│  features/note/edit-note/ui/NoteEditor.tsx              (수정) │
└────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Design

### 3.1 Main — `src/main/services/note-image.ts` (신규)

```typescript
import path from 'path'
import fs from 'fs'
import { nanoid } from 'nanoid'
import { NotFoundError, ValidationError } from '../lib/errors'
import { workspaceRepository } from '../repositories/workspace'
import { isImageFile } from '../lib/fs-utils'

const IMAGES_DIR = '.images'

function ensureImagesDir(workspacePath: string): string {
  const dir = path.join(workspacePath, IMAGES_DIR)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

function getWorkspacePath(workspaceId: string): string {
  const workspace = workspaceRepository.findById(workspaceId)
  if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)
  return workspace.path
}

export const noteImageService = {
  /**
   * DnD: webUtils.getPathForFile()로 획득한 경로 → 파일 복사
   * @returns ".images/{nanoid}.{ext}" 상대 경로
   */
  saveFromPath(workspaceId: string, sourcePath: string): string {
    const workspacePath = getWorkspacePath(workspaceId)

    if (!fs.existsSync(sourcePath)) {
      throw new NotFoundError(`Source file not found: ${sourcePath}`)
    }
    if (!isImageFile(sourcePath)) {
      throw new ValidationError(`Not a supported image format: ${sourcePath}`)
    }

    const ext = path.extname(sourcePath)
    const fileName = `${nanoid()}${ext}`
    const imagesDir = ensureImagesDir(workspacePath)
    const destPath = path.join(imagesDir, fileName)

    fs.copyFileSync(sourcePath, destPath)

    return `${IMAGES_DIR}/${fileName}`
  },

  /**
   * Paste: ArrayBuffer → 파일 쓰기
   * @returns ".images/{nanoid}.{ext}" 상대 경로
   */
  saveFromBuffer(workspaceId: string, buffer: ArrayBuffer, ext: string): string {
    const workspacePath = getWorkspacePath(workspaceId)

    // ext 정규화: ".png" 또는 "png" 모두 허용
    const normalizedExt = ext.startsWith('.') ? ext : `.${ext}`
    if (!isImageFile(`file${normalizedExt}`)) {
      throw new ValidationError(`Not a supported image format: ${normalizedExt}`)
    }

    const fileName = `${nanoid()}${normalizedExt}`
    const imagesDir = ensureImagesDir(workspacePath)
    const destPath = path.join(imagesDir, fileName)

    fs.writeFileSync(destPath, Buffer.from(buffer))

    return `${IMAGES_DIR}/${fileName}`
  },

  /**
   * NodeView 렌더링: .images/ 파일 읽기
   * @returns { data: Buffer } — IPC 전송 시 자동으로 ArrayBuffer 변환
   */
  readImage(workspaceId: string, relativePath: string): { data: Buffer } {
    const workspacePath = getWorkspacePath(workspaceId)

    // 보안: path traversal 방지
    const normalized = path.normalize(relativePath)
    if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
      throw new ValidationError(`Invalid image path: ${relativePath}`)
    }
    if (!normalized.startsWith(IMAGES_DIR)) {
      throw new ValidationError(`Image path must be under ${IMAGES_DIR}: ${relativePath}`)
    }

    const absPath = path.join(workspacePath, normalized)
    let data: Buffer
    try {
      data = fs.readFileSync(absPath)
    } catch {
      throw new NotFoundError(`Image file not found: ${relativePath}`)
    }

    return { data }
  }
}
```

**설계 포인트**:

- `saveFromPath`: DnD 전용, `webUtils.getPathForFile()`로 획득한 경로를 `fs.copyFileSync` — 바이너리 IPC 전송 없음
- `saveFromBuffer`: Paste 전용, `ArrayBuffer` → `Buffer.from()` → `fs.writeFileSync`
- `readImage`: path traversal 방지 검증 후 `fs.readFileSync` → `{ data: Buffer }`
- `isImageFile()` 재사용 — 지원 형식 통일 (.png, .jpg, .jpeg, .gif, .webp, .bmp, .svg)
- `ensureImagesDir`: `.images/` 자동 생성 (NFR-03)
- 반환값: `".images/{nanoid}.{ext}"` — 워크스페이스 루트 기준 상대 경로

---

### 3.2 Main — `src/main/ipc/note-image.ts` (신규)

```typescript
import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { noteImageService } from '../services/note-image'

export function registerNoteImageHandlers(): void {
  ipcMain.handle(
    'noteImage:saveFromPath',
    (_: IpcMainInvokeEvent, workspaceId: string, sourcePath: string): IpcResponse =>
      handle(() => noteImageService.saveFromPath(workspaceId, sourcePath))
  )

  ipcMain.handle(
    'noteImage:saveFromBuffer',
    (_: IpcMainInvokeEvent, workspaceId: string, buffer: ArrayBuffer, ext: string): IpcResponse =>
      handle(() => noteImageService.saveFromBuffer(workspaceId, buffer, ext))
  )

  ipcMain.handle(
    'noteImage:readImage',
    (_: IpcMainInvokeEvent, workspaceId: string, relativePath: string): IpcResponse =>
      handle(() => noteImageService.readImage(workspaceId, relativePath))
  )
}
```

**설계 포인트**:

- 기존 `handle()` 동기 래퍼 활용 — 모든 서비스 메서드가 동기
- IPC 채널 네이밍: `noteImage:action` — 기존 `image:action` (image entity)과 분리

---

### 3.3 Main — `src/main/index.ts` (수정)

```typescript
// 기존 import 영역에 추가
import { registerNoteImageHandlers } from './ipc/note-image'

// app.whenReady() 내부, registerImageFileHandlers() 다음에 추가
registerNoteImageHandlers()
```

**변경 위치**: `registerImageFileHandlers()` 호출 직후 (line ~97)

---

### 3.4 Main — `src/main/services/workspace-watcher.ts` (수정, 3곳)

#### 변경 1: `handleEvents` — 이미지 이벤트 수집 필터 (line 176~179)

```typescript
// 변경 전
const changedImageRelPaths = [
  ...eventsToProcess
    .filter((e) => isImageFile(e.path) && !path.basename(e.path).startsWith('.'))
    .map((e) => path.relative(workspacePath, e.path).replace(/\\/g, '/')),
  ...orphanImagePaths
]

// 변경 후
const changedImageRelPaths = [
  ...eventsToProcess
    .filter((e) => {
      if (!isImageFile(e.path) || path.basename(e.path).startsWith('.')) return false
      const rel = path.relative(workspacePath, e.path).replace(/\\/g, '/')
      return !rel.startsWith('.images/') && !rel.includes('/.images/')
    })
    .map((e) => path.relative(workspacePath, e.path).replace(/\\/g, '/')),
  ...orphanImagePaths
]
```

#### 변경 2: `applyEvents` — imageDeletes 필터 (line 611~612)

```typescript
// 변경 전
const imageDeletes = events.filter(
  (e) => e.type === 'delete' && isImageFile(e.path) && !path.basename(e.path).startsWith('.')
)

// 변경 후
const imageDeletes = events.filter((e) => {
  if (e.type !== 'delete' || !isImageFile(e.path) || path.basename(e.path).startsWith('.'))
    return false
  const rel = path.relative(workspacePath, e.path).replace(/\\/g, '/')
  return !rel.startsWith('.images/') && !rel.includes('/.images/')
})
```

#### 변경 3: `applyEvents` — imageCreates 필터 (line 614~615)

```typescript
// 변경 전
const imageCreates = events.filter(
  (e) => e.type === 'create' && isImageFile(e.path) && !path.basename(e.path).startsWith('.')
)

// 변경 후
const imageCreates = events.filter((e) => {
  if (e.type !== 'create' || !isImageFile(e.path) || path.basename(e.path).startsWith('.'))
    return false
  const rel = path.relative(workspacePath, e.path).replace(/\\/g, '/')
  return !rel.startsWith('.images/') && !rel.includes('/.images/')
})
```

**설계 포인트**:

- `.images/` 하위 이미지 파일 이벤트가 image entity DB에 등록되는 것을 방지
- `rel.startsWith('.images/')` — 최상위 `.images/` 폴더
- `rel.includes('/.images/')` — 중첩 `.images/` 폴더 (방어적)
- 기존 `readImageFilesRecursiveAsync`, `readDirRecursiveAsync` 등은 `.` 접두사 디렉토리를 이미 스킵하므로 변경 불필요

---

### 3.5 Preload — `src/preload/index.ts` (수정)

`image` 블록 뒤에 `noteImage` 블록 추가:

```typescript
noteImage: {
  saveFromPath: (workspaceId: string, sourcePath: string) =>
    ipcRenderer.invoke('noteImage:saveFromPath', workspaceId, sourcePath),
  saveFromBuffer: (workspaceId: string, buffer: ArrayBuffer, ext: string) =>
    ipcRenderer.invoke('noteImage:saveFromBuffer', workspaceId, buffer, ext),
  readImage: (workspaceId: string, relativePath: string) =>
    ipcRenderer.invoke('noteImage:readImage', workspaceId, relativePath)
},
```

---

### 3.6 Preload — `src/preload/index.d.ts` (수정)

#### 신규 인터페이스 추가 (ImageAPI 뒤에):

```typescript
interface NoteImageAPI {
  saveFromPath: (workspaceId: string, sourcePath: string) => Promise<IpcResponse<string>>
  saveFromBuffer: (
    workspaceId: string,
    buffer: ArrayBuffer,
    ext: string
  ) => Promise<IpcResponse<string>>
  readImage: (
    workspaceId: string,
    relativePath: string
  ) => Promise<IpcResponse<{ data: ArrayBuffer }>>
}
```

#### API 인터페이스에 추가:

```typescript
interface API {
  note: NoteAPI
  csv: CsvAPI
  pdf: PdfAPI
  image: ImageAPI
  noteImage: NoteImageAPI // 추가
  folder: FolderAPI
  // ... 나머지 동일
}
```

---

### 3.7 Renderer — `src/renderer/src/features/note/edit-note/model/note-image-node-view.ts` (신규)

```typescript
import type { NodeView } from '@milkdown/kit/prose/view'
import type { Node } from '@milkdown/kit/prose/model'
import type { EditorView } from '@milkdown/kit/prose/view'

/**
 * .images/ 경로의 이미지를 blob:// URL로 렌더링하는 vanilla DOM NodeView.
 * 외부 URL(http 등)은 그대로 렌더링.
 *
 * workspaceId는 팩토리 함수의 클로저로 캡처.
 */
export function createNoteImageNodeViewFactory(workspaceId: string) {
  return (node: Node, view: EditorView, getPos: () => number | undefined): NoteImageNodeView => {
    return new NoteImageNodeView(node, view, getPos, workspaceId)
  }
}

class NoteImageNodeView implements NodeView {
  dom: HTMLElement
  private blobUrl: string | null = null
  private img: HTMLImageElement
  private currentSrc: string = '' // 원본 src 추적용 (blob URL과 별도)

  constructor(
    node: Node,
    _view: EditorView,
    _getPos: () => number | undefined,
    private workspaceId: string
  ) {
    this.dom = document.createElement('div')
    this.dom.classList.add('note-image-wrapper')

    this.img = document.createElement('img')
    this.img.alt = (node.attrs.alt as string) || ''
    this.img.title = (node.attrs.title as string) || ''
    this.img.style.maxWidth = '100%'
    this.img.style.display = 'block'
    this.img.style.margin = '0.5rem 0'

    const src = node.attrs.src as string
    this.currentSrc = src

    if (src && src.startsWith('.images/')) {
      this.img.style.minHeight = '2rem'
      this.img.style.background = 'var(--muted, #f3f4f6)'
      this.img.style.borderRadius = '0.375rem'
      this.loadBlobUrl(src)
    } else {
      this.img.src = src || ''
    }

    this.dom.appendChild(this.img)
  }

  private async loadBlobUrl(src: string): Promise<void> {
    try {
      const res = await window.api.noteImage.readImage(this.workspaceId, src)
      if (res.success && res.data) {
        const blob = new Blob([res.data.data])
        this.blobUrl = URL.createObjectURL(blob)
        this.img.src = this.blobUrl
        this.img.style.minHeight = ''
        this.img.style.background = ''
      }
    } catch {
      // 이미지 로드 실패 시 placeholder 유지
    }
  }

  update(node: Node): boolean {
    if (node.type.name !== 'image') return false

    const newSrc = node.attrs.src as string
    const newAlt = (node.attrs.alt as string) || ''
    const newTitle = (node.attrs.title as string) || ''

    this.img.alt = newAlt
    this.img.title = newTitle

    // src 변경 시 기존 blob URL 해제 후 재로드
    if (this.currentSrc !== newSrc) {
      this.currentSrc = newSrc
      if (this.blobUrl) {
        URL.revokeObjectURL(this.blobUrl)
        this.blobUrl = null
      }
      if (newSrc && newSrc.startsWith('.images/')) {
        this.loadBlobUrl(newSrc)
      } else {
        this.img.src = newSrc || ''
      }
    }

    return true
  }

  destroy(): void {
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl)
      this.blobUrl = null
    }
  }

  // ProseMirror가 contentDOM을 사용하지 않는 atom 노드이므로 생략 가능
  stopEvent(): boolean {
    return false
  }

  ignoreMutation(): boolean {
    return true
  }
}
```

**설계 포인트**:

- `createNoteImageNodeViewFactory(workspaceId)` — 팩토리 패턴으로 `workspaceId` 클로저 캡처
- `$view(imageSchema.node, (_ctx) => factory)` 형태로 Milkdown에 등록 — `$view`는 `(ctx: Ctx) => NodeViewConstructor` 시그니처
- `.images/` 경로만 blob URL 변환, 외부 URL은 그대로 렌더링
- `update()` — src 변경 시 기존 blob URL 해제 후 재로드
- `destroy()` — blob URL 메모리 해제 (`URL.revokeObjectURL`)
- placeholder 스타일: `minHeight: 2rem`, `background: var(--muted)` — 로딩 중 빈 공간 방지
- `ignoreMutation: true` — DOM 변경을 ProseMirror가 무시 (async 렌더링 호환)

---

### 3.8 Renderer — `src/renderer/src/features/note/edit-note/ui/NoteEditor.tsx` (수정)

#### 변경 사항

```typescript
// 기존 import 유지 + 추가
import { upload, uploadConfig } from '@milkdown/plugin-upload'
import { imageSchema } from '@milkdown/preset-commonmark'
import { $view } from '@milkdown/utils'
import { createNoteImageNodeViewFactory } from '../model/note-image-node-view'

// MilkdownEditorProps 변경
interface MilkdownEditorProps {
  workspaceId: string  // 추가
  initialContent: string
  onSave: (markdown: string) => void
}

// MilkdownEditor 변경
function MilkdownEditor({ workspaceId, initialContent, onSave }: MilkdownEditorProps): JSX.Element {
  useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, expandMarkdown(initialContent))
        ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
          onSave(markdown)
        })
        ctx.update(uploadConfig.key, (prev) => ({
          ...prev,
          uploader: async (files: FileList, schema) => {
            const nodes: import('@milkdown/kit/prose/model').Node[] = []
            for (let i = 0; i < files.length; i++) {
              const file = files.item(i)
              if (!file || !file.type.startsWith('image/')) continue

              let relativePath: string
              // Electron 39+: webUtils.getPathForFile() 사용 (File.path 폐지됨)
              const filePath = window.electron.webUtils.getPathForFile(file)
              if (filePath) {
                // DnD: 파일 경로만 전달 (바이너리 전송 없음)
                const res = await window.api.noteImage.saveFromPath(workspaceId, filePath)
                if (!res.success) continue
                relativePath = res.data!
              } else {
                // Clipboard paste: 파일 경로 없음 → ArrayBuffer 전달
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
        }))
      })
      .use(commonmark)
      .use(listener)
      .use(upload)
      .use(
        $view(imageSchema.node, (_ctx) =>
          createNoteImageNodeViewFactory(workspaceId)
        )
      )
  )
  return <Milkdown />
}

// NoteEditor 컴포넌트 — MilkdownEditor에 workspaceId 전달
export function NoteEditor({ workspaceId, noteId, initialContent }: NoteEditorProps): JSX.Element {
  // ... 기존 코드 동일 ...

  return (
    <div className="h-full">
      <MilkdownProvider key={editorKey}>
        <MilkdownEditor
          workspaceId={workspaceId}  // 추가
          initialContent={contentToMount}
          onSave={handleSave}
        />
      </MilkdownProvider>
    </div>
  )
}
```

**설계 포인트**:

- `workspaceId`를 `MilkdownEditor`에 prop으로 전달 → uploader 클로저 + nodeView 팩토리에서 캡처
- `ctx.update(uploadConfig.key, (prev) => ({ ...prev, uploader }))` — 기본 옵션(`enableHtmlFileUploader`, `uploadWidgetFactory` 등) 보존
- `window.electron.webUtils.getPathForFile(file)` — Electron 39+ 공식 API (`File.path` 폐지됨, `@electron-toolkit/preload`가 이미 `webUtils`를 `window.electron`에 노출)
- `$view(imageSchema.node, (_ctx) => ...)` — `$view` 팩토리는 `(ctx: Ctx)` 시그니처
- `.use(upload)` — `commonmark`, `listener` 뒤에 등록
- uploader 반환 타입: `Node[]` — ProseMirror Node 배열

---

## 4. 마크다운 저장 형식 및 호환성

### 4.1 저장 형식

```markdown
일반 텍스트 내용
![photo.png](.images/abc123.png)
다음 문단
```

- `src`: 워크스페이스 루트 기준 상대 경로 (`.images/filename.ext`)
- `alt`: 원본 파일명

### 4.2 compactMarkdown / expandMarkdown 호환성

`![alt](.images/file.png)` 구문은 `isBlockMarker()`의 어떤 패턴에도 해당하지 않아 일반 텍스트로 처리:

```
Milkdown 출력: text\n\n![alt](...)\n\nnext
  → compactMarkdown: text\n![alt](...)\nnext
  → expandMarkdown: text\n\n![alt](...)\n\nnext  ✅ 정상 round-trip
```

---

## 5. Implementation Order

```
1. [Main] src/main/services/note-image.ts — 서비스 구현
2. [Main] src/main/ipc/note-image.ts — IPC 핸들러 등록
3. [Main] src/main/index.ts — registerNoteImageHandlers() 호출 추가
4. [Main] src/main/services/workspace-watcher.ts — .images/ 이벤트 필터링 (3곳)
5. [Preload] src/preload/index.ts — noteImage API 브릿지 추가
6. [Preload] src/preload/index.d.ts — NoteImageAPI 인터페이스 + API 확장
7. [Renderer] src/renderer/src/features/note/edit-note/model/note-image-node-view.ts — NodeView
8. [Renderer] src/renderer/src/features/note/edit-note/ui/NoteEditor.tsx — 에디터 통합
```

---

## 6. File Change Summary

| File                                                                     | Type | Description                             |
| ------------------------------------------------------------------------ | ---- | --------------------------------------- |
| `src/main/services/note-image.ts`                                        | 신규 | saveFromPath, saveFromBuffer, readImage |
| `src/main/ipc/note-image.ts`                                             | 신규 | IPC 핸들러 3개 등록                     |
| `src/main/index.ts`                                                      | 수정 | `registerNoteImageHandlers()` 1줄 추가  |
| `src/main/services/workspace-watcher.ts`                                 | 수정 | `.images/` 필터 3곳                     |
| `src/preload/index.ts`                                                   | 수정 | `noteImage` 블록 추가                   |
| `src/preload/index.d.ts`                                                 | 수정 | `NoteImageAPI` 인터페이스 + API 확장    |
| `src/renderer/src/features/note/edit-note/model/note-image-node-view.ts` | 신규 | vanilla DOM NodeView                    |
| `src/renderer/src/features/note/edit-note/ui/NoteEditor.tsx`             | 수정 | upload 플러그인 + $view 등록            |
