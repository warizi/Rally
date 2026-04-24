import { useState, useEffect, useRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Skeleton } from './skeleton'
import { Tooltip, TooltipTrigger, TooltipContent } from './tooltip'
import { useTabHeaderCollapsedSetting } from '@shared/hooks/use-tab-header-collapsed-setting'
import { cn } from '@shared/lib/utils'

type TabHeaderProps = {
  title?: string
  description?: string
  icon?: LucideIcon
  iconColor?: string
  isLoading?: boolean
  editable?: boolean
  onTitleChange?: (title: string) => void
  onDescriptionChange?: (desc: string) => void
  titleError?: string
  buttons?: React.JSX.Element
  footer?: React.ReactNode
}

function TabHeader({
  title,
  description,
  icon: Icon,
  iconColor,
  isLoading,
  editable,
  onTitleChange,
  onDescriptionChange,
  titleError,
  buttons,
  footer
}: TabHeaderProps) {
  const [localTitle, setLocalTitle] = useState(title ?? '')
  const [localDesc, setLocalDesc] = useState(description ?? '')
  const { collapsed: defaultCollapsed } = useTabHeaderCollapsedSetting()
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setCollapsed(defaultCollapsed)
  }, [defaultCollapsed])

  useEffect(() => {
    setLocalTitle(title ?? '')
  }, [title])

  useEffect(() => {
    setLocalDesc(description ?? '')
  }, [description])

  if (isLoading) {
    return (
      <div className="w-full pb-2">
        <div className="flex items-center gap-3 mb-2">
          {Icon && <Skeleton className="size-8 rounded-md" />}
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-4 w-72" />
      </div>
    )
  }

  const CollapseToggle = (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {collapsed ? '헤더 펼치기' : '헤더 접기'}
      </TooltipContent>
    </Tooltip>
  )

  if (editable) {
    return (
      <div className={cn('w-full', !collapsed && 'pb-2')}>
        <div className={cn('flex items-center', !collapsed && 'gap-3 mb-2')}>
          {CollapseToggle}
          {!collapsed && (
            <div className="flex items-center gap-3 flex-1">
              {Icon && (
                <Icon className="size-8" style={iconColor ? { color: iconColor } : undefined} />
              )}
              <input
                ref={titleRef}
                type="text"
                value={localTitle}
                onChange={(e) => setLocalTitle(e.target.value)}
                onBlur={() => {
                  if (localTitle.trim() && localTitle !== title) {
                    onTitleChange?.(localTitle)
                  } else if (!localTitle.trim()) {
                    setLocalTitle(title ?? '')
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    titleRef.current?.blur()
                  }
                }}
                className={cn(
                  'text-2xl font-bold bg-transparent border-b-2 border-transparent outline-none w-full',
                  'focus:border-primary transition-colors',
                  titleError && 'border-destructive focus:border-destructive'
                )}
                placeholder="제목을 입력해주세요"
              />
              {titleError && <p className="text-xs text-destructive mt-1">{titleError}</p>}
            </div>
          )}
          {collapsed && (
            <span className="ml-1 text-xs text-muted-foreground/60 truncate mr-4">{localTitle}</span>
          )}
          {buttons && <div className="ml-auto">{buttons}</div>}
        </div>
        {!collapsed && (
          <>
            <input
              type="text"
              value={localDesc}
              onChange={(e) => setLocalDesc(e.target.value)}
              onBlur={() => {
                if (localDesc !== description) {
                  onDescriptionChange?.(localDesc)
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  ;(e.target as HTMLInputElement).blur()
                }
              }}
              className="text-sm text-muted-foreground bg-transparent border-b-2 border-transparent outline-none w-full focus:border-primary transition-colors"
              placeholder="설명을 입력해주세요"
            />
            {footer && <div className="mt-2">{footer}</div>}
          </>
        )}
      </div>
    )
  }

  return (
    <div className={cn('w-full', !collapsed && 'pb-2')}>
      <div className={cn('flex items-center', !collapsed && 'gap-3 mb-2')}>
        {CollapseToggle}
        {!collapsed && (
          <div className="flex items-center gap-3">
            {Icon && (
              <Icon className="size-8" style={iconColor ? { color: iconColor } : undefined} />
            )}
            <h1 className="text-2xl font-bold">{title}</h1>
          </div>
        )}
        {collapsed && title && (
          <span className="ml-1 text-xs text-muted-foreground/60 truncate mr-4">{title}</span>
        )}
        {buttons && <div className="ml-auto">{buttons}</div>}
      </div>
      {!collapsed && (
        <>
          <p className="text-sm text-muted-foreground">{description}</p>
          {footer && <div className="mt-2">{footer}</div>}
        </>
      )}
    </div>
  )
}

export default TabHeader
