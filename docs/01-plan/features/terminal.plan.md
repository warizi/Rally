# Plan: Terminal (Integrated Terminal)

## 1. Feature Overview

Rally 앱에 내장 터미널 기능을 추가한다. 워크스페이스의 폴더 경로에서 터미널을 열어 shell 명령어, Claude Code 등을 실행할 수 있다.

### Core Requirements

- 사이드바에 "터미널" 메뉴 항목 추가
- 탭으로 터미널을 열 수 있음 (워크스페이스당 1개)
- 워크스페이스 폴더 경로를 기본 working directory로 사용
- 실제 shell(zsh/bash) 프로세스를 Electron main process에서 spawn
- xterm.js 기반의 터미널 에뮬레이터 UI

## 2. User Stories

| ID    | Story                                                            | Priority |
| ----- | ---------------------------------------------------------------- | -------- |
| US-01 | 사이드바에서 "터미널"을 클릭하면 터미널 탭이 열린다              | Must     |
| US-02 | 터미널은 현재 워크스페이스 폴더 경로에서 시작된다                | Must     |
| US-03 | 터미널에서 shell 명령어를 입력하고 결과를 볼 수 있다             | Must     |
| US-04 | 터미널에서 Claude Code 등 CLI 도구를 실행할 수 있다              | Must     |
| US-05 | 탭을 닫으면 해당 터미널 프로세스가 종료된다                      | Must     |
| US-06 | 워크스페이스 전환/닫기 시 기존 터미널이 종료된다                 | Must     |
| US-07 | 앱 종료 시 모든 터미널 프로세스가 종료된다                       | Must     |
| US-08 | 탭 스냅샷 복원 시 터미널 탭이 있으면 새 터미널을 시작한다        | Should   |
| US-09 | shell 프로세스가 자체 종료(exit)되면 터미널 탭이 자동으로 닫힌다 | Must     |

## 3. Technical Approach

### Architecture

```
[Renderer]                          [Main Process]
xterm.js Terminal UI  <--IPC-->  node-pty (pseudo-terminal)
  - @xterm/xterm + @xterm/addon-fit   - pty.spawn(shell, [], { cwd, cols, rows })
  - 키 입력 전송 (send, fire-and-forget) - stdout 스트림 전달 (webContents.send)
  - 출력 렌더링                         - 프로세스 수명 관리
```

### Key Libraries

- **node-pty**: Electron main process에서 pseudo-terminal 생성 (native addon)
- **@xterm/xterm**: Renderer에서 터미널 에뮬레이터 렌더링 (v5+)
- **@xterm/addon-fit**: 터미널 크기 자동 조절

### DB Layer

- 없음. 터미널은 런타임 전용 기능으로 DB를 사용하지 않는다.
- 탭 스냅샷 복원 시 터미널 탭 데이터(type, pathname 등)는 복원되지만, 스크롤 히스토리 등 터미널 고유 상태는 복원되지 않는다 (새 pty spawn).

### 단일 터미널 모델

사이드바의 터미널은 기존 sidebar_items 정적 라우트 패턴을 그대로 따른다:

- pathname: `/terminal` (고정)
- tab.id: `tab-terminal` (createTabId 규칙에 의해 자동 생성)
- 같은 pathname → 중복 탭 없이 기존 탭 활성화
- 워크스페이스당 단 1개의 터미널만 존재

### Layer Mapping (FSD)

| Layer             | Component                 | Role                                                                                                                                   |
| ----------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| shared/constants  | `tab-url.ts`              | TabType에 `'terminal'` 추가, ROUTES에 `/terminal`, sidebar_items에 항목 추가, TAB_ICON에 아이콘 등록                                   |
| pages/terminal    | `TerminalPage.tsx`        | 터미널 탭 페이지. `TabContainer scrollable={false} maxWidth="full"` 사용 (xterm 자체 스크롤 사용, PDF/Image/Canvas-detail과 동일 패턴) |
| features/terminal | hooks + lib               | xterm.js 초기화, IPC 통신, fit 로직. xterm CSS(`@xterm/xterm/css/xterm.css`)도 이 레이어에서 import (lazy load 시 함께 로드)           |
| main/services     | `terminal.ts`             | node-pty 프로세스 관리 (단일 변수 `let currentPty: IPty \| null`)                                                                      |
| main/ipc          | `terminal.ts`             | IPC 핸들러 등록                                                                                                                        |
| preload           | `index.ts` / `index.d.ts` | terminal API bridge                                                                                                                    |
| app/layout/model  | `pane-routes.tsx`         | PANE_ROUTES에 터미널 라우트 등록                                                                                                       |

