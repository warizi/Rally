import { JSX, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/ui/dialog'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@shared/ui/form'
import { useUpdateWorkspace } from '@entities/workspace'
import type { Workspace } from '@entities/workspace'

const schema = z.object({
  name: z.string().min(1, '이름을 입력해주세요'),
  path: z.string().min(1, '경로를 선택해주세요')
})

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspace: Workspace | null
}

export function EditWorkspaceDialog({ open, onOpenChange, workspace }: Props): JSX.Element {
  const { mutate: updateWorkspace, isPending } = useUpdateWorkspace()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: workspace?.name ?? '', path: workspace?.path ?? '' }
  })

  useEffect(() => {
    if (workspace) {
      form.reset({ name: workspace.name, path: workspace.path })
    }
  }, [workspace, form])

  const handleSelectDirectory = async (): Promise<void> => {
    const result = await window.api.workspace.selectDirectory()
    if (result) {
      form.setValue('path', result, { shouldValidate: true })
    }
  }

  const handleSubmit = (values: FormValues): void => {
    if (!workspace) return
    updateWorkspace(
      { id: workspace.id, name: values.name, path: values.path },
      {
        onSuccess: () => {
          onOpenChange(false)
        }
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>워크스페이스 이름 변경</DialogTitle>
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
                      <Input placeholder="폴더를 선택해주세요" readOnly {...field} disabled />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSelectDirectory}
                      disabled
                    >
                      폴더 선택
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? '저장 중...' : '저장'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
