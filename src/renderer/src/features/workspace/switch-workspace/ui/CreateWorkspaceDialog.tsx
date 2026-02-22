import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/ui/dialog'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@shared/ui/form'
import { useCreateWorkspace } from '@entities/workspace'
import { JSX } from 'react'

const schema = z.object({
  name: z.string().min(1, '이름을 입력해주세요')
})

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (id: string) => void
}

export function CreateWorkspaceDialog({ open, onOpenChange, onCreated }: Props): JSX.Element {
  const { mutate: createWorkspace, isPending } = useCreateWorkspace()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '' }
  })

  const handleSubmit = (values: FormValues): void => {
    createWorkspace(values.name, {
      onSuccess: (data) => {
        if (data?.id) {
          onCreated(data.id)
          onOpenChange(false)
          form.reset()
        }
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>워크스페이스 추가</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>이름</FormLabel>
                  <FormControl>
                    <Input placeholder="워크스페이스 이름" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? '생성 중...' : '생성'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
