/**
 * main process 내 최근 쓰기 트래커.
 *
 * MCP 라우트가 디스크에 쓴 직후 broadcastChanged 로 변경을 알린 후,
 * parcelWatcher 가 같은 파일 변경을 비동기로 감지하여 또 다시 broadcast 하는
 * 이중 알림을 막기 위해 사용한다.
 *
 * 흐름:
 * 1. broadcastChanged(channel, wsId, paths, actor) 호출 시 각 path 를 트래커에 등록
 * 2. parcelWatcher 가 50ms debounce 후 pushChanged 호출 직전 트래커 확인
 * 3. 트래커에 있는 path 는 skip (이미 broadcast 됨)
 *
 * TTL 은 parcelWatcher debounce(50ms) + fs 이벤트 도착 지연을 충분히 커버하도록
 * 보수적으로 3000ms 로 설정. 너무 길면 정말 외부 편집된 변경도 못 잡으니 주의.
 */

const TTL_MS = 3000

/**
 * Key 형식: `${workspaceId}::${relativePath}`
 * Value: setTimeout handle (TTL 후 자동 삭제)
 */
const recentWrites = new Map<string, ReturnType<typeof setTimeout>>()

function makeKey(workspaceId: string, relativePath: string): string {
  return `${workspaceId}::${relativePath}`
}

export function markRecentWrite(workspaceId: string, relativePath: string): void {
  const key = makeKey(workspaceId, relativePath)
  const prev = recentWrites.get(key)
  if (prev) clearTimeout(prev)
  const timer = setTimeout(() => recentWrites.delete(key), TTL_MS)
  recentWrites.set(key, timer)
}

export function isRecentWrite(workspaceId: string, relativePath: string): boolean {
  return recentWrites.has(makeKey(workspaceId, relativePath))
}

/** 테스트 전용 — 모든 트래커 상태 초기화 */
export function clearRecentWrites(): void {
  for (const timer of recentWrites.values()) clearTimeout(timer)
  recentWrites.clear()
}
