import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useUpdateTodo } from '@entities/todo'
import type { TodoItem } from '@entities/todo'
import { TodoCheckbox } from '@features/todo/todo-field/ui/TodoCheckbox'
import { TodoStatusSelect } from '@features/todo/todo-field/ui/TodoStatusSelect'
import { TodoPrioritySelect } from '@features/todo/todo-field/ui/TodoPrioritySelect'
import { DatePickerButton } from '@shared/ui/date-picker-button'
import { TimePickerButton } from '@shared/ui/time-picker-button'
import { formatTime, applyTime } from '@shared/lib/datetime'
import { ReminderSelect } from '@entities/reminder'

const COLLAPSE_KEY = 'rally:todo-detail-metadata-collapsed'

interface Props {
  todo: TodoItem
  workspaceId: string
}

function Label({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex flex-row flex-wrap gap-x-4 gap-y-2 items-center min-w-[240px] min-h-6">
      <span className="text-muted-foreground w-[50px] shrink-0 whitespace-nowrap">{title}</span>
      {children}
    </div>
  )
}

export function TodoDetailFields({ todo, workspaceId }: Props): React.JSX.Element {
  const updateTodo = useUpdateTodo()
  const [collapsed, setCollapsed] = useState(false)

  // localStorage 에서 펼침/접힘 상태 복원 — 기본값은 펼침
  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLLAPSE_KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored === '1') setCollapsed(true)
    } catch {
      /* localStorage 접근 실패 시 기본값 유지 */
    }
  }, [])

  function toggleCollapse(): void {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      <button
        type="button"
        onClick={toggleCollapse}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground w-fit cursor-pointer"
        aria-expanded={!collapsed}
      >
        {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        <span>{collapsed ? '메타데이터 펼치기' : '메타데이터 접기'}</span>
      </button>

      {!collapsed && (
        <>
          <div className="grid grid-cols-1 gap-4 @[550px]:grid-cols-2 w-fit">
            {/* isDone */}
            <Label title="완료">
              <TodoCheckbox
                todoId={todo.id}
                workspaceId={workspaceId}
                checked={todo.isDone}
                title={todo.title}
              />
            </Label>
          </div>
          <div className="grid grid-cols-1 gap-4 @[550px]:grid-cols-2 w-fit">
            {/* startDate */}
            <Label title="시작일">
              <div className="flex gap-2">
                <DatePickerButton
                  value={todo.startDate ? new Date(todo.startDate) : null}
                  onChange={(date) => {
                    if (date && todo.startDate) {
                      const prev = new Date(todo.startDate)
                      date.setHours(prev.getHours(), prev.getMinutes(), prev.getSeconds(), 0)
                    }
                    updateTodo.mutate({ workspaceId, todoId: todo.id, data: { startDate: date } })
                  }}
                  placeholder="날짜 없음"
                  className="min-w-[140px]"
                />
                <TimePickerButton
                  value={formatTime(todo.startDate ? new Date(todo.startDate) : null)}
                  onChange={(time) => {
                    const base = todo.startDate ? new Date(todo.startDate) : null
                    const next = applyTime(base, time)
                    updateTodo.mutate({ workspaceId, todoId: todo.id, data: { startDate: next } })
                  }}
                  placeholder="시간 없음"
                  disabled={!todo.startDate}
                  className="w-[110px]"
                />
              </div>
            </Label>

            {/* dueDate */}
            <Label title="마감일">
              <div className="flex gap-2">
                <DatePickerButton
                  value={todo.dueDate ? new Date(todo.dueDate) : null}
                  onChange={(date) => {
                    if (date && todo.dueDate) {
                      const prev = new Date(todo.dueDate)
                      date.setHours(prev.getHours(), prev.getMinutes(), prev.getSeconds(), 0)
                    }
                    updateTodo.mutate({ workspaceId, todoId: todo.id, data: { dueDate: date } })
                  }}
                  placeholder="날짜 없음"
                  className="min-w-[140px]"
                />
                <TimePickerButton
                  value={formatTime(todo.dueDate ? new Date(todo.dueDate) : null)}
                  onChange={(time) => {
                    const base = todo.dueDate ? new Date(todo.dueDate) : null
                    const next = applyTime(base, time)
                    updateTodo.mutate({ workspaceId, todoId: todo.id, data: { dueDate: next } })
                  }}
                  placeholder="시간 없음"
                  disabled={!todo.dueDate}
                  className="w-[110px]"
                />
              </div>
            </Label>
          </div>

          <div className="grid grid-cols-1 gap-4 @[550px]:grid-cols-2 w-fit">
            {/* 알림 */}
            <Label title="알림">
              <ReminderSelect
                entityType="todo"
                entityId={todo.id}
                disabled={!todo.dueDate && !todo.startDate}
              />
            </Label>
          </div>

          <div className="grid grid-cols-1 gap-4 @[550px]:grid-cols-2 w-fit">
            {/* status */}
            <Label title="상태">
              <TodoStatusSelect
                value={todo.status}
                onChange={(status) =>
                  updateTodo.mutate({ workspaceId, todoId: todo.id, data: { status } })
                }
              />
            </Label>

            {/* priority */}
            <Label title="중요도">
              <TodoPrioritySelect
                value={todo.priority}
                onChange={(priority) =>
                  updateTodo.mutate({ workspaceId, todoId: todo.id, data: { priority } })
                }
              />
            </Label>
          </div>

          <div className="grid grid-cols-1 gap-4 @[550px]:grid-cols-2 w-fit">
            {/* 생성일 */}
            <Label title="생성일">
              <span className="text-muted-foreground">
                {new Date(todo.createdAt).toLocaleDateString('ko-KR')}
              </span>
            </Label>

            {/* 완료일 */}
            {todo.doneAt && (
              <Label title="완료일">
                <span className="text-muted-foreground">
                  {new Date(todo.doneAt).toLocaleDateString('ko-KR')}
                </span>
              </Label>
            )}
          </div>
        </>
      )}
    </div>
  )
}
