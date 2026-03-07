# Terminal Design Document

> **Summary**: Rally 앱에 내장 터미널 기능을 추가한다. xterm.js + node-pty 기반으로 워크스페이스 폴더에서 shell을 실행하며, 사이드바에서 탭으로 열 수 있다.
>
> **Date**: 2026-03-07
> **Status**: Draft
> **Planning Doc**: [terminal.plan.md](../../01-plan/features/terminal.plan.md)

---

## 1. Overview

### 1.1 Design Goals

- 사이드바의 정적 라우트 패턴으로 터미널 탭 1개 지원 (워크스페이스당)
- node-pty(main process)로 실제 pseudo-terminal spawn, xterm.js(renderer)로 렌더링
- 워크스페이스 폴더 경로를 cwd로 사용
- 터미널 수명을 탭/워크스페이스/앱 수명에 완전 연동

### 1.2 Design Principles

- **DB 없음** — 런타임 전용 기능, 스크롤백/히스토리 저장 없음
- **단일 변수 모델** — `let currentPty: IPty | null` (다중 터미널 미지원)
- **기존 패턴 준수** — `handle()` wrapper, `contextBridge`, FSD layer 규칙 그대로 사용
- **이중 방어** — 워크스페이스 전환 시 `useEffect` dep + main 자동 교체로 pty 누수 방지
- **멱등적 종료** — `terminal:destroy`와 `closeTab` 모두 중복 호출에 안전

---

## 2. Architecture

### 2.1 Data Flow

```
[터미널 열기]
  사이드바 클릭 → openTab({ type: 'terminal', pathname: '/terminal', title: '터미널' })
    → TerminalPage mount → xterm.Terminal 생성 → fitAddon.fit() → cols/rows 확정
    → terminal:create({ cwd, cols, rows }) invoke → node-pty spawn

[I/O 흐름]
  키 입력: xterm onData → terminal:write (ipcRenderer.send, fire-and-forget) → pty.write()
  pty 출력: pty onData → terminal:data (webContents.send) → xterm.write()

[리사이즈]
  ResizeObserver → fitAddon.fit() → terminal:resize (ipcRenderer.send) → pty.resize()

[종료]
  탭 닫기: useEffect cleanup → terminal:destroy invoke → pty.kill()
  shell exit: pty onExit → terminal:exit (webContents.send) → closeTabByPathname('/terminal')
```

### 2.2 Layer Map

```
+-- Main Process -----------------------------------------------+
|  services/terminal.ts      node-pty 프로세스 관리              |
|  ipc/terminal.ts           IPC 핸들러 (handle + on)            |
+-- Preload ----------------------------------------------------+
|  index.ts                  terminal API bridge (invoke + send) |
|  index.d.ts                TerminalAPI 타입 정의               |
+-- Renderer ---------------------------------------------------+
|  shared/constants/tab-url.ts   TabType 'terminal' 추가        |
|  features/terminal/            hooks + xterm 초기화            |
|  pages/terminal/               TerminalPage 컴포넌트           |
|  app/layout/model/pane-routes  라우트 등록                     |
+---------------------------------------------------------------+
```

---

## 3. Data Model

DB 스키마 없음. 터미널은 런타임 전용 기능이다.

---

## 4. IPC Protocol

### 4.1 Renderer -> Main (request-response)

| Channel | Args | Return | Pattern |
|---------|------|--------|---------|
| `terminal:create` | `{ cwd: string, cols: number, rows: number }` | `IpcResponse<void>` | `ipcMain.handle` / `ipcRenderer.invoke` |
| `terminal:destroy` | (없음) | `IpcResponse<void>` | `ipcMain.handle` / `ipcRenderer.invoke` |

### 4.2 Renderer -> Main (fire-and-forget)

| Channel | Args | Pattern | Note |
|---------|------|---------|------|
| `terminal:write` | `{ data: string }` | `ipcMain.on` / `ipcRenderer.send` | 고빈도 키 입력, 프로젝트 최초 `send` 사용 |
| `terminal:resize` | `{ cols: number, rows: number }` | `ipcMain.on` / `ipcRenderer.send` | 리사이즈 시 |

