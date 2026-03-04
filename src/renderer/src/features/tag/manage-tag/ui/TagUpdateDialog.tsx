import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@shared/ui/dialog'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { Textarea } from '@shared/ui/textarea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@shared/ui/form'
import type { TagItem } from '@entities/tag'
import { TagColorPicker } from './TagColorPicker'

const schema = z.object({
  name: z.string().min(1, '이름을 입력해주세요').max(50, '이름이 너무 깁니다'),
  color: z.string().min(1),
  description: z.string().max(200).optional()
})

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  tag: TagItem
  isPending?: boolean
  onSubmit: (data: { name?: string; color?: string; description?: string | null }) => void
  onRemove?: () => void
}

export function TagUpdateDialog({
  open,
  onOpenChange,
  tag,
  isPending,
  onSubmit,
  onRemove
}: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: tag.name,
      color: tag.color,
      description: tag.description ?? ''
    }
  })

  useEffect(() => {
    if (open) {
      form.reset({
        name: tag.name,
        color: tag.color,
        description: tag.description ?? ''
      })
    }
  }, [open, tag, form])

  const handleSubmit = (values: FormValues): void => {
    onSubmit({
      ...(values.name !== tag.name && { name: values.name }),
      ...(values.color !== tag.color && { color: values.color }),
      ...(values.description !== (tag.description ?? '') && {
        description: values.description || null
      })
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle>태그 수정</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>이름</FormLabel>
                    <FormControl>
                      <Input placeholder="태그 이름" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>색상</FormLabel>
                    <FormControl>
                      <TagColorPicker value={field.value} onChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>설명 (선택)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="태그 설명"
                        className="resize-none"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter className="mt-4">
              {onRemove && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={onRemove}
                  className="mr-auto"
                >
                  삭제
                </Button>
              )}
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
