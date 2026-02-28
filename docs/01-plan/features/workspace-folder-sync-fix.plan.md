# Plan: workspace-folder-sync-fix

## Overview

Workspace를 큰 디렉토리(예: node_modules 포함 프로젝트)로 지정할 때
`SqliteError: too many SQL variables` 에러로 폴더 동기화가 완전히 실패하는 버그 수정.

## Problem Analysis

### Root Cause

SQLite 는 단일 쿼리에서 bind parameter 수를 **999개**로 제한한다.

| 위치 | 쿼리 | 변수 수 |
|------|------|---------|
| `folderRepository.createMany` | `INSERT INTO folders VALUES (?, ?, …) * N` | `7 columns × N rows` |
| `folderRepository.deleteOrphans` | `DELETE … NOT IN (path1, path2, …)` | `N paths` |

`folders` 테이블 컬럼: id, workspaceId, relativePath, color, order, createdAt, updatedAt (7개)

- `createMany`: **143행 이상** → 에러 (`7 × 143 = 1001 > 999`)
- `deleteOrphans`: **1000개 이상** path → 에러

### Reproduction

Rally 프로젝트 폴더 자체를 workspace로 지정
→ `node_modules` 포함 수천 개 디렉토리 스캔
→ `fullReconciliation` → `createMany(수천 행)` → **즉시 크래시**

### Error Stack

```
SqliteError: too many SQL variables
  at folderRepository.createMany (out/main/index.js:234)
  at WorkspaceWatcherService.fullReconciliation (out/main/index.js:857)
  at WorkspaceWatcherService.syncOfflineChanges (out/main/index.js:710)
  at WorkspaceWatcherService.start (out/main/index.js:667)
```

## Affected Files

| 파일 | 변경 내용 |
|------|-----------|
| `src/main/repositories/folder.ts` | `createMany` chunking, `deleteOrphans` JS-side 필터링 |
| `src/main/services/folder.ts` | `readTree` 내부 동일 패턴 (같은 repo 메서드 호출이므로 자동 수혜) |

## Fix Plan

### Fix 1 — `folderRepository.createMany` chunking

```typescript
const CHUNK_SIZE = 100  // 7 columns × 100 = 700 variables (안전 마진)

createMany(items: FolderInsert[]): void {
  if (items.length === 0) return
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    db.insert(folders).values(items.slice(i, i + CHUNK_SIZE)).onConflictDoNothing().run()
  }
}
```

### Fix 2 — `folderRepository.deleteOrphans` JS-side diff

`NOT IN (huge list)` 대신, DB에서 id만 조회 → JS Set으로 orphan 판별 → id 배열로 배치 DELETE

```typescript
const CHUNK_SIZE = 900  // id 1 variable/row, 안전 마진

deleteOrphans(workspaceId: string, existingPaths: string[]): void {
  if (existingPaths.length === 0) {
    db.delete(folders).where(eq(folders.workspaceId, workspaceId)).run()
    return
  }
  const existingSet = new Set(existingPaths)
  const dbRows = db.select({ id: folders.id, relativePath: folders.relativePath })
    .from(folders).where(eq(folders.workspaceId, workspaceId)).all()
  const orphanIds = dbRows.filter(r => !existingSet.has(r.relativePath)).map(r => r.id)
  if (orphanIds.length === 0) return
  for (let i = 0; i < orphanIds.length; i += CHUNK_SIZE) {
    db.delete(folders).where(inArray(folders.id, orphanIds.slice(i, i + CHUNK_SIZE))).run()
  }
}
```

### Error Handling

- `WorkspaceWatcherService.start` / `syncOfflineChanges` 에 `try/catch` 추가
  → UnhandledPromiseRejection 방지, 실패 시 watcher 없이 계속 진행 (기존 `subscription` 시작은 정상)

## Acceptance Criteria

- [ ] Rally 프로젝트 폴더를 workspace로 지정해도 에러 없이 동기화 완료
- [ ] 143개 이상 폴더 insert 성공
- [ ] 1000개 이상 path로 deleteOrphans 성공
- [ ] 기존 folderRepository 테스트 통과
- [ ] UnhandledPromiseRejectionWarning 로그 사라짐

## Out of Scope

- `node_modules` 같은 대용량 폴더 필터링 (사용자가 선택한 경로 그대로 사용)
- 워크스페이스 경로 유효성 UI 개선

## Priority

**High** — 앱 시작 시 즉시 크래시되어 핵심 기능(폴더 동기화)이 완전히 불가

## Estimated Scope

- 변경 파일: 1개 (`folder.ts` repository)
- 코드 변경: ~20 lines
