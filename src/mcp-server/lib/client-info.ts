interface ClientInfo {
  name?: string
  version?: string
}

let cachedClientInfo: ClientInfo | null = null

export function setClientInfo(info: ClientInfo): void {
  cachedClientInfo = info
}

export function getClientInfo(): ClientInfo | null {
  return cachedClientInfo
}
