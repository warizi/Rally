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
  name: z.string().min(1, '이름을 입력해주세요'),
  path: z.string().min(1, '경로를 선택해주세요')
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
    defaultValues: { name: '', path: '' }
  })

  const handleSelectDirectory = async (): Promise<void> => {
    const result = await window.api.workspace.selectDirectory()
    if (result) {
      form.setValue('path', result, { shouldValidate: true })
    }
  }

  const handleSubmit = (values: FormValues): void => {
    createWorkspace(
      { name: values.name, path: values.path },
      {
        onSuccess: (data) => {
          if (data?.id) {
            onCreated(data.id)
            onOpenChange(false)
            form.reset()
          }
        }
      }
    )
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
            <FormField
              control={form.control}
              name="path"
              render={({ field }) => (
                <FormItem className="mt-4">
                  <FormLabel>워크스페이스 경로</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input placeholder="폴더를 선택해주세요" readOnly {...field} />
                    </FormControl>
                    <Button type="button" variant="outline" onClick={handleSelectDirectory}>
                      폴더 선택
                    </Button>
                  </div>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">생성 후 경로는 변경할 수 없습니다.</p>
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
