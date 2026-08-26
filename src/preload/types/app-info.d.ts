import type { IpcResponse } from './common'

export interface CommandFile {
  name: string
  description: string
  content: string
}

export interface AppInfoAPI {
  getVersion: () => Promise<IpcResponse<string>>
  getMcpServerPath: () => Promise<IpcResponse<string>>
  getCommandFiles: () => Promise<IpcResponse<CommandFile[]>>
  getSkillFiles: () => Promise<IpcResponse<CommandFile[]>>
  /** M-5: 오류 화면에서 로그 파일 위치 열기. 반환값은 연 로그 파일 경로. */
  openLogFolder: () => Promise<IpcResponse<string>>
}

export type McpClientId = 'claudeDesktop' | 'claudeCode' | 'codex'

export interface McpClientStatus {
  configPath: string
  supported: boolean
  configExists: boolean
  registered: boolean
  outdated: boolean
}

export interface McpClientStatusMap {
  claudeDesktop: McpClientStatus
  claudeCode: McpClientStatus
  codex: McpClientStatus
}

export interface McpClientStatusBundle {
  status: McpClientStatusMap
  /** dev: 'rally-dev' / prod: 'rally' */
  serverKey: string
  serverConfig: Record<string, unknown>
}

/** 토큰 재발급 결과 — 갱신 성공/실패를 그대로 보고한다. */
export interface McpRotateResult {
  status: McpClientStatusMap
  /** 새 토큰으로 설정을 다시 쓴 클라이언트 */
  reRegistered: McpClientId[]
  /** 갱신 실패 — 구 토큰이 남아 있어 사용자가 수동 조치해야 한다 */
  failed: { client: McpClientId; error: string }[]
}

export interface McpClientAPI {
  getStatus: () => Promise<IpcResponse<McpClientStatusBundle>>
  register: (client: McpClientId) => Promise<IpcResponse<McpClientStatus>>
  unregister: (client: McpClientId) => Promise<IpcResponse<McpClientStatus>>
  /** 보안-H2: 토큰 재발급 + 등록 클라이언트 설정 자동 갱신 */
  rotateToken: () => Promise<IpcResponse<McpRotateResult>>
}
