import { useEffect, useState } from 'react'
import {
  CopyIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleCheckIcon,
  CircleAlertIcon,
  CircleIcon
} from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { useOnboardingStore } from '@shared/store/onboarding'
import { toLogError } from '@shared/lib/logger'

const onError = toLogError('onboarding')

interface McpClientStatus {
  configPath: string
  supported: boolean
  configExists: boolean
  registered: boolean
  outdated: boolean
}

interface McpClientStatusMap {
  claudeDesktop: McpClientStatus
  claudeCode: McpClientStatus
  codex: McpClientStatus
}

/** serverConfig({command,args,env}) 를 Codex config.toml 스니펫으로 직렬화 */
function buildCodexTomlSnippet(
  serverKey: string,
  serverConfig: Record<string, unknown> | null,
  fallbackPath: string
): string {
  const command = (serverConfig?.command as string) ?? fallbackPath
  const args = (serverConfig?.args as string[]) ?? [fallbackPath]
  const env = (serverConfig?.env as Record<string, string>) ?? {}
  const q = (s: string): string => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

  const lines = [
    `[mcp_servers.${serverKey}]`,
    `command = ${q(command)}`,
    `args = [${args.map(q).join(', ')}]`
  ]
  const envKeys = Object.keys(env)
  if (envKeys.length) {
    lines.push('', `[mcp_servers.${serverKey}.env]`)
    for (const k of envKeys) lines.push(`${k} = ${q(env[k])}`)
  }
  return lines.join('\n')
}

export function CodexSettings(): React.JSX.Element {
  const [mcpServerPath, setMcpServerPath] = useState('')
  const [clientStatus, setClientStatus] = useState<McpClientStatusMap | null>(null)
  const [serverKey, setServerKey] = useState<string>('rally')
  const [serverConfig, setServerConfig] = useState<Record<string, unknown> | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [showManual, setShowManual] = useState(false)
  const [busy, setBusy] = useState(false)

  const refreshStatus = async (): Promise<void> => {
    const res = await window.api.mcpClient.getStatus()
    if (res.success && res.data) {
      setClientStatus(res.data.status)
      setServerKey(res.data.serverKey)
      setServerConfig(res.data.serverConfig)
    }
  }

  useEffect(() => {
    window.api.appInfo.getMcpServerPath().then((res) => {
      if (res.success && res.data) setMcpServerPath(res.data)
    })
    refreshStatus()
  }, [])

  const status = clientStatus?.codex
  const tomlSnippet = buildCodexTomlSnippet(serverKey, serverConfig, mcpServerPath)

  const handleCopy = async (text: string, key: string): Promise<void> => {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleRegister = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.api.mcpClient.register('codex')
      await refreshStatus()
      useOnboardingStore.getState().markChecklistStep('connect_ai').catch(onError)
    } finally {
      setBusy(false)
    }
  }

  const handleUnregister = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.api.mcpClient.unregister('codex')
      await refreshStatus()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-medium">MCP 서버 연결 (Codex)</h3>
          {serverKey === 'rally-dev' && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 border border-amber-500/30">
              dev
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Rally의 노트·할 일·일정 등을 Codex에서 다룰 수 있도록 MCP 서버를 등록합니다. Codex CLI와
          Desktop(IDE 확장)은 <code className="bg-muted px-1 rounded">~/.codex/config.toml</code>을
          공유하므로 <strong>한 번 등록하면 둘 다</strong> 연결됩니다.
          {serverKey === 'rally-dev' && (
            <span className="block mt-1 text-amber-600">
              현재 dev 빌드 — config 키는 <code className="bg-muted px-1 rounded">rally-dev</code>로
              prod와 분리되어 등록됩니다.
            </span>
          )}
        </p>
      </div>

      <div className="space-y-2">
        <div className="border rounded-md p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {status?.registered && !status.outdated ? (
                  <CircleCheckIcon className="size-4 text-green-500" />
                ) : status?.outdated ? (
                  <CircleAlertIcon className="size-4 text-amber-500" />
                ) : (
                  <CircleIcon className="size-4 text-muted-foreground" />
                )}
                <span className="text-sm font-medium">Codex (CLI + Desktop)</span>
              </div>
              <p className="text-xs text-muted-foreground mb-1">
                CLI와 Desktop(IDE 확장)에 한 번에 연결됩니다 (~/.codex/config.toml)
              </p>
              {status?.registered ? (
                <p className="text-xs text-muted-foreground">
                  {status.outdated ? (
                    <span className="text-amber-600">
                      ⚠ 다른 경로로 등록되어 있습니다 — 다시 등록하면 최신 경로로 갱신됩니다
                    </span>
                  ) : (
                    '✓ 등록됨'
                  )}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">미등록</p>
              )}
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              {status?.registered ? (
                <>
                  {status.outdated && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={handleRegister}>
                      {busy ? '...' : '갱신'}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" disabled={busy} onClick={handleUnregister}>
                    {busy ? '...' : '제거'}
                  </Button>
                </>
              ) : (
                <Button size="sm" disabled={busy} onClick={handleRegister}>
                  {busy ? '...' : '자동 등록'}
                </Button>
              )}
            </div>
          </div>
          {status?.configPath && (
            <p className="text-[10px] text-muted-foreground/70 mt-2 font-mono break-all">
              {status.configPath}
            </p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          💡 등록 후 Codex를 재시작하면 적용됩니다. CLI에서는{' '}
          <code className="bg-muted px-1 rounded">codex mcp list</code>로 확인할 수 있습니다.
        </p>
      </div>

      <div className="border-t pt-4">
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowManual((v) => !v)}
        >
          <ChevronDownIcon
            className={`size-3 transition-transform ${showManual ? '' : '-rotate-90'}`}
          />
          수동 설정 (config.toml 직접 편집)
        </button>

        {showManual && (
          <div className="mt-3 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">MCP 서버 경로</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-md break-all select-all">
                  {mcpServerPath}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0 size-8"
                  onClick={() => handleCopy(mcpServerPath, 'path')}
                >
                  {copied === 'path' ? (
                    <CheckIcon className="size-3.5" />
                  ) : (
                    <CopyIcon className="size-3.5" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">config.toml 설정 (TOML)</label>
              <p className="text-xs text-muted-foreground">
                아래 내용을 <code className="bg-muted px-1 rounded">~/.codex/config.toml</code>에
                추가하세요. 기존 다른 설정은 그대로 두고 이 블록만 붙여넣으면 됩니다.
              </p>
              <div className="relative">
                <pre className="text-xs bg-muted px-3 py-3 rounded-md overflow-x-auto select-all">
                  {tomlSnippet}
                </pre>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute top-2 right-2 size-7"
                  onClick={() => handleCopy(tomlSnippet, 'config')}
                >
                  {copied === 'config' ? (
                    <CheckIcon className="size-3" />
                  ) : (
                    <CopyIcon className="size-3" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
