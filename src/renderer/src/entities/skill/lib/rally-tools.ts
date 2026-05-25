/**
 * Rally MCP 서버가 노출하는 tool 카탈로그.
 *
 * - `value` 는 SKILL.md / DB 에 저장되는 실제 식별자 (Claude 에게 제공되는 이름).
 * - `label` 은 사용자 UI 에서 보여주는 한국어 라벨.
 * - `description` 은 select dropdown 의 보조 설명.
 *
 * 이름은 `mcp__rally__` 접두사를 떼고 함수명만 기록 — SKILL.md 본문 표기 규약과 일치.
 * 새 tool 추가 시 이 배열만 갱신하면 됨.
 */
export interface RallyToolDef {
  value: string
  label: string
  description: string
}

export const RALLY_TOOLS: RallyToolDef[] = [
  // --- 읽기 ---
  { value: 'read', label: '아이템 읽기', description: '노트/CSV/PDF/이미지/캔버스 본문' },
  { value: 'read_tasks', label: '할일 읽기', description: '할일/일정/반복/리마인더 조회' },
  { value: 'read_workspace', label: '워크스페이스 읽기', description: '워크스페이스 메타 정보' },
  { value: 'read_templates', label: '템플릿 읽기', description: '저장된 노트/CSV 템플릿' },
  { value: 'read_trash', label: '휴지통 읽기', description: '삭제 대기 중인 아이템 목록' },
  {
    value: 'read_note_image',
    label: '노트 이미지 읽기',
    description: '노트 내 첨부 이미지 바이트'
  },
  { value: 'search', label: '검색', description: '노트/할일/캔버스/CSV 통합 검색' },
  {
    value: 'browse',
    label: '워크스페이스 탐색',
    description: '폴더/노트/태그/링크 등 목록 조회'
  },
  // --- 쓰기/관리 ---
  {
    value: 'manage_content',
    label: '노트/CSV 생성·수정',
    description: '노트와 CSV 본문 create/update'
  },
  {
    value: 'manage_tasks',
    label: '할일·일정·반복 관리',
    description: 'todo / schedule / recurring / reminder 통합 CRUD'
  },
  {
    value: 'manage_canvas',
    label: '캔버스 관리',
    description: '캔버스 노드·엣지 생성·이동·삭제'
  },
  {
    value: 'manage_items',
    label: '폴더/파일 관리',
    description: '이동·이름변경·폴더 생성'
  },
  { value: 'manage_links', label: '아이템 링크 관리', description: '아이템 간 양방향 연결' },
  { value: 'manage_tags', label: '태그 관리', description: '태그 생성·부착·해제·삭제' },
  { value: 'manage_templates', label: '템플릿 관리', description: '노트/CSV 템플릿 저장·삭제' },
  { value: 'manage_trash', label: '휴지통 관리', description: '복구·영구삭제·비우기' }
]

const TOOL_BY_VALUE = new Map(RALLY_TOOLS.map((t) => [t.value, t]))

export function getToolLabel(value: string): string {
  return TOOL_BY_VALUE.get(value)?.label ?? value
}

export function isKnownTool(value: string): boolean {
  return TOOL_BY_VALUE.has(value)
}
