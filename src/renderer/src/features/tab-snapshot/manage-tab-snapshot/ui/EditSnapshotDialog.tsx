import { JSX, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/ui/dialog'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { Textarea } from '@shared/ui/textarea'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@shared/ui/form'
import { useUpdateTabSnapshot } from '@entities/tab-snapshot'
import type { TabSnapshot } from '@entities/tab-snapshot'

const schema = z.object({
  name: z.string().min(1, '이름을 입력해주세요'),
  description: z.string().optional()
})

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  snapshot: TabSnapshot | null
}

export function EditSnapshotDialog({ open, onOpenChange, snapshot }: Props): JSX.Element {
  const { mutate: updateSnapshot, isPending } = useUpdateTabSnapshot()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: snapshot?.name ?? '', description: snapshot?.description ?? '' }
  })

  useEffect(() => {
    if (snapshot) {
      form.reset({ name: snapshot.name, description: snapshot.description ?? '' })
    }
  }, [snapshot, form])

  const handleSubmit = (values: FormValues): void => {
    if (!snapshot) return
    updateSnapshot(
      { id: snapshot.id, name: values.name, description: values.description || undefined },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>스냅샷 수정</DialogTitle>
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
                    <Input placeholder="스냅샷 이름" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="mt-4">
                  <FormLabel>설명 (선택)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="스냅샷 설명" rows={2} {...field} />
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