### 4.3 Main -> Renderer (push)

| Channel | Data | Pattern | Note |
|---------|------|---------|------|
| `terminal:data` | `{ data: string }` | `webContents.send` / `ipcRenderer.on` | pty stdout 스트림 |
| `terminal:exit` | `{ exitCode: number }` | `webContents.send` / `ipcRenderer.on` | shell 종료 알림, 탭 자동 닫기 |

---

## 5. Implementation Details

### 5.1 Main Process — Service

**파일**: `src/main/services/terminal.ts`

```typescript
import * as pty from 'node-pty'
import * as fs from 'fs'
import { BrowserWindow } from 'electron'

let currentPty: pty.IPty | null = null

function getDefaultShell(): string {
  return process.env.SHELL || (process.platform === 'win32' ? 'powershell.exe' : '/bin/zsh')
}

export const terminalService = {
  create(cwd: string, cols: number, rows: number): void {
    // cwd 존재 검증
    fs.accessSync(cwd, fs.constants.R_OK)

    // 기존 pty가 있으면 자동 kill (이중 방어)
    if (currentPty) {
      currentPty.kill()
      currentPty = null
    }

    const shell = getDefaultShell()
    currentPty = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: process.env as Record<string, string>
    })

    // pty stdout → renderer push
    currentPty.onData((data: string) => {
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send('terminal:data', { data })
      })
    })

    // pty exit → renderer push
    currentPty.onExit(({ exitCode }) => {
      currentPty = null
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send('terminal:exit', { exitCode })
      })
    })
  },

  write(data: string): void {
    currentPty?.write(data)
  },

  resize(cols: number, rows: number): void {
    currentPty?.resize(cols, rows)
  },

  destroy(): void {
    if (currentPty) {
      currentPty.kill()
      currentPty = null
    }
  }
}
```

**핵심 포인트**:
- `currentPty`: 단일 변수, 워크스페이스당 1개 터미널
- `create()`: `fs.accessSync`로 cwd 검증 → 실패 시 Error throw → `handle()` wrapper가 `ValidationError` 반환
- `create()` 시 기존 pty 자동 kill → 워크스페이스 전환 시 이중 방어
- `destroy()`: 멱등적 (이미 null이면 no-op)
- `onData`/`onExit`: `BrowserWindow.getAllWindows()` 사용 (기존 `reminder-scheduler.ts` 패턴)

### 5.2 Main Process — IPC Handlers

**파일**: `src/main/ipc/terminal.ts`

```typescript
import { ipcMain, IpcMainInvokeEvent, IpcMainEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { terminalService } from '../services/terminal'

export function registerTerminalHandlers(): void {
  // request-response (invoke/handle)
  ipcMain.handle(
    'terminal:create',
    (
      _: IpcMainInvokeEvent,
      args: { cwd: string; cols: number; rows: number }
    ): IpcResponse => handle(() => terminalService.create(args.cwd, args.cols, args.rows))
  )

  ipcMain.handle(
    'terminal:destroy',
    (_: IpcMainInvokeEvent): IpcResponse => handle(() => terminalService.destroy())
  )

  // fire-and-forget (send/on)
  ipcMain.on('terminal:write', (_: IpcMainEvent, args: { data: string }) => {
    terminalService.write(args.data)
  })

  ipcMain.on('terminal:resize', (_: IpcMainEvent, args: { cols: number; rows: number }) => {
    terminalService.resize(args.cols, args.rows)
  })
}
```

**핵심 포인트**:
- `terminal:create`/`terminal:destroy`: `handle()` wrapper 사용 (기존 패턴)
- `terminal:write`/`terminal:resize`: `ipcMain.on` (fire-and-forget, 프로젝트 최초)
- `terminal:create` args를 단일 객체로 전달 (positional args 대신)

### 5.3 Main Process — index.ts 수정

**파일**: `src/main/index.ts`

변경 1: import 추가
```typescript
import { registerTerminalHandlers } from './ipc/terminal'
import { terminalService } from './services/terminal'
```

변경 2: `app.whenReady()` 내 핸들러 등록 추가 (기존 `registerItemTagHandlers()` 다음)
```typescript
registerTerminalHandlers()
```

