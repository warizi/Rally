import { useState, useMemo } from 'react'
import { Check } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@shared/ui/popover'
import { Input } from '@shared/ui/input'
import { ScrollArea } from '@shared/ui/scroll-area'
import { useTodosByWorkspace } from '@entities/todo'
import { useLinkTodo } from '@entities/schedule'

interface Props {
  scheduleId: string
  workspaceId: string
  linkedTodoIds: string[]
  children: React.ReactNode
}

export function TodoLinkPopover({
  scheduleId,
  workspaceId,
  linkedTodoIds,
  children
}: Props): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const { data: todos = [] } = useTodosByWorkspace(workspaceId)
  const linkTodo = useLinkTodo()

  const filtered = useMemo(() => {
    if (!search.trim()) return todos
    const q = search.toLowerCase()
    return todos.filter((t) => t.title.toLowerCase().includes(q))
  }, [todos, search])

  function handleLink(todoId: string): void {
    if (linkedTodoIds.includes(todoId)) return
    linkTodo.mutate({ scheduleId, todoId })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <Input
          placeholder="할 일 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2 h-8 text-xs"
        />
        <ScrollArea className="max-h-48">
          {filtered.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">할 일이 없습니다</div>
          ) : (
            <div className="space-y-0.5">
              {filtered.map((todo) => {
                const isLinked = linkedTodoIds.includes(todo.id)
                return (
                  <button
                    key={todo.id}
                    type="button"
                    disabled={isLinked}
                    onClick={() => handleLink(todo.id)}
                    className={`
                      w-full flex items-center gap-2 text-xs rounded px-2 py-1.5 text-left
                      ${isLinked ? 'opacity-50 cursor-default' : 'hover:bg-accent cursor-pointer'}
                    `}
                  >
                    {isLinked && <Check className="size-3 text-primary shrink-0" />}
                    <span className="truncate">{todo.title}</span>
                  </button>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