### IPC Protocol

```
Renderer → Main (request-response, ipcMain.handle / ipcRenderer.invoke):
  terminal:create   → { cwd, cols, rows } → IpcResponse<void>
                      fs.accessSync(cwd) 검증 → 실패 시 ValidationError throw (기존 note/folder 패턴)
                      기존 pty가 있으면 자동 kill 후 새로 spawn
  terminal:destroy  → {} → IpcResponse<void>
                      pty.kill(), currentPty = null (멱등적 — 이미 null이면 no-op)

Renderer → Main (fire-and-forget, ipcMain.on / ipcRenderer.send):
  terminal:write    → { data } → pty.write(data)   (고빈도, 매 키 입력)
  terminal:resize   → { cols, rows } → pty.resize() (리사이즈 시)

Main → Renderer (push, webContents.send / ipcRenderer.on):
  terminal:data     ← { data } → pty 출력 전달
  terminal:exit     ← { exitCode } → 프로세스 종료 알림 → renderer에서 탭 자동 닫기
```

- `terminal:create/destroy`: 응답이 필요하므로 invoke/handle 패턴. `handle()` wrapper 사용 (node-pty spawn은 동기적이므로 호환)
- `terminal:write/resize`: 고빈도 단방향이므로 send/on (fire-and-forget) 패턴. **프로젝트 최초의 `ipcRenderer.send` 사용** (기존 renderer→main 통신은 모두 `invoke`)
- `terminal:data/exit`: 기존 onChanged/onFired 패턴과 동일 (`webContents.send` + `ipcRenderer.on`), cleanup 함수 `() => removeListener` 반환

### 초기화 순서

1. TerminalPage mount → xterm.js `Terminal` 인스턴스 생성 + DOM에 `term.open(container)`
2. `fitAddon.fit()` 호출 → 현재 컨테이너 크기 기준 `cols`, `rows` 확정
3. `terminal:create({ cwd, cols, rows })` invoke → main에서 pty spawn
4. `onData` 리스너 등록 → pty 출력을 xterm에 write
5. xterm `onData` 이벤트 → 키 입력을 `terminal:write`로 send

### 워크스페이스 경로 획득

터미널 생성 시 cwd가 필요하다:

1. Renderer: `useCurrentWorkspaceStore` → `currentWorkspaceId`
2. Renderer: `window.api.workspace.getById(workspaceId)` → `workspace.path`
3. `terminal:create({ cwd: workspace.path, cols, rows })` 호출

### 터미널 수명 관리

| 이벤트                         | 동작                                                                                                                                                                                                                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 사이드바 클릭                  | 터미널 탭 열기 → TerminalPage mount → 초기화 순서 실행                                                                                                                                                                                                                              |
| 탭 닫기                        | TerminalPage unmount → `useEffect` cleanup → `terminal:destroy`                                                                                                                                                                                                                     |
| shell 자체 종료                | 사용자가 `exit` 입력 등 → main이 `terminal:exit` push → renderer `onExit` 콜백에서 workspaceId guard 확인 후 `closeTabByPathname('/terminal')` 호출 → 탭 자동 닫기                                                                                                                  |
| 탭 닫기 + shell 종료 동시 발생 | race condition 가능하나, `closeTab`은 멱등적(탭 없으면 early return), `terminal:destroy`도 멱등적(`currentPty?.kill(); currentPty = null`) → 안전                                                                                                                                   |
| 워크스페이스 전환              | `applySessionToStore`로 탭 교체 → 같은 tab.id(`tab-terminal`)가 유지될 수 있음 → **`useEffect` dep에 `workspaceId`를 포함**하여 워크스페이스 변경 시 무조건 `destroy → create` 사이클 실행. 추가로 main의 `terminal:create`가 기존 pty를 자동 kill 후 새로 spawn하는 방어 로직 포함 |
| 탭 스냅샷 복원                 | 터미널 탭 포함 시 TerminalPage mount → 새 pty spawn                                                                                                                                                                                                                                 |
| 앱 종료                        | `app.on('before-quit')` → `terminalService.destroy()` 호출하여 활성 pty 강제 종료 (기존 `reminderScheduler.stop()`, `workspaceWatcher.stop()`과 동일 체인에 추가)                                                                                                                   |

