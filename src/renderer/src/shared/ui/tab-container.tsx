import { ScrollArea } from './scroll-area'

interface TabContainerProps {
  header: React.ReactNode
  children: React.ReactNode
  scrollable?: boolean
}

export function TabContainer({
  header,
  children,
  scrollable = true
}: TabContainerProps): React.ReactElement {
  return (
    <div className="flex-1 h-full @container flex flex-col max-w-300 mx-auto">
      <div className="w-full shrink-0 pt-6 px-6">{header}</div>
      {scrollable ? (
        <ScrollArea className="flex-1 min-h-0 px-6 pb-2">
          <div className="h-full">{children}</div>
        </ScrollArea>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden px-6 pb-2">{children}</div>
      )}
    </div>
  )
}
