import { useEffect, useState } from 'react'
import {
  CopyIcon,
  CheckIcon,
  FileTextIcon,
  ChevronDownIcon,
  CircleCheckIcon,
  CircleAlertIcon,
  CircleIcon
} from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { useOnboardingStore } from '@shared/store/onboarding'
import { OnboardingTipIcon } from '@shared/ui/onboarding-tip'

interface CommandFile {
  name: string
  description: string
  content: string
}

type McpClientId = 'claudeDesktop' | 'claudeCode'

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
}

const CLIENT_LABELS: Record<McpClientId, { name: string; hint: string }> = {
  claudeDesktop: {
    name: 'Claude Desktop',
    hint: '데스크탑 앱에서 Rally를 사용합니다'
  },
  claudeCode: {
    name: 'Claude Code (글로벌)',
    hint: '터미널 어디서든 Rally를 사용합니다 (~/.claude.json)'
  }
}

export function AISettings(): React.JSX.Element {
  const [mcpServerPath, setMcpServerPath] = useState('')
  const [commandFiles, setCommandFiles] = useState<CommandFile[]>([])
  const [skillFiles, setSkillFiles] = useState<CommandFile[]>([])
  const [copied, setCopied] = useState<string | null>(null)
  const [expandedCommand, setExpandedCommand] = useState<string | null>(null)
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null)
  const [clientStatus, setClientStatus] = useState<McpClientStatusMap | null>(null)
  const [serverKey, setServerKey] = useState<string>('rally')
  const [serverConfig, setServerConfig] = useState<Record<string, unknown> | null>(null)
  const [showManual, setShowManual] = useState(false)
  const [busy, setBusy] = useState<McpClientId | null>(null)

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
    window.api.appInfo.getCommandFiles().then((res) => {
      if (res.success && res.data) setCommandFiles(res.data)
    })
    window.api.appInfo.getSkillFiles().then((res) => {
      if (res.success && res.data) setSkillFiles(res.data)
    })
    refreshStatus()
  }, [])

  const mcpConfig = JSON.stringify(
    {
      mcpServers: {
        [serverKey]: serverConfig ?? {
          command: 'node',
          args: [mcpServerPath]
        }
      }
    },
    null,
    2
  )

  const handleCopy = async (text: string, key: string): Promise<void> => {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleRegister = async (client: McpClientId): Promise<void> => {
    setBusy(client)
    try {
      await window.api.mcpClient.register(client)
      await refreshStatus()
      useOnboardingStore.getState().markChecklistStep('connect_ai').catch(console.error)
    } finally {
      setBusy(null)
    }
  }

  const handleUnregister = async (client: McpClientId): Promise<void> => {
    setBusy(client)
    try {
      await window.api.mcpClient.unregister(client)
      await refreshStatus()
    } finally {
      setBusy(null)
    }
  }

  const renderClientCard = (client: McpClientId): React.JSX.Element => {
    const status = clientStatus?.[client]
    const labels = CLIENT_LABELS[client]
    const isBusy = busy === client

    if (status && !status.supported) {
      return (
        <div className="border rounded-md p-3 opacity-60">
          <div className="flex items-center gap-2 mb-1">
            <CircleIcon className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">{labels.name}</span>
          </div>
          <p className="text-xs text-muted-foreground">이 OS에서는 지원되지 않습니다</p>
        </div>
      )
    }

    return (
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
              <span className="text-sm font-medium">{labels.name}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-1">{labels.hint}</p>
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
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isBusy}
                    onClick={() => handleRegister(client)}
                  >
                    {isBusy ? '...' : '갱신'}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isBusy}
                  onClick={() => handleUnregister(client)}
                >
                  {isBusy ? '...' : '제거'}
                </Button>
              </>
            ) : (
              <Button size="sm" disabled={isBusy} onClick={() => handleRegister(client)}>
                {isBusy ? '...' : '자동 등록'}
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
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-medium">MCP 서버 연결</h3>
          {serverKey === 'rally-dev' && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 border border-amber-500/30">
              dev
            </span>
          )}
          <OnboardingTipIcon
            tipId="ai_register"
            title="Claude 1-click 등록"
            description="Claude Desktop / Claude Code 둘 다 한 번에 등록할 수 있어요. 등록 후 Claude에서 노트·할 일·캔버스를 자유롭게 다룰 수 있어요."
            side="right"
            align="start"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Rally의 노트·할 일·일정 등을 Claude에서 자유롭게 다룰 수 있도록 MCP 서버를 등록합니다.
          처음이라면 아래의 클라이언트에서 <strong>자동 등록</strong>을 누르세요.
          {serverKey === 'rally-dev' && (
            <span className="block mt-1 text-amber-600">
              현재 dev 빌드 — config 키는 <code className="bg-muted px-1 rounded">rally-dev</code>로
              prod와 분리되어 등록됩니다.
            </span>
          )}
        </p>
      </div>

      <div className="space-y-2">
        {renderClientCard('claudeDesktop')}
        {renderClientCard('claudeCode')}
        <p className="text-xs text-muted-foreground">
          💡 워크스페이스 폴더는 별도로 자동 인식됩니다 — 워크스페이스에서{' '}
          <code className="bg-muted px-1 rounded">claude</code>를 실행하면 추가 설정 없이 동작합니다
          (project-scope <code className="bg-muted px-1 rounded">.mcp.json</code> 자동 생성).
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
          수동 설정 / 다른 클라이언트 (Cursor, Continue 등)
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
              <label className="text-sm font-medium">MCP 설정 JSON</label>
              <p className="text-xs text-muted-foreground">
                아래 JSON을 클라이언트의 MCP 설정 파일에 붙여넣으세요. 기존 mcpServers가 있으면 안에
                rally 항목만 추가하면 됩니다.
              </p>
              <div className="relative">
                <pre className="text-xs bg-muted px-3 py-3 rounded-md overflow-x-auto select-all">
                  {mcpConfig}
                </pre>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute top-2 right-2 size-7"
                  onClick={() => handleCopy(mcpConfig, 'config')}
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

      {commandFiles.length > 0 && (
        <div className="space-y-2 border-t pt-4">
          <h3 className="text-sm font-medium mb-1">Claude 커맨드</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Claude Code에서 <code className="bg-muted px-1 rounded">/rally-*</code> 형태로 사용할 수
            있는 커맨드입니다. 내용을 복사하여 다른 프로젝트에서도 활용할 수 있습니다.
          </p>
          <div className="space-y-2">
            {commandFiles.map((file) => (
              <div key={file.name} className="border rounded-md overflow-hidden">
                <div
                  className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() =>
                    setExpandedCommand(expandedCommand === file.name ? null : file.name)
                  }
                >
                  <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{file.name}</span>
                    {file.description && (
                      <p className="text-xs text-muted-foreground truncate">{file.description}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCopy(file.content, `cmd-${file.name}`)
                    }}
                  >
                    {copied === `cmd-${file.name}` ? (
                      <CheckIcon className="size-3" />
                    ) : (
                      <CopyIcon className="size-3" />
                    )}
                  </Button>
                </div>
                {expandedCommand === file.name && (
                  <div className="max-h-48 overflow-y-auto">
                    <pre className="text-xs bg-muted px-3 py-2 border-t whitespace-pre-wrap">
                      {file.content}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {skillFiles.length > 0 && (
        <div className="space-y-2 border-t pt-4">
          <h3 className="text-sm font-medium mb-1">Claude Skills</h3>
          <p className="text-xs text-muted-foreground mb-3">
            커맨드가 참조하는 방법론 문서입니다. 노트 작성, 캔버스 디자인, 할일 관리 등의 베스트
            프랙티스를 정의합니다.
          </p>
          <div className="space-y-2">
            {skillFiles.map((file) => (
              <div key={file.name} className="border rounded-md overflow-hidden">
                <div
                  className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => setExpandedSkill(expandedSkill === file.name ? null : file.name)}
                >
                  <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{file.name}</span>
                    {file.description && (
                      <p className="text-xs text-muted-foreground truncate">{file.description}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCopy(file.content, `skill-${file.name}`)
                    }}
                  >
                    {copied === `skill-${file.name}` ? (
                      <CheckIcon className="size-3" />
                    ) : (
                      <CopyIcon className="size-3" />
                    )}
                  </Button>
                </div>
                {expandedSkill === file.name && (
                  <div className="max-h-48 overflow-y-auto">
                    <pre className="text-xs bg-muted px-3 py-2 border-t whitespace-pre-wrap">
                      {file.content}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
