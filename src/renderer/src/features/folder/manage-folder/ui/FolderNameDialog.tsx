import { JSX, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/ui/dialog'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@shared/ui/form'

const schema = z.object({
  name: z.string().min(1, '이름을 입력해주세요').max(255, '이름이 너무 깁니다')
})

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  defaultValue?: string
  submitLabel: string
  isPending?: boolean
  onSubmit: (name: string) => void
}

export function FolderNameDialog({
  open,
  onOpenChange,
  title,
  defaultValue = '',
  submitLabel,
  isPending,
  onSubmit
}: Props): JSX.Element {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: defaultValue }
  })

  useEffect(() => {
    if (open) {
      form.reset({ name: defaultValue })
    }
  }, [open, defaultValue, form])

  const handleSubmit = (values: FormValues): void => {
    onSubmit(values.name)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>폴더 이름</FormLabel>
                  <FormControl>
                    <Input placeholder="폴더 이름" autoFocus {...field} />
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
                {isPending ? `${submitLabel} 중...` : submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
