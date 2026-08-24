/**
 * 보안-H2: 설정 화면에 표시되는 MCP 서버 설정에서 인증 토큰을 가린다.
 *
 * `MCP_AUTH_TOKEN` 은 워크스페이스 전체 읽기/쓰기가 가능한 마스터 키다. 설정 화면은
 * 사용자가 스크린샷을 찍어 이슈·블로그·문의에 올리기 쉬운 지점이라, 기본은 마스킹하고
 * 사용자가 명시적으로 '표시'를 눌렀을 때만 원본을 보여준다.
 *
 * 복사 버튼은 항상 원본을 복사한다 — 마스킹된 값을 붙여넣으면 동작하지 않기 때문이다.
 */

/** 화면에 노출해도 무해한 자리표시자. 길이는 원본과 무관하게 고정한다. */
export const MASKED_TOKEN = '••••••••••••••••'

/** 마스킹 대상 env 키 — 앞으로 비밀값이 늘면 여기에 추가한다. */
const SECRET_ENV_KEYS = ['MCP_AUTH_TOKEN']

/**
 * serverConfig 의 `env` 안에 있는 비밀 키 값을 자리표시자로 바꾼 사본을 반환한다.
 * 원본 객체는 변형하지 않는다.
 *
 * @param serverConfig main 이 준 `{ command, args, env }` 형태. null 이면 그대로 null.
 * @param reveal true 면 마스킹하지 않고 원본을 그대로 돌려준다.
 */
export function maskServerConfig(
  serverConfig: Record<string, unknown> | null,
  reveal: boolean
): Record<string, unknown> | null {
  if (!serverConfig || reveal) return serverConfig

  const env = serverConfig.env
  if (!env || typeof env !== 'object') return serverConfig

  const maskedEnv: Record<string, unknown> = { ...(env as Record<string, unknown>) }
  let touched = false
  for (const key of SECRET_ENV_KEYS) {
    if (typeof maskedEnv[key] === 'string' && maskedEnv[key] !== '') {
      maskedEnv[key] = MASKED_TOKEN
      touched = true
    }
  }
  if (!touched) return serverConfig

  return { ...serverConfig, env: maskedEnv }
}

/** serverConfig 에 가릴 비밀값이 실제로 들어 있는지 — '표시' 토글 노출 여부 판단용. */
export function hasSecret(serverConfig: Record<string, unknown> | null): boolean {
  const env = serverConfig?.env
  if (!env || typeof env !== 'object') return false
  return SECRET_ENV_KEYS.some((k) => {
    const v = (env as Record<string, unknown>)[k]
    return typeof v === 'string' && v !== ''
  })
}
