import * as React from 'react'
import { ScrollArea as ScrollAreaPrimitive } from 'radix-ui'

import { cn } from '@/shared/lib/utils'

type ScrollAreaProps = React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  /** 가상화 라이브러리 (예: @tanstack/react-virtual) 의 getScrollElement 용. */
  viewportRef?: React.Ref<HTMLDivElement>
  /** Viewport 에 적용할 className (스크롤 컨테이너 클래스). */
  viewportClassName?: string
}

function ScrollArea({
  className,
  children,
  viewportRef,
  viewportClassName,
  ...props
}: ScrollAreaProps) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn('relative', className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        data-slot="scroll-area-viewport"
        className={cn(
          'focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1 min-h-0 h-full',
          viewportClassName
        )}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

const scrollbarSizes = {
  sm: { vertical: 'w-2', horizontal: 'h-2' },
  md: { vertical: 'w-2.5', horizontal: 'h-2.5' },
  lg: { vertical: 'w-3', horizontal: 'h-3' }
}

function ScrollBar({
  className,
  orientation = 'vertical',
  size = 'sm',
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar> & {
  size?: 'sm' | 'md' | 'lg'
}) {
  const s = scrollbarSizes[size]
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        'flex touch-none p-px transition-colors select-none',
        orientation === 'vertical' && `h-full ${s.vertical} border-l border-l-transparent`,
        orientation === 'horizontal' && `${s.horizontal} flex-col border-t border-t-transparent`,
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="bg-border relative flex-1 rounded-full "
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
}

export { ScrollArea, ScrollBar }
