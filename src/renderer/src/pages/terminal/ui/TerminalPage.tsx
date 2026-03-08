import { JSX, useRef } from 'react'
import { TabContainer } from '@shared/ui/tab-container'
import { useTerminal } from '@features/terminal'

export function TerminalPage(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  useTerminal(containerRef)

  return (
    <TabContainer scrollable={false} maxWidth="full" header={null}>
      <div ref={containerRef} className="h-full w-full" />
    </TabContainer>
  )
}
