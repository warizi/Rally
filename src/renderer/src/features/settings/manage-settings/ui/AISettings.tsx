import { useEffect, useState } from 'react'
import { CopyIcon, CheckIcon, FileTextIcon } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { ScrollArea } from '@/shared/ui/scroll-area'

interface CommandFile {
  name: string
  content: string
}

export function AISettings(): React.JSX.Element {
  const [mcpServerPath, setMcpServerPath] = useState('')
  const [commandFiles, setCommandFiles] = useState<CommandFile[]>([])
  const [copied, setCopied] = useState<string | null>(null)
  const [expandedCommand, setExpandedCommand] = useState<string | null>(null)

  useEffect(() => {
    window.api.appInfo.getMcpServerPath().then((res) => {
      if (res.success && res.data) {
        setMcpServerPath(res.data)
      }
    })
    window.api.appInfo.getCommandFiles().then((res) => {
      if (res.success && res.data) {
        setCommandFiles(res.data)
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

  const handleCopy = async (text: string, key: string): Promise<void> => {
    await navigator.clipboard.writeText(text)
    setCopied(key)
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

      {commandFiles.length > 0 && (
        <div className="space-y-2 border-t pt-4">
          <h3 className="text-sm font-medium mb-1">Claude 커맨드</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Claude Code에서 <code className="bg-muted px-1 rounded">/rally-*</code> 형태로 사용할
            수 있는 커맨드입니다. 내용을 복사하여 다른 프로젝트에서도 활용할 수 있습니다.
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
                  <span className="font-medium flex-1">{file.name}</span>
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
                  <ScrollArea className="max-h-48">
                    <pre className="text-xs bg-muted px-3 py-2 border-t whitespace-pre-wrap">
                      {file.content}
                    </pre>
                  </ScrollArea>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
