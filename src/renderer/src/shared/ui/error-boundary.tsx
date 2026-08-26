/**
 * React 렌더 오류 경계 (보안 감사 M-5 · ISO 25010 신뢰성).
 *
 * React 18+ 는 렌더 중 미포착 예외가 나면 **전체 트리를 언마운트**한다. 경계가 없으면
 * 캔버스 노드 하나, 노트 임베드 하나, 잘못된 tabsJson 하나가 앱 전체를 백스크린으로
 * 만든다. 데이터는 안전하지만 가용성은 0이 되고, 사용자는 원인을 알 방법이 없다.
 *
 * 클래스 컴포넌트인 이유: `getDerivedStateFromError` / `componentDidCatch` 는 함수형
 * 컴포넌트에 대응물이 없다. React 가 제공하는 유일한 방법이다.
 *
 * ## 잡지 못하는 것
 * 이벤트 핸들러, 비동기 콜백(setTimeout/Promise), SSR, 그리고 경계 자신의 렌더에서
 * 발생한 오류는 잡히지 않는다. 그건 각 호출부에서 try/catch 하거나 React Query 의
 * error 상태로 다뤄야 한다.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { scoped } from '../lib/logger'

const log = scoped('error-boundary')

interface ErrorBoundaryProps {
  children: ReactNode
  /** 오류 발생 시 보여줄 UI. reset 을 호출하면 다시 렌더를 시도한다. */
  fallback: (error: Error, reset: () => void) => ReactNode
  /**
   * 이 값이 바뀌면 오류 상태를 자동 해제한다.
   * 탭 경계에서 tabId 를 넘기면, 같은 자리에 다른 탭이 오면서 자동 복구된다.
   */
  resetKey?: string
  /** 로그 스코프 구분용 라벨 (예: 'app' / 'tab:note') */
  label?: string
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidUpdate(prev: ErrorBoundaryProps): void {
    // resetKey 가 바뀌면 새 컨텐츠이므로 이전 오류를 끌고 가지 않는다.
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 크래시 리포팅이 없는 상태(M-7)라 로그가 유일한 사후 단서다.
    // componentStack 이 있어야 어느 컴포넌트에서 터졌는지 알 수 있다.
    const label = this.props.label ?? 'unknown'
    log.error(`[${label}] ${error.message}\n${error.stack ?? ''}\n${info.componentStack ?? ''}`)
  }

  private reset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    const { error } = this.state
    if (error) return this.props.fallback(error, this.reset)
    return this.props.children
  }
}