변경 3: `before-quit` 핸들러에 터미널 정리 추가
```typescript
app.on('before-quit', (event) => {
  if (isQuitting) return
  event.preventDefault()
  isQuitting = true
  reminderScheduler.stop()
  terminalService.destroy()  // <-- 추가
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 1000))
  session.defaultSession.flushStorageData()
  Promise.race([workspaceWatcher.stop(), timeout]).finally(() => app.quit())
})
```

### 5.4 Preload — Bridge

**파일**: `src/preload/index.ts` — `api` 객체에 `terminal` 추가

```typescript
terminal: {
  create: (args: { cwd: string; cols: number; rows: number }) =>
    ipcRenderer.invoke('terminal:create', args),
  destroy: () => ipcRenderer.invoke('terminal:destroy'),
  write: (args: { data: string }) => ipcRenderer.send('terminal:write', args),
  resize: (args: { cols: number; rows: number }) => ipcRenderer.send('terminal:resize', args),
  onData: (callback: (data: { data: string }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: { data: string }): void =>
      callback(data)
    ipcRenderer.on('terminal:data', handler)
    return () => ipcRenderer.removeListener('terminal:data', handler)
  },
  onExit: (callback: (data: { exitCode: number }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: { exitCode: number }): void =>
      callback(data)
    ipcRenderer.on('terminal:exit', handler)
    return () => ipcRenderer.removeListener('terminal:exit', handler)
  }
}
```

**핵심 포인트**:
- `write`/`resize`: `ipcRenderer.send` (fire-and-forget) — 프로젝트 최초
- `onData`/`onExit`: 기존 `onChanged`/`onFired` 패턴 동일 (cleanup 함수 반환)

### 5.5 Preload — Type Definitions

**파일**: `src/preload/index.d.ts`

```typescript
interface TerminalAPI {
  create: (args: { cwd: string; cols: number; rows: number }) => Promise<IpcResponse<void>>
  destroy: () => Promise<IpcResponse<void>>
  write: (args: { data: string }) => void
  resize: (args: { cols: number; rows: number }) => void
  onData: (callback: (data: { data: string }) => void) => () => void
  onExit: (callback: (data: { exitCode: number }) => void) => () => void
}
```

`API` interface에 추가:
```typescript
interface API {
  // ... 기존 항목들 ...
  terminal: TerminalAPI
}
```

### 5.6 Shared Constants — tab-url.ts

**파일**: `src/renderer/src/shared/constants/tab-url.ts`

변경 1: `TabType` union에 `'terminal'` 추가
```typescript
export type TabType =
  | 'dashboard'
  | 'todo'
  // ... 기존 ...
  | 'canvas-detail'
  | 'terminal'
```

변경 2: import에 `Terminal` 아이콘 추가
```typescript
import { ..., Terminal } from 'lucide-react'
```

변경 3: `TAB_ICON`에 terminal 추가
```typescript
export const TAB_ICON: Record<TabIcon, React.ElementType> = {
  // ... 기존 ...
  'canvas-detail': Network,
  terminal: Terminal
}
```

변경 4: `ROUTES`에 TERMINAL 추가
```typescript
export const ROUTES = {
  // ... 기존 ...
  CANVAS_DETAIL: '/canvas/:canvasId',
  TERMINAL: '/terminal'
} as const
```

변경 5: `sidebar_items`에 터미널 항목 추가 (캔버스 다음)
```typescript
{
  title: '터미널',
  tabType: 'terminal',
  pathname: ROUTES.TERMINAL,
  icon: TAB_ICON['terminal']
}
```

### 5.7 Renderer — features/terminal

**디렉토리**: `src/renderer/src/features/terminal/`

#### 5.7.1 `use-terminal.ts` (메인 훅)

