export interface RouteMatchResult {
  matched: boolean
  params: Record<string, string>
}

/**
 * 패턴과 pathname을 매칭하고 파라미터를 추출합니다.
 *
 * @example
 * matchRoute('/project/:projectId/todo', '/project/123/todo')
 * // { matched: true, params: { projectId: '123' } }
 *
 * matchRoute('/dashboard', '/dashboard')
 * // { matched: true, params: {} }
 *
 * matchRoute('/project/:projectId', '/settings')
 * // { matched: false, params: {} }
 */
export function matchRoute(pattern: string, pathname: string): RouteMatchResult {
  const patternParts = pattern.split('/').filter(Boolean)
  const pathParts = pathname.split('/').filter(Boolean)

  // 파트 개수가 다르면 매칭 실패
  if (patternParts.length !== pathParts.length) {
    return { matched: false, params: {} }
  }

  const params: Record<string, string> = {}

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i]
    const pathPart = pathParts[i]

    // 동적 파라미터 (:param)
    if (patternPart.startsWith(':')) {
      const paramName = patternPart.slice(1)
      params[paramName] = pathPart
      continue
    }

    // 정적 파트 - 정확히 일치해야 함
    if (patternPart !== pathPart) {
      return { matched: false, params: {} }
    }
  }

  return { matched: true, params }
}

/**
 * 여러 패턴 중 첫 번째 매칭되는 것을 찾습니다.
 */
export function findMatchingRoute<T extends { pattern: string }>(
  routes: T[],
  pathname: string
): { route: T; params: Record<string, string> } | null {
  for (const route of routes) {
    const result = matchRoute(route.pattern, pathname)
    if (result.matched) {
      return { route, params: result.params }
    }
  }
  return null
}
