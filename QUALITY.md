# Quality Contract & Re-evaluation Checklist

Rally의 품질 기준을 **수치와 자동 게이트**로 명문화한 문서. 개선 후 같은 기준으로 재평가할 수
있도록 평가 축, CI 게이트, 개선 전/후 지표, 남은 tradeoff를 기록한다.

> 갱신 규칙: 게이트 한도(coverage threshold, bundle budget 등)를 바꾸면 그 PR에서 근거를
> 남기고 이 문서를 함께 갱신한다.

---

## 1. CI 품질 게이트 (자동 강제)

모든 항목은 `.github/workflows/test.yml`에서 PR마다 **차단(blocking) 게이트**로 실행된다.

| 게이트               | 기준                                                                                          | 구현                                                               |
| -------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Lint                 | error 0 / **warning 0**                                                                       | `npm run lint -- --max-warnings 0`                                 |
| Typecheck            | node + web 통과                                                                               | `npm run typecheck`                                                |
| Node coverage        | lines 80 / functions 75 / branches 70 / statements 78                                         | `vitest.config.node.mts` (bootstrap·index 제외)                    |
| Web coverage         | lines 75 (merge job)                                                                          | `vitest.config.web.mts`                                            |
| Bundle budget        | 메인 청크 gzip ≤ **430KB**, 전체 gzip ≤ **2.15MB**                                            | `scripts/check-bundle-budget.mjs`                                  |
| 청크 분리            | xyflow/react-pdf/xterm/recharts/milkdown/dnd-kit/framer-motion/**codemirror**/**prosemirror** | `scripts/verify-chunks.mjs`                                        |
| Electron security    | HIGH severity finding **0**                                                                   | `security:scan:high` 출력 파싱 (`LimitNavigationGlobalCheck` 제외) |
| FSD boundary         | `boundaries/element-types` 위반 0                                                             | `eslint-plugin-boundaries` grep                                    |
| Cleanup completeness | 신규 테이블 cleanup 등록 누락 0                                                               | `scripts/check-cleanup-completeness.mjs`                           |
| IPC contract drift   | 선언↔런타임 네임스페이스 일치                                                                 | `api-contract-drift.test.ts`                                       |
| Window security      | sandbox/contextIsolation/navigation 정책 소스 스캔                                            | `window-security.test.ts`                                          |

---

## 2. 재평가 체크리스트 (8축)

| 축                  | 확인 항목                                                                                                 | 근거/게이트                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Architecture        | FSD 경계, main/preload/renderer 분리, bootstrap 책임 분리                                                 | boundary check, `src/main/bootstrap/*`, `src/preload/types/*`                       |
| Security            | sandbox·contextIsolation, navigation allowlist(will-navigate), IPC zod 검증(100%), external URL allowlist | window-security.test, ipc-validation-coverage.test, security:scan:high              |
| Testability         | 단위/통합 커버리지 threshold, 로그 noise 통제, 회귀 정적 테스트                                           | coverage gate, logger.test, drift/coverage 정적 테스트                              |
| Performance         | bundle budget, route/다이얼로그 lazy, 가상화, 렌더 회귀 보호                                              | check-bundle-budget, lazy SettingsDialog, FolderTree 가상화, TodoListItem memo test |
| Maintainability     | 파일/타입 surface 크기, bootstrap 책임 분리                                                               | index.d.ts 78줄, index.ts 41줄                                                      |
| CI/Release          | 품질 게이트 자동화, bundle/security/coverage 리포팅                                                       | 위 §1                                                                               |
| Repository hygiene  | 생성 산출물 미추적, ignore 정책 일치                                                                      | `.gitignore` `*.tsbuildinfo` 등                                                     |
| Product reliability | workspace watcher, trash 복구, backup/restore, MCP 계약                                                   | 해당 service 테스트 + contract-drift                                                |

---

## 3. 개선 전/후 지표 (9.5+ 로드맵)

| 항목                      | before             | after                              |
| ------------------------- | ------------------ | ---------------------------------- |
| Renderer 메인 청크 (gzip) | 1.08 MB            | **373 KB** (−65%)                  |
| `src/preload/index.d.ts`  | 992줄              | **78줄** (도메인 타입 20파일 분리) |
| `src/main/index.ts`       | 347줄              | **41줄** (bootstrap 5모듈 분리)    |
| 테스트 로그 EPERM         | 발생 가능          | 파일 transport off(test)           |
| production 테스트 계측    | globalThis 카운터  | **제거** (test-only mock)          |
| 생성 산출물 추적          | tsbuildinfo 추적됨 | **untrack + ignore**               |
| Bundle budget 게이트      | 없음               | **추가** (메인 430KB/전체 2.15MB)  |
| Lint 게이트               | informational      | **blocking** (`--max-warnings 0`)  |
| Security 게이트           | informational      | **blocking** (HIGH=0)              |

> 선행 품질 작업(별도 로드맵): IPC 입력검증 100%, Navigation 보안, Lint 0, stderr 노이즈 정리,
> Preload 계약 디커플링.

---

## 4. 남은 tradeoff / 의도적 보류

- **electronegativity free** `LIMIT_NAVIGATION_GLOBAL_CHECK` false positive — `security:scan:high`에서 `-x`로 제외. 실제 navigation 통제는 `window-security.test`가 소스 스캔으로 강제.
- **pdfjs-dist** "legacy build" 경고(web 테스트, jsdom 환경 감지) — 코드 결함 아님, 라이브러리 한계로 추적.
- **잔여 act 경고**는 0이나, 일부는 RTL waitFor/act 래핑으로 해소했고 라이브러리 내부 비동기는 추적 대상.
- **Preload DTO 중복** — main DB row 타입과 분리(WorkspaceDTO 등)하며 의도적 중복 허용(결합 축소 우선).
- **Electron 실구동 smoke test** — CI flaky/비용으로 보류. preload surface/보안은 정적 테스트로 대체 검증.
- **TodoListItem memo 측정** — React Profiler는 래퍼 재렌더로 "정확히 0" 측정 불가 → test-only child mock 사용.

---

## 5. 릴리즈 신뢰 기준 (release confidence)

릴리즈 전 다음이 모두 green이어야 한다:

```bash
npm run lint -- --max-warnings 0
npm run typecheck
npm run test          # main(node)
npm run test:web      # renderer
npm run build:size && node scripts/check-bundle-budget.mjs
npm run security:scan:high
npm run check:cleanup
```

CI는 위를 PR마다 강제하며, 모든 게이트 통과 + 리뷰 승인 시에만 `develop` 머지한다.
