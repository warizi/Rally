import { useState, useEffect } from 'react'
import { X, Pencil } from 'lucide-react'
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

export function TerminalTabItem({ session, isActive, onActivate }: Props): React.ReactElement {
  const [renameOpen, setRenameOpen] = useState(false)
  const removeSession = useTerminalStore((s) => s.removeSession)
  const updateSession = useTerminalStore((s) => s.updateSession)

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
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              'group flex items-center h-7 gap-2 px-4 mt-1 mx-0.5 rounded-t-md border-t border-x border-border',
              'cursor-pointer select-none transition-colors shrink-0',
              isActive
                ? 'bg-background text-foreground'
                : 'bg-transparent text-muted-foreground hover:bg-background/50 hover:text-foreground'
            )}
            onClick={onActivate}
          >
            <span className="text-sm truncate max-w-48">{session.name}</span>
            <button
              className={cn(
                'size-4 rounded-sm flex items-center justify-center shrink-0',
                'opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-colors'
              )}
              onClick={handleClose}
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
            <X className="size-4 mr-2" />
            탭 닫기
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

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
