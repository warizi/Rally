import { useState, useEffect, useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion } from 'framer-motion'
import { X, Pencil, Terminal as TerminalIcon } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { cn } from '@shared/lib/utils'
import { useTerminalStore } from '@features/terminal/model/store'
import type { TerminalSession } from '@features/terminal/model/types'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@shared/ui/context-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/ui/dialog'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@shared/ui/form'

const schema = z.object({
  name: z.string().min(1, '이름을 입력해주세요').max(100, '이름이 너무 깁니다')
})

type FormValues = z.infer<typeof schema>

interface Props {
  session: TerminalSession
  isActive: boolean
  onActivate: () => void
}

/**
 * 터미널 탭 아이템. 일반 TabItem 디자인과 통일 (h-8, 아이콘, padding, hover).
 * dnd-kit useSortable 로 같은 패널 내 순서 변경 가능.
 */
export function TerminalTabItem({ session, isActive, onActivate }: Props): React.ReactElement {
  const [renameOpen, setRenameOpen] = useState(false)
  const removeSession = useTerminalStore((s) => s.removeSession)
  const updateSession = useTerminalStore((s) => s.updateSession)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: session.id
  })
  const itemRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (isActive && itemRef.current) {
      itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }
  }, [isActive])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: session.name }
  })

  useEffect(() => {
    if (renameOpen) {
      form.reset({ name: session.name })
    }
  }, [renameOpen, session.name, form])

  const handleRenameSubmit = (values: FormValues): void => {
    const trimmed = values.name.trim()
    updateSession(session.id, { name: trimmed })
    window.api.terminal.updateSession(session.id, { name: trimmed })
    setRenameOpen(false)
  }

  const handleClose = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    await window.api.terminal.destroy(session.id)
    await window.api.terminal.closeSession(session.id)
    removeSession(session.id)
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
      >
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              ref={(node) => {
                setNodeRef(node)
                ;(itemRef as React.MutableRefObject<HTMLDivElement | null>).current = node
              }}
              style={style}
              {...attributes}
              {...listeners}
              onClick={onActivate}
              className={cn(
                'group flex items-center h-8 gap-2 px-3 py-1 mt-1 rounded-md ml-1',
                'cursor-pointer select-none transition-colors',
                'hover:bg-background',
                'min-w-45 max-w-45',
                isActive && 'bg-background border border-primary/50',
                isDragging && 'opacity-50 z-50',
                !isActive && 'bg-none',
                'no-drag-region'
              )}
            >
              {/* 아이콘 */}
              <TerminalIcon className="size-4 shrink-0 text-muted-foreground" />

              {/* 제목 */}
              <span className="text-sm truncate flex-1">{session.name}</span>

              {/* 닫기 버튼 */}
              <button
                onClick={handleClose}
                className={cn(
                  'size-4 rounded-sm flex items-center justify-center shrink-0',
                  'text-muted-foreground/50 hover:text-foreground transition-colors',
                  'cursor-pointer'
                )}
              >
                <X className="size-3" />
              </button>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-40">
            <ContextMenuItem onClick={() => setRenameOpen(true)}>
              <Pencil className="size-4 mr-2" />
              이름 변경
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              variant="destructive"
              onClick={(e) => handleClose(e as unknown as React.MouseEvent)}
            >
              <X className="size-4 mr-2" />탭 닫기
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </motion.div>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>터미널 이름 변경</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleRenameSubmit)}>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>터미널 이름</FormLabel>
                    <FormControl>
                      <Input placeholder="터미널 이름" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>
                  취소
                </Button>
                <Button type="submit">변경</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
