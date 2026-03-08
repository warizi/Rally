# Plan: MCP API Dead Code 삭제 및 정리

## 1. Overview

`src/main/mcp-api/routes/` 하위의 **내부 REST API 라우트 6개 파일(608줄)**이 dead code로 확인됨. MCP 전용 라우트(`routes/mcp/`)가 동일 기능을 완전히 대체하고 있으며, 내부 라우트를 호출하는 클라이언트가 존재하지 않음. 이를 삭제하고 라우트 구조를 정리한다.

## 2. Goals

| #   | Goal                                                                   | Priority |
| --- | ---------------------------------------------------------------------- | -------- |
| G-1 | 내부 REST 라우트 6개 파일 삭제 (608줄 제거)                            | Must     |
| G-2 | `routes/index.ts`를 MCP 라우트만 등록하도록 간소화                     | Must     |
| G-3 | 각 파일에 중복된 `requireBody()` 제거 (이미 `mcp/helpers.ts`로 통합됨) | Must     |
| G-4 | 불필요한 과거 plan/design 문서 정리 (선택)                             | Could    |

## 3. Current Problems

### 3.1 Dead Code: 내부 REST 라우트 (608줄)

아래 파일들은 `/api/workspaces/:wsId/...` 패턴의 RESTful API를 정의하지만, **호출하는 코드가 없다.**

| 파일           | 줄 수   | 엔드포인트 수 | 상태      |
| -------------- | ------- | ------------- | --------- |
| `workspace.ts` | 15      | 1             | dead code |
| `folder.ts`    | 103     | 5             | dead code |
| `note.ts`      | 136     | 6             | dead code |
| `csv.ts`       | 150     | 7             | dead code |
| `canvas.ts`    | 192     | 9             | dead code |
| `search.ts`    | 12      | 1             | dead code |
| **합계**       | **608** | **29**        |           |

- Electron Renderer는 IPC(`window.api.*`)를 통해 main process와 통신 → HTTP API 미사용
- MCP 라우트(`routes/mcp/`)가 동일 기능을 11개 엔드포인트로 통합 완료
- `mcp-tools-optimization.plan.md`에서 29개 → 11개 통합 계획이 이미 실행됨

### 3.2 `routes/index.ts`의 불필요한 등록

현재 `registerAllRoutes()`가 dead code 라우트 6개 + MCP 라우트 1개를 모두 등록 중.

### 3.3 `requireBody()` 중복 정의

- `note.ts`, `csv.ts`, `folder.ts`, `canvas.ts` 각각에 동일한 함수 정의
- 이미 `mcp/helpers.ts`에 통합본이 존재
- 파일 삭제로 자연스럽게 해결됨

## 4. Proposed Solution

### 4.1 삭제 대상

```
삭제:
  src/main/mcp-api/routes/workspace.ts
  src/main/mcp-api/routes/folder.ts
  src/main/mcp-api/routes/note.ts
  src/main/mcp-api/routes/csv.ts
  src/main/mcp-api/routes/canvas.ts
  src/main/mcp-api/routes/search.ts
```

### 4.2 수정 대상

**`routes/index.ts`** — MCP 라우트만 등록:

```typescript
import type { Router } from '../router'
import { registerMcpRoutes } from './mcp/index'

export function registerAllRoutes(router: Router): void {
  registerMcpRoutes(router)
}
```

### 4.3 정리 후 구조

```
src/main/mcp-api/
├── server.ts
├── router.ts
├── lib/
│   ├── body-parser.ts
│   └── broadcast.ts
└── routes/
    ├── index.ts            ← 간소화
    └── mcp/
        ├── index.ts
        ├── helpers.ts
        ├── items.ts
        ├── folders.ts
        ├── canvases.ts
        └── todos.ts
```

## 5. Impact Analysis

| 항목         | 영향                                |
| ------------ | ----------------------------------- |
| Renderer     | 없음 (IPC 사용, HTTP API 미사용)    |
| MCP 에이전트 | 없음 (mcp/ 라우트는 그대로)         |
| 빌드         | 파일 삭제로 빌드 크기 감소          |
| 테스트       | 내부 API 관련 테스트 없음 확인 필요 |

## 6. Risks

| Risk               | Likelihood            | Mitigation                |
| ------------------ | --------------------- | ------------------------- |
| 숨겨진 호출처 존재 | 낮음 (grep 확인 완료) | typecheck 후 런타임 확인  |
| 향후 내부 API 필요 | 낮음                  | git history에서 복원 가능 |

## 7. Implementation Steps

1. 내부 라우트 6개 파일 삭제
2. `routes/index.ts` 수정
3. `npm run typecheck:node` 통과 확인
4. `npm run lint` 통과 확인
5. 앱 실행하여 MCP 기능 정상 동작 확인

## 8. Success Criteria

- [x] 내부 라우트 6개 파일 삭제됨
- [ ] `routes/index.ts`가 MCP 라우트만 등록
- [ ] typecheck + lint 통과
- [ ] MCP 에이전트(Claude) 정상 연동 확인
- [ ] 608줄 dead code 제거
