import { useEffect, useState } from 'react'
import { CopyIcon, CheckIcon } from 'lucide-react'
import { Button } from '@/shared/ui/button'

export function AISettings(): React.JSX.Element {
  const [mcpServerPath, setMcpServerPath] = useState('')
  const [copied, setCopied] = useState<'path' | 'config' | null>(null)

  useEffect(() => {
    window.api.appInfo.getMcpServerPath().then((res) => {
      if (res.success && res.data) {
        setMcpServerPath(res.data)
      }
    })
  }, [])

  const mcpConfig = JSON.stringify(
    {
      mcpServers: {
        rally: {
          command: 'node',
          args: [mcpServerPath]
        }
      }
    },
    null,
    2
  )

  const handleCopy = async (text: string, type: 'path' | 'config'): Promise<void> => {
    await navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium mb-1">MCP 서버 연결</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Claude Desktop 등 MCP 클라이언트에서 Rally에 연결할 수 있습니다.
        </p>
      </div>

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
          아래 JSON을 MCP 클라이언트 설정 파일에 붙여넣으세요.
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
  )
}
