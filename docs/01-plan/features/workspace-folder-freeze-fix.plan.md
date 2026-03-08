# Plan: workspace-folder-freeze-fix

## 증상

앱 켜고 워크스페이스 진입 시 (또는 워크스페이스 생성 직후) 매번 5초 가량 앱이 freeze (마우스 커서 대기 상태).

## Root Cause

### 블로킹 경로

```
folder:readTree IPC (main thread, 동기)
  ├─ workspaceWatcher.ensureWatching()  ← void, fire-and-forget
  └─ folderService.readTree()           ← 동기 실행, main thread 점유
       ├─ readDirRecursive()            ← 수천 dirs 재귀 스캔 (동기 fs.readdirSync)
       ├─ createMany(N rows)            ← 청크 insert (already fixed)
       ├─ deleteOrphans()               ← JS diff + chunked delete (already fixed)
       └─ findByWorkspaceId() + buildTree()
```

- `folderService.readTree`가 **매번** fs 전체 재귀 스캔을 수행
- node_modules 포함 대형 워크스페이스: 스캔만 수초 소요
- IPC 응답이 올 때까지 렌더러 전체가 블로킹

### 왜 매번 발생하는가

`ensureWatching` 은 `activeWorkspaceId === workspaceId` 이면 no-op 이지만,
`folderService.readTree` 는 watcher 상태와 무관하게 **항상** fs 스캔을 실행한다.

## Fix 설계

### 원칙

- **IPC 핸들러**: DB만 읽어 즉시 반환 (블로킹 없음)
- **Watcher**: 백그라운드에서 fs 스캔 + 동기화
- **완료 신호**: 동기화 후 `folder:changed` 이벤트 push → 렌더러 re-fetch

### 변경 파일 3개

#### 1. `src/main/services/folder.ts`

`folderService.readTreeFromDb(workspaceId)` 추가:

- DB rows만 읽어 tree 구성 반환
- fs 스캔 없음 → 수 ms 내 반환

`readTree` 는 테스트용으로 유지 (IPC에서는 더 이상 사용 안 함)

#### 2. `src/main/ipc/folder.ts`

`folder:readTree` 핸들러:

- `folderService.readTree()` → `folderService.readTreeFromDb()` 로 교체

#### 3. `src/main/services/workspace-watcher.ts`

`start()` 메서드 끝 (subscription 설정 완료 후):

- `this.pushFolderChanged(workspaceId)` 호출 추가
- 초기 동기화 완료 신호 → 렌더러가 re-fetch

또한 `syncOfflineChanges` 내 `fullReconciliation` 호출에 try/catch 추가:

- 동기화 실패해도 watcher 자체는 정상 시작
- UnhandledPromiseRejection 방지

### 실행 흐름 (Fix 후)

```
[앱 시작 or 워크스페이스 진입]

folder:readTree IPC
  ├─ ensureWatching()           ← background 시작
  └─ readTreeFromDb()           ← DB만 읽음, 즉시 응답 (수 ms)

[렌더러: 현재 DB 상태 표시 - 빠름]

[백그라운드: watcher 동기화]
  syncOfflineChanges
    → (최초) fullReconciliation: readDirRecursive + createMany + deleteOrphans
    → (이후) getEventsSince: 변경분만 처리 (빠름)
  → pushFolderChanged()

[렌더러: folder:changed 수신]
  → useFolderWatcher → invalidateQueries
  → folder:readTree 재호출 → readTreeFromDb → 최신 트리 반환
```

### UX

| 상황        | 변경 전                 | 변경 후                                           |
| ----------- | ----------------------- | ------------------------------------------------- |
| 최초 진입   | 5초 freeze 후 트리 표시 | 즉시 표시 (빈 트리 or 기존 DB), 수초 후 자동 갱신 |
| 이후 진입   | 매번 5초 freeze         | 즉시 DB 트리 표시 (snapshot 기반 동기화, 빠름)    |
| 실시간 변경 | 정상                    | 동일                                              |

## Acceptance Criteria

- [ ] 워크스페이스 진입 시 IPC 응답이 500ms 이내
- [ ] 폴더 트리가 정상 표시됨 (초기 빈 트리 → 자동 갱신)
- [ ] 기존 folder 테스트 전체 통과
- [ ] UnhandledPromiseRejection 없음
