# Rally 할일 관리

Rally 워크스페이스의 할일(todo)을 확인하고, 지시에 따라 관리합니다.

## 입력

$ARGUMENTS

## 참조 Skills

할일 생성/관리 시 `.claude/skills/todo-management.md`의 원칙을 따른다.

## 실행 규칙

### 1단계: 현재 할일 파악

1. `mcp__rally__list_todos`로 현재 할일 목록을 조회한다 (기본 filter: active)
2. 조회 결과를 파악하고 사용자에게 현황을 요약한다:
   - 미완료/진행중/보류 건수
   - 우선순위별 분포
   - 마감일이 임박한 항목 (dueDate 기준)

### 2단계: linkedItems 활용

각 할일에 linkedItems가 있으면 맥락 파악에 활용한다:

- `note`, `csv` 타입 → `mcp__rally__read_content`로 상세 내용 확인
- `canvas` 타입 → `mcp__rally__read_canvas`로 시각 자료 확인
- `schedule`, `pdf`, `image` 타입 → 연결 관계만 인지 (상세 조회 도구 없음)

linkedItems를 통해 할일의 배경과 관련 자료를 파악한 뒤 작업에 반영한다.

### 3단계: 지시 실행

입력에 따라 적절한 작업을 수행한다:

#### 입력이 없거나 "확인", "현황"인 경우

- 1단계 현황 요약만 출력한다

#### 입력이 구체적 지시인 경우

- `mcp__rally__manage_todos`로 할일을 생성/수정/삭제한다
- 가능한 작업:
  - **생성**: title 필수, description/status/priority/parentId/dueDate/startDate 선택
  - **수정**: id 필수, 변경할 필드만 전달. status 변경 시 isDone 자동 동기화
  - **삭제**: id 필수
  - **하위 할일**: parentId로 상위 할일 지정
  - **항목 연결**: linkItems로 관련 항목(note/csv/canvas/pdf/image/schedule) 연결
  - **항목 연결 해제**: unlinkItems로 기존 연결 해제 (update 시)
- 여러 작업은 actions 배열로 한 번에 배치 처리한다
- 각 생성할 todo에 참고 사항이 있으면 노트를 생성하여 연결한다

#### 입력이 코드 작업 관련인 경우

1. linkedItems로 관련 노트/캔버스를 확인하여 요구사항 파악
2. 코드 작업 수행
3. 작업 완료 후 해당 할일의 status를 "완료"로 업데이트

### 상태값 참고

| 필드     | 값                                           |
| -------- | -------------------------------------------- |
| status   | 할일, 진행중, 완료, 보류                     |
| priority | high, medium, low                            |
| 날짜     | ISO 8601 형식 (예: 2026-03-07T00:00:00.000Z) |

## 출력 형식

작업 완료 후 변경 사항을 요약:

- 수행한 작업 (생성/수정/삭제)
- 변경된 할일 목록 (제목 + 상태)
- 남은 활성 할일 수
