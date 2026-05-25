/**
 * 앱에 번들된 기본 (system) skill 의 source of truth.
 *
 * 이전에는 `.claude/skills/<name>/SKILL.md` 파일을 런타임에 읽었지만,
 * 이제는 이 상수가 곧 default 이고 첫 부팅 시 DB (`system_skills`) 로 seed 된다.
 * 사용자가 본문을 수정하면 DB row 가 갱신되고, "기본값으로 복원" 시 이 상수에서 재seed.
 */

export interface SystemSkillSeed {
  name: string
  content: string
  mcpTools: string[]
  triggers: string[]
}

const RALLY_CONTENT = `---
name: rally
description: |
  Use this skill whenever the user is working inside Rally — a productivity app
  with notes, todos, canvases, schedules, and tags. Triggers include: asking about
  tasks or todos ("할일", "오늘 뭐 해야 해", "작업 목록"), notes or documents
  ("노트", "정리해줘", "문서"), schedules or calendar ("일정", "캘린더"), tags,
  canvases, or any request to create/update/link/organize items in the workspace.
  Also triggers on morning briefings, end-of-day reviews, context-switching between
  projects, or any request that involves reading or writing Rally data via MCP.
  Use this skill even when the user doesn't explicitly mention Rally — if they're
  asking you to manage tasks, take notes, or organize work, this skill applies.
  Do NOT use for general knowledge questions that don't require reading or writing
  Rally data.
---

# Rally MCP Skill

Rally는 노트 / 할일 / 캔버스 / 일정 / 태그를 하나로 통합한 생산성 앱이다.
Claude는 MCP 툴을 통해 Rally 데이터를 읽고 쓸 수 있다.
이 skill은 Claude가 Rally 작업 시 올바른 툴을 올바른 순서로 사용하도록 안내한다.

## Why this skill exists

MCP 툴 없이 Claude는 Rally 워크스페이스의 실제 상태를 모른다.

- 어떤 폴더가 있는지, 노트가 어디 있는지 알 수 없음
- 할일 목록, 일정, 링크 관계를 조회할 수 없음
- 추측으로 노트를 만들면 잘못된 폴더에 저장되거나 링크가 누락됨

→ 항상 read 먼저, write 나중.

## 핵심 개념

| 개념         | 설명                                                 |
| ------------ | ---------------------------------------------------- |
| 워크스페이스 | Rally의 최상위 단위. 모든 데이터가 여기에 속함       |
| 폴더         | 노트/파일을 담는 계층 구조                           |
| 노트         | 마크다운 문서. 핵심 콘텐츠 단위                      |
| 할일(todo)   | 상태(할일/진행중/완료/보류) + 우선순위 + 2depth 계층 |
| 링크         | 노트 ↔ 할일 ↔ 캔버스 등 아이템 간 양방향 연결        |
| 태그         | 아이템에 붙이는 분류 레이블                          |
| 캔버스       | 노드+엣지 기반 시각화 보드                           |

## 작업 유형별 MCP 툴 매핑

| 요청 유형           | 사용할 툴 (순서대로)                                            |
| ------------------- | --------------------------------------------------------------- |
| 할일 조회           | \`read_tasks(mode:active\\|today\\|completed)\`                     |
| 할일 추가/수정/완료 | \`manage_tasks\`                                                  |
| 오늘 브리핑         | \`read_tasks(mode:today)\` → \`read_workspace(mode:recent)\`        |
| 노트 검색           | \`search(query, types:["note"])\`                                 |
| 폴더 구조 파악      | \`browse(types:["folder"], summary:true)\`                        |
| 노트 내용 읽기      | \`browse\`로 ID 확인 → \`read([id])\`                               |
| 노트 생성           | \`browse\`(폴더 확인) → \`manage_content(create)\` → \`manage_links\` |
| 노트 수정           | \`read\`(기존 내용 확인) → \`manage_content(update)\`               |
| 아이템 간 연결      | \`manage_links(link)\`                                            |
| 캔버스 생성         | \`manage_canvas(create, nodes[], edges[])\`                       |
| 일정 등록           | \`manage_tasks(schedule, create)\`                                |
| 태그 붙이기         | \`manage_tags(attach)\`                                           |
| 폴더/파일 이동·정리 | \`manage_items(move\\|rename\\|create_folder)\`                     |

## 필수 패턴

### 노트 생성 시

\`\`\`
1. browse(types:["folder"], summary:true) — 폴더 구조 파악
2. manage_content(create, folderId:적절한폴더) — 노트 생성
3. manage_links(link) — 관련 할일/노트에 연결
\`\`\`

### 할일 생성 + 노트 연결 시

\`\`\`
1. manage_tasks(todo, create, linkItems:[noteId]) — 생성과 동시에 링크
   또는
1. manage_tasks(todo, create)
2. manage_links(link, todo ↔ note)
\`\`\`

### 기존 노트 수정 시

\`\`\`
1. read([noteId]) — 기존 내용 전체 확인 (이미지 참조 보존 필수)
2. manage_content(update, 전체 content 포함)
⚠️ content에서 /.images/ 참조를 누락하면 이미지 파일이 영구 삭제됨
\`\`\`

### 컨텍스트 스위칭 (프로젝트 전환) 시

\`\`\`
1. read_tasks(mode:active, search:"프로젝트명") — 관련 할일 확인
2. search("프로젝트명", types:["note","canvas"]) — 관련 노트/캔버스
3. browse(linkedTo:{type,id}) — 링크된 아이템 탐색
\`\`\`

## 주요 주의사항

- **browse summary 활용**: 폴더 목록만 필요할 때 \`summary:true\`로 토큰 절약
- **배치 우선**: 여러 할일 수정은 manage_tasks 단일 호출로 배치 처리
- **soft delete**: manage_items.delete는 휴지통 이동, 영구 삭제 아님
- **링크는 양방향**: manage_links 한 번으로 양쪽에 모두 링크됨
- **할일 계층**: 2depth까지만 가능 (subtodo에 subtodo 불가)
- **reminder offset**: 10분/30분/1시간/1일/2일 전만 지원
`

