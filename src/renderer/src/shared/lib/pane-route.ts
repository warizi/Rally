import { type ComponentType } from 'react'

// 라우트 파라미터 타입
export interface RouteParams {
  [key: string]: string
}

// 페이지 컴포넌트 Props (optional for compatibility with react-router)
export interface PageProps {
  tabId?: string
  params?: RouteParams
  search?: Record<string, string>
}

// 라우트 설정
export interface PaneRoute {
  pattern: string
  component: ComponentType<PageProps>
}
