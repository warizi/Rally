# Component Patterns

## Dialog Components (Create/Edit/Delete)

### Create Dialog Pattern

```typescript
const schema = z.object({ name: z.string().min(1, '이름을 입력해주세요') })
type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (id: string) => void // success callback
}

export function CreateXxxDialog({ open, onOpenChange, onCreated }: Props): JSX.Element {
  const { mutate: createXxx, isPending } = useCreateXxx()
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: '' } })

  const handleSubmit = (values: FormValues) => {
    createXxx(values.name, {
      onSuccess: (data) => {
        if (data?.id) {
          onCreated(data.id)
          onOpenChange(false)
          form.reset()
        }
      }
    })
  }
}
```

### Edit Dialog Pattern (pre-fill via useEffect)

```typescript
useEffect(() => {
  if (workspace) form.reset({ name: workspace.name }) // sync on open
}, [workspace, form])
```

### Delete Dialog Pattern (AlertDialog, not Dialog)

```typescript
import { AlertDialog, AlertDialogAction, AlertDialogCancel, ... } from '@shared/ui/alert-dialog'

<AlertDialogAction
  onClick={handleDelete}
  disabled={isPending || disabled}
  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
>
  {isPending ? '삭제 중...' : '삭제'}
</AlertDialogAction>
```

## Form Pattern (react-hook-form + zod)

```typescript
// 1. Schema at top of file
const schema = z.object({ ... })
type FormValues = z.infer<typeof schema>

// 2. useForm with zodResolver
const form = useForm<FormValues>({
  resolver: zodResolver(schema),
  defaultValues: { name: '' }
})

// 3. shadcn Form + FormField render prop
<Form {...form}>
  <form onSubmit={form.handleSubmit(handleSubmit)}>
    <FormField
      control={form.control}
      name="name"
      render={({ field }) => (
        <FormItem>
          <FormLabel>이름</FormLabel>
          <FormControl><Input {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
    <DialogFooter>
      <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
      <Button type="submit" disabled={isPending}>
        {isPending ? '저장 중...' : '저장'}
      </Button>
    </DialogFooter>
  </form>
</Form>
```

## Loading/Error State Patterns

- Button text: `{isPending ? '생성 중...' : '생성'}`
- Button disabled: `disabled={isPending}`
- No global error handler — use mutation `onSuccess`/`onError` callbacks
- Error messages shown via FormMessage (zod validation) or toast

## shadcn/ui Components Location

- All shadcn components in: `src/renderer/src/shared/ui/`
- Style: `new-york`, icons: Lucide

## TabBar Component Pattern (DnD + Animation)

```typescript
// features/tap-system/manage-tab-system/ui/TabBar.tsx
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { AnimatePresence } from 'framer-motion'

interface TabBarProps {
  paneId: string
  showSidebarTrigger?: boolean
}

export function TabBar({ paneId, showSidebarTrigger = false }: TabBarProps) {
  const pane = useTabStore((state) => state.panes[paneId])
  const { setNodeRef, isOver } = useDroppable({ id: `tab-list:${paneId}` })

  return (
    <ScrollArea className={cn('h-9 w-full bg-muted', isOver && 'bg-primary/20')}>
      <div ref={setNodeRef} className="inline-flex items-center h-9 w-full">
        <SortableContext items={pane.tabIds} strategy={horizontalListSortingStrategy}>
          <AnimatePresence mode="popLayout">
            {paneTabs.map((tab) => (
              <TabContextMenu key={tab.id} tab={tab} paneId={paneId}>
                <TabItem tab={tab} isActive={pane.activeTabId === tab.id} ... />
              </TabContextMenu>
            ))}
          </AnimatePresence>
        </SortableContext>
      </div>
    </ScrollArea>
  )
}
```

- Droppable: `useDroppable({ id: 'tab-list:paneId' })`
- Sortable: `SortableContext` + `horizontalListSortingStrategy`
- Animation: `AnimatePresence mode="popLayout"` (탭 추가/제거 애니메이션)

## Null-returning Side Effect Component

```typescript
// app/providers/workspace-initializer.tsx
export function WorkspaceInitializer(): null {
  // Only side effects, no UI
  useEffect(() => {
    /* validate & switch workspace */
  }, [])
  return null
}
```

Used in Provider tree for initialization logic without UI.