const RALLY_PLAN_CONTENT = `---
name: rally-plan
description: |
  Use this skill when the user says "rally-plan [할일이름 or 요청사항]" or asks
  to plan, break down, or structure a task — e.g. "rally-plan [로그인 기능 구현]",
  "이 할일 계획 세워줘", "subtodo로 나눠줘". This skill finds or creates a todo,
  reads existing subtodos and linked notes, presents a structured plan as a draft,
  collects user feedback iteratively, then applies the confirmed plan to Rally
  (subtodos + plan note). Triggers on explicit "rally-plan" invocation or any
  planning/breakdown request pointing at a specific task.
  Do NOT use for simply listing todos or executing tasks (use rally-do for that).
---

# Rally Plan Skill

할일 이름 또는 사용자 요청을 받아 Rally에서 계획을 수립하고,
피드백을 주고받은 후 확정된 계획을 Rally에 반영하는 플래닝 skill.

## 전체 흐름

\`\`\`
① 탐색      — 기존 할일 찾기 or 신규 준비
② 분석      — 현재 상태 파악 + 초안 제시 + 질문
③ 피드백 루프 — 확정될 때까지 수정 반복
④ 반영      — Rally에 subtodo + 플랜 노트 적용
\`\`\`

---

## Step 1: 탐색

\`\`\`
search(입력, types:["todo"])
\`\`\`

**매칭되는 할일이 있는 경우:**
\`\`\`
read_tasks(parentId: todoId)          — 기존 subtodo 확인
browse(linkedTo: {type:"todo", id})   — 연결 노트 확인
read([noteId, ...])                   — 노트 내용 읽기
\`\`\`

**매칭되는 할일이 없는 경우:**
- 신규 할일 생성 예정으로 표시하고 Step 2로 진행.
- 실제 생성은 Step 4(확정 후)에 한다.

---

## Step 2: 분석 + 초안 제시

읽은 정보를 바탕으로 **한 번에** 아래를 제시한다:

### 제시 형식
\`\`\`
## 현재 상태
- 할일: [이름] / [신규]
- 기존 subtodo: 있음 N개 / 없음
- 연결 노트: 있음 / 없음

## 제안 계획
[subtodo 목록 — 순서, 이름, 한 줄 설명]
1. subtodo A — 설명
2. subtodo B — 설명
3. subtodo C — 설명

## 플랜 노트 방향
[목적 / 접근 방법 / 참고사항 등 기술할 내용 요약]

## 확인이 필요한 부분
- 질문1?
- 질문2?
\`\`\`

- 불명확한 부분은 질문으로 함께 제시한다. 여러 번 왔다갔다하지 않도록 한 번에 몰아서.
- 기존 subtodo가 있으면 수정/보완 형태로 제안한다 (삭제 포함).

---

## Step 3: 피드백 루프

사용자 피드백을 받아 계획을 수정하고 재제시한다.

\`\`\`
반복:
  사용자 피드백
  → subtodo 구성 수정
  → 플랜 노트 방향 수정
  → 수정된 계획 재제시
  → "이대로 적용할까요?" 로 마무리
\`\`\`

- 사용자가 "좋아", "ㅇㅇ", "적용해" 등 확정 의사를 밝히면 Step 4로 진행.
- 추가 수정 요청이 있으면 루프를 반복한다.

---

## Step 4: Rally 반영 (확정 후)

### 신규 할일인 경우
\`\`\`
manage_tasks(todo, create, title, priority, ...)
\`\`\`

### subtodo 반영
기존 subtodo와 확정안을 비교해 최소한의 변경만 적용한다:

\`\`\`
추가할 것: manage_tasks(todo, create, parentId: todoId, ...)
수정할 것: manage_tasks(todo, update, subtodoId, title/status/...)
삭제할 것: manage_tasks(todo, delete, subtodoId)
\`\`\`

### 플랜 노트 반영
\`\`\`
browse(types:["folder"], summary:true)   — 적절한 폴더 파악

기존 노트가 없으면:
  manage_content(create, folderId, title:"[할일이름] 플랜", content:...)
  manage_links(link, note ↔ 부모todo)

기존 노트가 있으면:
  read([noteId])                          — 기존 내용 전체 확인
  manage_content(update, id, content:...) — 보완하여 업데이트
\`\`\`

플랜 노트 포함 내용:
- 목적 및 배경
- 접근 방법
- subtodo별 설명 및 완료 기준
- 참고사항 / 제약 조건

### 완료 알림
반영 완료 후 적용된 내용을 간략히 요약해서 알린다.

---

## 주의사항

- **확정 전엔 Rally에 쓰지 않는다**: Step 1~3은 읽기만. 쓰기는 Step 4에서만.
- **최소 변경**: 기존 subtodo를 무조건 교체하지 않고 수정/추가/삭제를 구분해 적용.
- **노트 수정 시**: 기존 content 전체를 read 후 포함 (이미지 참조 누락 시 영구 삭제).
- **질문은 한 번에**: 여러 불명확한 점은 Step 2에서 한꺼번에 제시한다.
- **피드백 루프 종료 기준**: 사용자가 명시적으로 확정 의사를 밝혔을 때만 Step 4 진행.
`

