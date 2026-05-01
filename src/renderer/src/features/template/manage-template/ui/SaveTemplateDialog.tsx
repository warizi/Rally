import { JSX, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@shared/ui/dialog'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@shared/ui/form'
import { useCreateTemplate, type TemplateType } from '@entities/template'

const schema = z.object({
  title: z.string().trim().min(1, '제목을 입력해주세요')
})

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  type: TemplateType
  jsonData: string
}

export function SaveTemplateDialog({
  open,
  onOpenChange,
  workspaceId,
  type,
  jsonData
}: Props): JSX.Element {
  const { mutate: createTemplate, isPending } = useCreateTemplate()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: '' }
  })

  useEffect(() => {
    if (open) {
      form.reset({ title: '' })
    }
  }, [open, form])

  const handleSubmit = (values: FormValues): void => {
    createTemplate(
      { workspaceId, type, title: values.title.trim(), jsonData },
      {
        onSuccess: () => {
          toast.success('템플릿이 저장되었습니다')
          onOpenChange(false)
        },
        onError: (err) => {
          toast.error(`저장에 실패했습니다: ${err.message}`)
        }
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>템플릿 저장</DialogTitle>
          <DialogDescription>현재 내용을 템플릿으로 저장합니다.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>제목</FormLabel>
                  <FormControl>
                    <Input placeholder="템플릿 이름" autoFocus {...field} />
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
                {isPending ? '저장 중...' : '저장'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
