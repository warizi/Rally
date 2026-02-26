import { ScrollArea } from './scroll-area'

interface TabContainerProps {
  header: React.ReactNode
  children: React.ReactNode
}

export function TabContainer({ header, children }: TabContainerProps): React.ReactElement {
  return (
    <div className="flex-1 h-full pt-6 px-6 pb-2 @container flex flex-col max-w-300 mx-auto">
      <div className="w-full shrink-0">{header}</div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="h-full">{children}</div>
      </ScrollArea>
    </div>
  )
}
