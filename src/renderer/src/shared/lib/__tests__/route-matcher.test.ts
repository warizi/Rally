import { describe, it, expect } from 'vitest'
import { matchRoute, findMatchingRoute } from '../route-matcher'

describe('matchRoute', () => {
  it('정적 경로 일치', () => {
    expect(matchRoute('/dashboard', '/dashboard')).toEqual({ matched: true, params: {} })
  })

  it('정적 경로 불일치', () => {
    expect(matchRoute('/dashboard', '/settings')).toEqual({ matched: false, params: {} })
  })

  it('파트 개수가 다르면 매칭 실패', () => {
    expect(matchRoute('/a/b', '/a').matched).toBe(false)
    expect(matchRoute('/a', '/a/b').matched).toBe(false)
  })

  it('동적 파라미터 추출', () => {
    expect(matchRoute('/project/:projectId/todo', '/project/123/todo')).toEqual({
      matched: true,
      params: { projectId: '123' }
    })
  })

  it('여러 동적 파라미터', () => {
    const result = matchRoute('/note/:noteId/comment/:commentId', '/note/n-1/comment/c-1')
    expect(result.matched).toBe(true)
    expect(result.params).toEqual({ noteId: 'n-1', commentId: 'c-1' })
  })

  it('정적 + 동적 혼합 — 정적 불일치 시 fail', () => {
    expect(matchRoute('/project/:id/edit', '/project/123/view').matched).toBe(false)
  })

  it('루트 경로 ("/" → 빈 배열)', () => {
    expect(matchRoute('/', '/').matched).toBe(true)
  })

  it('trailing slash 무관 (filter(Boolean) 적용)', () => {
    expect(matchRoute('/a/b', '/a/b/').matched).toBe(true)
    expect(matchRoute('/a/b/', '/a/b').matched).toBe(true)
  })
})

describe('findMatchingRoute', () => {
  const routes = [
    { pattern: '/dashboard', name: 'dashboard' },
    { pattern: '/project/:projectId', name: 'project' },
    { pattern: '/project/:projectId/todo', name: 'project-todo' }
  ]

  it('첫 번째 매칭 route 반환', () => {
    const result = findMatchingRoute(routes, '/project/123/todo')
    expect(result?.route.name).toBe('project-todo')
    expect(result?.params.projectId).toBe('123')
  })

  it('매칭 안 되면 null', () => {
    expect(findMatchingRoute(routes, '/settings')).toBeNull()
  })

  it('순서대로 검사 — 더 구체적 매칭이 뒤에 있어도 첫 매칭 선택', () => {
    const orderedRoutes = [
      { pattern: '/project/:id', name: 'general' },
      { pattern: '/project/123', name: 'specific' }
    ]
    // ':id' 가 먼저라 '123' 도 ':id' 로 매칭
    const result = findMatchingRoute(orderedRoutes, '/project/123')
    expect(result?.route.name).toBe('general')
  })
})