const RALLY_DO_CONTENT = `---
name: rally-do
description: |
  Use this skill when the user says "rally-do [할일이름]" or provides a list of
  todo names to execute — e.g. "rally-do [스펙 작성, 코드 리뷰]". This skill
  drives a structured execution loop: find the todo by name, mark it in-progress,
  read any linked notes for context, work through its subtodos in order, then
  write a result note and mark it complete. Triggers on explicit "rally-do" invocation
  or any request like "이 할일 진행해줘", "순서대로 처리해줘" pointing at specific todos.
  Do NOT use for general task browsing or creating new todos from scratch.
---

# Rally Do Skill

할일 이름을 받아 Rally 워크스페이스에서 찾아서 순차적으로 실행하고 결과를 기록하는 실행 루프 skill.

## 실행 루프

여러 할일이 주어지면 **하나씩 순서대로** 처리한다. 병렬 처리하지 않는다.

\`\`\`
for each 할일이름 in 입력목록:
    1. [탐색]   할일 찾기
    2. [시작]   진행중 + 연결 노트 읽기
    3. [실행]   subtodo 순차 처리
    4. [마무리] 결과 노트 생성 + 완료
\`\`\`

---

## Step 1: 탐색 — 할일 찾기

\`\`\`
search(할일이름, types:["todo"])
\`\`\`

- 제목 매칭으로 대상 todo를 찾는다.
- 여러 개 매칭되면 가장 제목이 정확히 일치하는 것 선택.
- 못 찾으면 사용자에게 알리고 다음 할일로 넘어간다.
- subtodo 목록 확인: \`read_tasks(parentId: todoId)\`

---

## Step 2: 시작 — 진행중 전환 + 컨텍스트 로드

\`\`\`
manage_tasks(todo, update, id, status:"진행중")
\`\`\`

연결된 노트가 있으면 반드시 읽는다:
\`\`\`
browse(linkedTo: {type:"todo", id: todoId})
→ 노트 id 추출 → read([noteId, ...])
\`\`\`

노트 내용은 이후 실행의 컨텍스트로 활용한다.

---

## Step 3: 실행 — subtodo 순차 처리

subtodo가 있는 경우:
- **순서대로** 하나씩 처리한다 (createdAt 오름차순).
- 각 subtodo 시작 전: \`manage_tasks(todo, update, subtodoId, status:"진행중")\`
- 각 subtodo 완료 후: \`manage_tasks(todo, update, subtodoId, isDone:true)\`
- subtodo에 연결된 노트가 있으면 마찬가지로 읽고 활용한다.

subtodo가 없는 경우:
- 할일 제목 + 연결 노트 내용을 기반으로 직접 작업을 수행한다.

---

## Step 4: 마무리 — 결과 기록 + 완료

### 결과 노트 생성
작업 결과 또는 사용자가 알아야 할 정보가 있으면 노트로 저장한다.

\`\`\`
browse(types:["folder"], summary:true)   — 적절한 폴더 파악
manage_content(create, folderId:..., title:"[할일이름] 결과", content:...)
manage_links(link, note ↔ todo)          — 원래 할일에 연결
\`\`\`

결과 노트에 포함할 내용:
- 수행한 작업 요약
- 주요 결정사항 또는 산출물
- 다음 단계 또는 후속 작업이 있다면 명시

### 완료 처리
\`\`\`
manage_tasks(todo, update, id, isDone:true)
\`\`\`

---

## 주의사항

- **순서 엄수**: subtodo는 반드시 createdAt 오름차순으로 처리한다.
- **노트 수정 시**: 기존 content 전체를 read 후 포함해야 한다 (이미지 참조 누락 시 영구 삭제).
- **결과 노트**: 결과가 없거나 사용자에게 알릴 내용이 없으면 생성하지 않아도 된다.
- **에러 처리**: subtodo 처리 중 실패하면 사용자에게 알리고 해당 subtodo를 건너뛰지 않고 멈춘다.
- **상태 일관성**: 부모 할일을 완료로 바꾸기 전 모든 subtodo가 완료 상태인지 확인한다.
`

/**
 * 순서 = UI 표시 순서 (system 섹션 내). 첫 번째가 가장 일반적/입문용.
 * mcpTools / triggers 는 SKILL.md frontmatter 에 포함된 메타이지만,
 * UI 의 별도 입력 필드가 아닌 본문 일부이므로 기본값은 빈 배열.
 * (사용자가 system skill 에 추가 메타를 붙이고 싶으면 update 로 채우면 된다.)
 */
export const SYSTEM_SKILL_SEEDS: readonly SystemSkillSeed[] = [
  { name: 'rally', content: RALLY_CONTENT, mcpTools: [], triggers: [] },
  { name: 'rally-plan', content: RALLY_PLAN_CONTENT, mcpTools: [], triggers: [] },
  { name: 'rally-do', content: RALLY_DO_CONTENT, mcpTools: [], triggers: [] }
] as const

export const SYSTEM_SKILL_NAMES = SYSTEM_SKILL_SEEDS.map((s) => s.name) as readonly string[]

export function getSystemSkillSeed(name: string): SystemSkillSeed | undefined {
  return SYSTEM_SKILL_SEEDS.find((s) => s.name === name)
}