```typescript
import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { useTabStore } from '@features/tap-system/manage-tab-system'

export function useTerminal(containerRef: React.RefObject<HTMLDivElement | null>) {
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId)
  const closeTabByPathname = useTabStore((s) => s.closeTabByPathname)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !workspaceId) return

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4'
      }
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(container)

    termRef.current = term
    fitAddonRef.current = fitAddon

    // 1) fit으로 cols/rows 확정
    fitAddon.fit()
    const { cols, rows } = term

    // 2) workspace 경로 획득 → pty 생성
    window.api.workspace.getById(workspaceId).then((res) => {
      if (!res.success || !res.data) return
      window.api.terminal.create({ cwd: res.data.path, cols, rows })
    })

    // 3) pty 출력 → xterm 렌더링
    const unsubData = window.api.terminal.onData(({ data }) => {
      term.write(data)
    })

    // 4) 키 입력 → pty 전달
    const disposeInput = term.onData((data) => {
      window.api.terminal.write({ data })
    })

    // 5) shell 자체 종료 → 탭 자동 닫기
    const unsubExit = window.api.terminal.onExit(() => {
      closeTabByPathname('/terminal')
    })

    // 6) 리사이즈 감지
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
      window.api.terminal.resize({ cols: term.cols, rows: term.rows })
    })
    resizeObserver.observe(container)

    // cleanup
    return () => {
      resizeObserver.disconnect()
      disposeInput.dispose()
      unsubData()
      unsubExit()
      term.dispose()
      termRef.current = null
      fitAddonRef.current = null
      window.api.terminal.destroy()
    }
  }, [workspaceId, containerRef, closeTabByPathname])
}
```

**핵심 포인트**:
- `workspaceId`가 `useEffect` dep에 포함 → 워크스페이스 전환 시 cleanup(destroy) → 재생성(create) 자동 실행
- xterm CSS는 이 레이어에서 import (lazy load 시 함께 로드)
- `ResizeObserver`로 컨테이너 크기 변경 감지 → `fitAddon.fit()` + `terminal:resize` 연동
- `onExit` 콜백에서 `closeTabByPathname('/terminal')` 호출 → 탭 자동 닫기

#### 5.7.2 `index.ts` (barrel export)

```typescript
export { useTerminal } from './use-terminal'
```

### 5.8 Renderer — pages/terminal

**디렉토리**: `src/renderer/src/pages/terminal/`

#### 5.8.1 `ui/TerminalPage.tsx`

```typescript
import { JSX, useRef } from 'react'
import { TabContainer } from '@shared/ui/tab-container'
import { useTerminal } from '@features/terminal'

export function TerminalPage(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  useTerminal(containerRef)

  return (
    <TabContainer scrollable={false} maxWidth="full" header={null}>
      <div ref={containerRef} className="h-full w-full" />
    </TabContainer>
  )
}
```

**핵심 포인트**:
- `scrollable={false} maxWidth="full"` — xterm 자체 스크롤 사용 (PDF/Image/Canvas-detail 동일 패턴)
- `header={null}` — 터미널은 별도 헤더 불필요
- 컨테이너 `div`가 xterm `term.open()` 대상

#### 5.8.2 `index.ts` (barrel export)

```typescript
export { TerminalPage } from './ui/TerminalPage'
```

### 5.9 Renderer — pane-routes.tsx 수정

**파일**: `src/renderer/src/app/layout/model/pane-routes.tsx`

```typescript
const TerminalPage = lazy(() => import('@pages/terminal'))

// PANE_ROUTES 배열에 추가:
{
  pattern: ROUTES.TERMINAL,
  component: TerminalPage
}
```

---

## 6. Lifecycle Management

### 6.1 이벤트별 동작

| 이벤트 | 동작 | 안전성 |
|--------|------|--------|
| 사이드바 클릭 | `openTab` → TerminalPage mount → `useEffect` → `terminal:create` | 중복 탭 방지 (같은 pathname) |
| 탭 닫기 | TerminalPage unmount → `useEffect` cleanup → `terminal:destroy` | `destroy()` 멱등적 |
| shell `exit` | main `terminal:exit` push → `closeTabByPathname('/terminal')` | `closeTab` 멱등적 (탭 없으면 early return) |
| 탭 닫기 + shell exit 동시 | race condition이나 양쪽 모두 멱등적 → 안전 | |
| 워크스페이스 전환 | `applySessionToStore`로 탭 교체. 같은 `tab-terminal` ID → unmount 안 될 수 있음 → `useEffect` dep `workspaceId`로 `destroy→create` 사이클 강제. 추가로 `terminal:create`가 기존 pty 자동 kill | 이중 방어 |
| 탭 스냅샷 복원 | 터미널 탭 포함 시 TerminalPage mount → 새 pty spawn | |
| 앱 종료 | `before-quit` → `terminalService.destroy()` | 동기적 kill |

