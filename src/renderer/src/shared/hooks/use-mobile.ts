import * as React from 'react'

const MOBILE_BREAKPOINT = 768

function readIsMobile(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
}

export function useIsMobile(): boolean {
  // 초기값은 lazy initializer 로 동기 계산 — effect 안에서 setState 를 부르지 않는다
  // (react-hooks/set-state-in-effect). effect 는 구독만 담당.
  const [isMobile, setIsMobile] = React.useState<boolean>(readIsMobile)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = (): void => {
      setIsMobile(readIsMobile())
    }
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isMobile
}
