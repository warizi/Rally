import { JSX, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@shared/ui/dialog'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { Textarea } from '@shared/ui/textarea'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@shared/ui/form'
import { assembleSkillContent, useCreateSkill } from '@entities/skill'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const schema = z.object({
  name: z
    .string()
    .min(1, '이름을 입력해주세요')
    .max(60, '60자 이하로 입력해주세요')
    .regex(
      /^[a-z0-9][a-z0-9_-]{0,59}$/,
      '영소문자/숫자/하이픈/언더스코어만 가능합니다 (첫 글자는 영소문자/숫자)'
    ),
  description: z.string().min(1, '이 skill 이 무엇을 하는지 설명해주세요').max(4000),
  mcpToolsCsv: z.string(),
  triggersCsv: z.string(),
  body: z.string()
})

type FormValues = z.infer<typeof schema>

function csvToArray(value: string): string[] {
  return value
    .split(/[,\n]/g)
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
}

export function RegisterSkillDialog({ open, onOpenChange }: Props): JSX.Element {
  const createSkill = useCreateSkill()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      description: '',
      mcpToolsCsv: '',
      triggersCsv: '',
      body: ''
    }
  })

  const watched = form.watch()
  const preview = useMemo(
    () =>
      assembleSkillContent({
        name: watched.name || 'skill-name',
        description: watched.description || '<description>',
        body: watched.body,
        mcpTools: csvToArray(watched.mcpToolsCsv),
        triggers: csvToArray(watched.triggersCsv)
      }),
    [watched]
  )

  const handleSubmit = async (values: FormValues): Promise<void> => {
    const mcpTools = csvToArray(values.mcpToolsCsv)
    const triggers = csvToArray(values.triggersCsv)
    const content = assembleSkillContent({
      name: values.name,
      description: values.description,
      body: values.body,
      mcpTools,
      triggers
    })
    try {
      await createSkill.mutateAsync({
        name: values.name,
        description: values.description,
        content,
        mcpTools,
        triggers
      })
      toast.success(`${values.name} skill 을 등록했습니다.`)
      form.reset()
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : '등록에 실패했습니다'
      if (message.includes('이름')) {
        form.setError('name', { message })
      } else {
        form.setError('description', { message })
      }
      toast.error(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>커스텀 Skill 등록</DialogTitle>
          <DialogDescription className="text-xs">
            입력값으로 SKILL.md 가 자동 어셈블됩니다. 우측에서 결과를 확인하세요.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0 overflow-hidden"
          >
            {/* 좌측 — 입력 */}
            <div className="flex flex-col gap-3 overflow-y-auto pr-1 min-h-0">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>이름</FormLabel>
                    <FormControl>
                      <Input placeholder="my-custom-skill" autoFocus {...field} />
                    </FormControl>
                    <FormDescription className="text-[11px]">
                      <code className="bg-muted px-1 rounded">~/.claude/skills/&lt;name&gt;/</code>{' '}
                      디렉터리명으로 사용됩니다.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>설명</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="이 skill 이 무엇을 하는지, 언제 사용해야 하는지 설명"
                        className="min-h-20"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-[11px]">
                      Claude 가 trigger 여부를 판단할 때 이 텍스트를 본다.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="mcpToolsCsv"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>사용할 MCP Tools</FormLabel>
                    <FormControl>
                      <Input placeholder="read, browse, manage_tasks" {...field} />
                    </FormControl>
                    <FormDescription className="text-[11px]">
                      쉼표 또는 줄바꿈으로 구분
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="triggersCsv"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>트리거 키워드</FormLabel>
                    <FormControl>
                      <Input placeholder="할일, todo, 오늘 뭐 해야 해" {...field} />
                    </FormControl>
                    <FormDescription className="text-[11px]">
                      쉼표 또는 줄바꿈으로 구분 — description 끝에 자동 부착됨
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="body"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>본문 (선택)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="추가 지침, 예시, 주의사항 등을 markdown 으로 작성"
                        className="min-h-32"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-[11px]">
                      비워두어도 됩니다 — 자동 생성된 MCP Tools / 트리거 섹션이 포함됩니다.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 우측 — 미리보기 */}
            <div className="flex flex-col min-h-0">
              <div className="text-xs font-medium text-muted-foreground mb-2">
                SKILL.md 미리보기
              </div>
              <pre className="flex-1 min-h-0 overflow-auto text-[11px] leading-relaxed bg-muted/50 border rounded-md px-3 py-2 font-mono whitespace-pre-wrap">
                {preview}
              </pre>
            </div>
          </form>
        </Form>

        <DialogFooter className="shrink-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button
            type="button"
            disabled={createSkill.isPending}
            onClick={form.handleSubmit(handleSubmit)}
          >
            {createSkill.isPending ? '등록 중…' : '등록'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
