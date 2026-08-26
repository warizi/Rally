/**
 * ErrorBoundary 용 오류 화면 (보안 감사 M-5).
 *
 * 두 가지 범위를 제공한다.
 * - `AppErrorFallback`  : 앱 루트. 여기까지 왔다면 화면 전체가 날아간 상황이다.
 * - `TabErrorFallback`  : 탭 하나. **나머지 탭은 살아 있다**는 사실을 알리는 게 핵심이다.
 *
 * 원칙:
 * - 사용자에게 사과하지 않는다. 무엇이 일어났고 무엇을 할 수 있는지만 말한다.
 * - 오류 메시지를 숨기지 않는다. 1인 개발 제품이라 사용자가 그대로 전달해 주는 게
 *   가장 빠른 진단 경로다.
 * - 크래시 리포팅이 없으므로(M-7) 로그 파일로 가는 길을 반드시 열어 둔다.
 */
import { useState } from 'react'
import { AlertTriangleIcon, RotateCwIcon, FileTextIcon } from 'lucide-react'
import { Button } from './button'
import { toLogError } from '../lib/logger'

const onError = toLogError('error-fallback')

function LogButton({ size = 'sm' }: { size?: 'sm' | 'xs' }): React.JSX.Element {
  const [opened, setOpened] = useState(false)
  return (
    <Button
      variant="outline"
      size={size === 'xs' ? 'sm' : 'default'}
      onClick={() => {
        window.api.appInfo
          .openLogFolder()
          .then(() => setOpened(true))
          .catch(onError)
      }}
    >
      <FileTextIcon className="size-3.5 mr-1" />
      {opened ? '로그 위치를 열었습니다' : '로그 열기'}
    </Button>
  )
}

/** 오류 원문 — 접어 두되 숨기지는 않는다. */
function ErrorDetail({ error }: { error: Error }): React.JSX.Element {
  return (
    <details className="w-full max-w-xl">
      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
        오류 내용 보기
      </summary>
      <pre className="mt-2 text-[11px] text-left bg-muted rounded-md p-3 overflow-auto max-h-48 whitespace-pre-wrap break-all">
        {error.message}
        {error.stack ? `\n\n${error.stack}` : ''}
      </pre>
    </details>
  )
}

export function AppErrorFallback({
  error,
  reset
}: {
  error: Error
  reset: () => void
}): React.JSX.Element {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-background p-8">
      <AlertTriangleIcon className="size-8 text-amber-500" />
      <div className="text-center space-y-1">
        <h1 className="text-lg font-medium">문제가 발생했습니다</h1>
        <p className="text-sm text-muted-foreground">
          화면을 그리는 중 오류가 났습니다. 저장된 노트·할 일 데이터는 영향을 받지 않습니다.
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={reset}>
          <RotateCwIcon className="size-3.5 mr-1" />
          다시 시도
        </Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          앱 새로고침
        </Button>
        <LogButton />
      </div>
      <ErrorDetail error={error} />
    </div>
  )
}

export function TabErrorFallback({
  error,
  reset
}: {
  error: Error
  reset: () => void
}): React.JSX.Element {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 h-full">
      <AlertTriangleIcon className="size-6 text-amber-500" />
      <div className="text-center space-y-1">
        <p className="text-sm font-medium">이 탭을 열지 못했습니다</p>
        <p className="text-xs text-muted-foreground">
          다른 탭은 그대로 사용할 수 있습니다. 저장된 데이터는 영향을 받지 않습니다.
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={reset}>
          <RotateCwIcon className="size-3.5 mr-1" />
          다시 시도
        </Button>
        <LogButton size="xs" />
      </div>
      <ErrorDetail error={error} />
    </div>
  )
}
