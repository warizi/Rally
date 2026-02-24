import { useState, useEffect, useRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Skeleton } from './skeleton'
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
  titleError
}: TabHeaderProps) {
  const [localTitle, setLocalTitle] = useState(title ?? '')
  const [localDesc, setLocalDesc] = useState(description ?? '')
  const titleRef = useRef<HTMLInputElement>(null)

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

  if (editable) {
    return (
      <div className="w-full pb-2">
        <div className="flex items-center gap-3 mb-2">
          {Icon && (
            <Icon className="size-8" style={iconColor ? { color: iconColor } : undefined} />
          )}
          <div className="flex-1">
            <input
              ref={titleRef}
              type="text"
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              onBlur={() => {
                if (localTitle.trim() && localTitle !== title) {
                  onTitleChange?.(localTitle)
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
            {titleError && (
              <p className="text-xs text-destructive mt-1">{titleError}</p>
            )}
          </div>
        </div>
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
              (e.target as HTMLInputElement).blur()
            }
          }}
          className="text-sm text-muted-foreground bg-transparent border-b-2 border-transparent outline-none w-full focus:border-primary transition-colors"
          placeholder="설명을 입력해주세요"
        />
      </div>
    )
  }

  return (
    <div className="w-full pb-2">
      <div className="flex items-center gap-3 mb-2">
        {Icon && <Icon className="size-8" style={iconColor ? { color: iconColor } : undefined} />}
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

export default TabHeader