### 6.2 워크스페이스 전환 시퀀스

```
1. setCurrentWorkspaceId(newId)
2. useSessionPersistence → saveSessionToDb(oldId) → loadSessionFromDb(newId)
3. applySessionToStore → 탭 상태 교체
4. 양쪽 모두 /terminal 탭 존재 시 tab.id = 'tab-terminal' 동일 → React 컴포넌트 재사용 (unmount 안 됨)
5. useEffect dep [workspaceId] 변경 감지 → cleanup: terminal:destroy → setup: terminal:create(newCwd)
6. main terminal:create 내부에서도 기존 pty 자동 kill (이중 방어)
```

---

## 7. Dependencies

### 7.1 New Packages

| Package | Layer | Purpose |
|---------|-------|---------|
| `node-pty` | main | Pseudo-terminal 생성 (native addon) |
| `@xterm/xterm` | renderer | 터미널 에뮬레이터 UI (v5+) |
| `@xterm/addon-fit` | renderer | 터미널 크기 자동 조절 |

### 7.2 Build Pipeline

- `node-pty`는 native addon → `postinstall: "npx @electron/rebuild -f"` (기존 `better-sqlite3`, `@parcel/watcher`와 동일)
- `electron-vite v5`: main/preload에 `externalizeDeps: true` 자동 적용 → `node-pty` external 처리
- renderer: `externalizeDeps` 미적용 → `@xterm/xterm`, `@xterm/addon-fit` 정상 번들
- `electron-builder.yml`: `npmRebuild: false` (이미 postinstall에서 rebuild)

---

## 8. Implementation Order

| Step | File(s) | Description |
|------|---------|-------------|
| 1 | `package.json` | `npm install node-pty @xterm/xterm @xterm/addon-fit` |
| 2 | `src/main/services/terminal.ts` | terminalService 구현 |
| 3 | `src/main/ipc/terminal.ts` | IPC 핸들러 등록 |
| 4 | `src/main/index.ts` | import + 핸들러 등록 + before-quit 수정 |
| 5 | `src/preload/index.ts` | terminal bridge 추가 |
| 6 | `src/preload/index.d.ts` | TerminalAPI 타입 정의 |
| 7 | `src/renderer/src/shared/constants/tab-url.ts` | TabType, ROUTES, TAB_ICON, sidebar_items 확장 |
| 8 | `src/renderer/src/features/terminal/` | useTerminal 훅 + barrel export |
| 9 | `src/renderer/src/pages/terminal/` | TerminalPage 컴포넌트 + barrel export |
| 10 | `src/renderer/src/app/layout/model/pane-routes.tsx` | lazy import + 라우트 등록 |

---

## 9. File Change Summary

### 9.1 New Files (5)

| File | Layer |
|------|-------|
| `src/main/services/terminal.ts` | main/services |
| `src/main/ipc/terminal.ts` | main/ipc |
| `src/renderer/src/features/terminal/use-terminal.ts` | features |
| `src/renderer/src/features/terminal/index.ts` | features |
| `src/renderer/src/pages/terminal/ui/TerminalPage.tsx` | pages |
| `src/renderer/src/pages/terminal/index.ts` | pages |

### 9.2 Modified Files (5)

| File | Changes |
|------|---------|
| `src/main/index.ts` | import 2개 + `registerTerminalHandlers()` + `terminalService.destroy()` in before-quit |
| `src/preload/index.ts` | `terminal` 객체 추가 (create, destroy, write, resize, onData, onExit) |
| `src/preload/index.d.ts` | `TerminalAPI` interface + `API`에 `terminal` 필드 추가 |
| `src/renderer/src/shared/constants/tab-url.ts` | TabType + ROUTES + TAB_ICON + sidebar_items 확장 |
| `src/renderer/src/app/layout/model/pane-routes.tsx` | lazy import + PANE_ROUTES 항목 추가 |