**워크스페이스 전환 핵심 이슈**: `applySessionToStore`는 탭 스토어를 통째로 교체하지만, 양쪽 세션 모두 `/terminal` 탭이 있으면 `tab.id`가 동일(`tab-terminal`)하여 React가 컴포넌트를 재사용(unmount 안 함)한다. 따라서 `useEffect` cleanup에만 의존하면 이전 pty가 살아남는다. 이를 `workspaceId` dependency와 main의 자동 교체 로직으로 이중 방어한다.

## 4. Scope

### In Scope

- 기본 터미널 기능 (shell spawn, I/O)
- 사이드바 메뉴 + 탭 통합 (단일 터미널)
- 워크스페이스 cwd 설정
- 터미널 크기 자동 조절 (fit addon)
- 수명 관리 (탭 닫기, shell 자체 종료, 워크스페이스 전환, 앱 종료 시 정리)
- 탭 스냅샷 복원 시 새 터미널 시작

### Out of Scope

- 다중 터미널 탭
- 터미널 분할 (split pane)
- 터미널 테마/색상 커스터마이징
- shell 자동완성/인텔리센스
- 터미널 히스토리/스크롤백 저장/복원

## 5. Risks & Considerations

| Risk                                             | Impact | Mitigation                                                                                                                                                                                                                                            |
| ------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| node-pty는 native addon → 빌드 환경 의존성       | Low    | `postinstall`의 `@electron/rebuild -f`로 개발/빌드 모두 커버. electron-vite v5는 main/preload에만 `externalizeDeps: true` 적용하므로 node-pty(main) 자동 external, xterm(renderer)은 정상 번들. `better-sqlite3`, `@parcel/watcher`와 동일 파이프라인 |
| xterm.js CSS/폰트 렌더링 이슈                    | Medium | `@xterm/xterm/css/xterm.css`를 features/terminal에서 import. 모노스페이스 폰트 지정                                                                                                                                                                   |
| 프로세스 누수 (pty가 안 죽는 경우)               | High   | `before-quit`에서 강제 종료, `useEffect` cleanup + `workspaceId` dep 이중 방어, `terminal:create` 시 기존 pty 자동 kill, `terminal:exit` 수신 시 탭 자동 닫기                                                                                         |
| 워크스페이스 전환 시 tab.id 동일로 unmount 안 됨 | High   | `useEffect` dep에 `workspaceId` 포함, main `terminal:create`에서 기존 pty 자동 교체 (이중 방어)                                                                                                                                                       |
| `ipcRenderer.send` 프로젝트 최초 사용            | Low    | `contextBridge`를 통한 `send` 노출은 Electron 공식 지원. 기존 `invoke` 전용 구조에서 `send` 메서드 추가만 하면 됨                                                                                                                                     |
| 워크스페이스 경로 미존재 시 pty spawn 실패       | Medium | `terminal:create` 핸들러에서 `fs.accessSync(cwd)` 검증, 실패 시 `ValidationError` throw. 기존 `note.ts`, `folder.ts`의 경로 검증 패턴과 동일                                                                                                          |

## 6. Success Criteria

- [ ] 사이드바에서 터미널 탭을 열 수 있다
- [ ] 워크스페이스 폴더에서 shell이 시작된다
- [ ] 명령어 입력/출력이 정상 동작한다
- [ ] Claude Code (`claude`) 실행이 가능하다
- [ ] 탭 닫기 시 프로세스가 정리된다
- [ ] shell 자체 종료(`exit`) 시 탭이 자동으로 닫힌다
- [ ] 워크스페이스 전환 시 기존 터미널이 종료되고 새 터미널이 시작된다
- [ ] 앱 종료 시 모든 터미널 프로세스가 종료된다
- [ ] 탭 스냅샷 복원 시 터미널이 새로 시작된다
