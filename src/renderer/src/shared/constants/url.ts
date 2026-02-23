// 정적 라우트
export const ROUTES = {
  DASHBOARD: '/dashboard',
  TODO: '/todo',
  NOTE_FOLDER: '/note-folder',
  SETTINGS: '/settings',
  // 노트 상세
  NOTE_DETAIL: '/note-folder/:noteId'
} as const

export type RoutePattern = (typeof ROUTES)[keyof typeof ROUTES]

// 하위 호환성
export const AppUrls = ROUTES
