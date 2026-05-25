import { JSX, useState } from 'react'
import { CheckIcon, ChevronsUpDownIcon, XIcon } from 'lucide-react'
import { Badge } from '@shared/ui/badge'
import { Button } from '@shared/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@shared/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@shared/ui/command'
import { ScrollArea } from '@shared/ui/scroll-area'
import { cn } from '@shared/lib/utils'
import { RALLY_TOOLS, getToolLabel } from '@entities/skill'

interface Props {
  value: string[]
  onChange: (next: string[]) => void
  readOnly?: boolean
  placeholder?: string
}

/**
 * Rally MCP tool 다중 선택. UI 에는 한국어 라벨 노출, 저장값은 tool 식별자 (string).
 * 카탈로그에 없는 값도 보존 (custom user-typed tools) — chip 으로 표시.
 */
export function ToolMultiSelect({
  value,
  onChange,
  readOnly = false,
  placeholder = 'Tool 선택…'
}: Props): JSX.Element {
  const [open, setOpen] = useState(false)

  const toggle = (tool: string): void => {
    if (value.includes(tool)) {
      onChange(value.filter((t) => t !== tool))
    } else {
      onChange([...value, tool])
    }
  }

  const remove = (tool: string): void => {
    onChange(value.filter((t) => t !== tool))
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={readOnly ? undefined : setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            disabled={readOnly}
            aria-expanded={open}
            className="w-full justify-between h-9 font-normal"
          >
            <span className="text-muted-foreground text-sm">
              {value.length === 0 ? placeholder : `${value.length}개 선택됨`}
            </span>
            <ChevronsUpDownIcon className="size-3.5 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-(--radix-popover-trigger-width) min-w-80"
          align="start"
          // dialog 의 ScrollArea 가 wheel 을 가로채지 않도록 popover 내부에서 이벤트 차단.
          onWheel={(e) => e.stopPropagation()}
          // PopoverContent 가 dialog 의 focus trap 으로 인해 pointer 이벤트가 막히는 케이스 방지.
          onPointerDownOutside={(e) => e.stopPropagation()}
        >
          <Command>
            <CommandInput placeholder="이름 또는 라벨로 검색…" className="h-9" />
            {/*
              CommandList 의 native overflow 를 끄고 ScrollArea 로 대체.
              max-h-none 으로 cmdk 기본 300px 제한 해제 → ScrollArea 가 height 결정.
              cmdk 의 scrollIntoView 는 표준 DOM API 라 ScrollArea viewport 내에서도 동작.
            */}
            <CommandList className="max-h-none overflow-visible">
              <ScrollArea className="h-[300px]">
                <CommandEmpty>찾는 tool 이 없습니다.</CommandEmpty>
                <CommandGroup>
                  {RALLY_TOOLS.map((tool) => {
                    const selected = value.includes(tool.value)
                    return (
                      <CommandItem
                        key={tool.value}
                        value={`${tool.label} ${tool.value} ${tool.description}`}
                        onSelect={() => toggle(tool.value)}
                        className="flex items-start gap-2"
                      >
                        <CheckIcon
                          className={cn(
                            'size-4 mt-0.5 shrink-0',
                            selected ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{tool.label}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {tool.value}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {tool.description}
                          </div>
                        </div>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </ScrollArea>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tool) => (
            <Badge key={tool} variant="secondary" className="gap-1 pr-1" title={tool}>
              <span>{getToolLabel(tool)}</span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => remove(tool)}
                  className="hover:bg-muted-foreground/20 rounded-full p-0.5 transition-colors"
                  aria-label={`${getToolLabel(tool)} 제거`}
                >
                  <XIcon className="size-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
