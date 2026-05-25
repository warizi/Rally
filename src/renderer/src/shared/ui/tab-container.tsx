import { ScrollArea } from './scroll-area'

interface TabContainerProps {
  header: React.ReactNode
  children: React.ReactNode
  scrollable?: boolean
  maxWidth?: number | 'full'
}

export function TabContainer({
  header,
  children,
  scrollable = true,
  maxWidth = 1200
}: TabContainerProps): React.ReactElement {
  return (
    <div
      className="flex-1 h-full @container flex flex-col mx-auto"
      style={{ maxWidth: maxWidth === 'full' ? undefined : maxWidth }}
    >
      <div className="w-full shrink-0 pt-6 px-6">{header}</div>
      {scrollable ? (
        // Radix ScrollArea Viewport 의 즉시 자식 div 는 라이브러리가 주입하는
        // `display: table; min-width: 100%` wrapper 다 (가로 스크롤 지원용).
        // 탭 콘텐츠는 가로 스크롤 대신 truncate / min-w-0 가 동작해야 하므로
        // 그 wrapper 를 block + w-full 로 강제. !important 로 inline style 우선.
        <ScrollArea
          className="flex-1 min-h-0 px-6 pb-2"
          viewportClassName="[&>div]:!block [&>div]:!w-full [&>div]:!min-w-0"
        >
          {children}
        </ScrollArea>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden px-6 pb-2">{children}</div>
      )}
    </div>
  )
}
