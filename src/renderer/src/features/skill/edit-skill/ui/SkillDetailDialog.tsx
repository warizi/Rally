import { JSX, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
import { ScrollArea } from '@shared/ui/scroll-area'
import { Textarea } from '@shared/ui/textarea'
import { Badge } from '@shared/ui/badge'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@shared/ui/form'
import { LockIcon } from 'lucide-react'
import type { SkillItem } from '@entities/skill'
import { useUpdateSkill } from '@entities/skill'
import { ToolMultiSelect } from '../../lib/ToolMultiSelect'

interface Props {
  skill: SkillItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const schema = z.object({
  description: z
    .string()
    .min(1, 'description 은 비워둘 수 없습니다')
    .max(4000, 'description 은 4000자 이하여야 합니다'),
  content: z
    .string()
    .min(1, 'content 는 비워둘 수 없습니다')
    .max(100_000, 'content 는 100,000자 이하여야 합니다'),
  mcpTools: z.array(z.string()),
  triggersCsv: z.string()
})

type FormValues = z.infer<typeof schema>

function csvToArray(value: string): string[] {
  return value
    .split(/[,\n]/g)
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
}

function arrayToCsv(arr: string[]): string {
  return arr.join(', ')
}

export function SkillDetailDialog({ skill, open, onOpenChange }: Props): JSX.Element | null {
  const updateSkill = useUpdateSkill()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      description: '',
      content: '',
      mcpTools: [],
      triggersCsv: ''
    }
  })

  useEffect(() => {
    if (open && skill) {
      form.reset({
        description: skill.description,
        content: skill.content,
        mcpTools: skill.mcpTools,
        triggersCsv: arrayToCsv(skill.triggers)
      })
    }
  }, [open, skill, form])

  if (!skill) return null

  const readonly = !skill.editable

  const handleSubmit = async (values: FormValues): Promise<void> => {
    if (readonly) return
    try {
      await updateSkill.mutateAsync({
        id: skill.id,
        input: {
          description: values.description,
          content: values.content,
          mcpTools: values.mcpTools,
          triggers: csvToArray(values.triggersCsv)
        }
      })
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : '저장에 실패했습니다'
      form.setError('content', { message })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] grid-rows-[auto_1fr_auto] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="font-mono text-base">{skill.name}</DialogTitle>
            <Badge variant={skill.source === 'system' ? 'secondary' : 'outline'}>
              {skill.source === 'system' ? '기본' : '커스텀'}
            </Badge>
            {readonly && (
              <span title="기본 skill 은 수정할 수 없습니다" className="text-muted-foreground">
                <LockIcon className="size-3.5" />
              </span>
            )}
          </div>
          <DialogDescription className="text-xs">
            {readonly
              ? '기본 skill 은 읽기 전용입니다. 내용을 참고할 수 있어요.'
              : 'description, content, mcpTools, triggers 를 수정할 수 있습니다. name 은 변경할 수 없어요.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex min-h-0 flex-col">
            <ScrollArea className="min-h-0 flex-1" viewportClassName="pr-3">
              <div className="flex flex-col gap-3">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          readOnly={readonly}
                          placeholder="언제 이 skill 을 사용할지 / 무엇을 하는지"
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
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKILL.md 본문</FormLabel>
                      <FormControl>
                        {readonly ? (
                          // readonly: <pre> + ScrollArea 로 커스텀 스크롤바 사용
                          <ScrollArea className="border-input bg-input/30 h-80 rounded-md border">
                            <pre className="px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
                              {field.value}
                            </pre>
                          </ScrollArea>
                        ) : (
                          // editable: textarea 유지 (h-80 고정 + field-sizing-fixed 로 자동 grow 차단)
                          <Textarea
                            placeholder="---&#10;name: ...&#10;description: ...&#10;---&#10;&#10;본문..."
                            className="field-sizing-fixed h-80 font-mono text-xs leading-relaxed"
                            {...field}
                          />
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/*
                  mcpTools / triggers 는 사용자 등록 메타데이터.
                  system skill 은 SKILL.md frontmatter 만 source-of-truth 이므로 본문에서 직접 확인.
                */}
                {!readonly && (
                  <>
                    <FormField
                      control={form.control}
                      name="mcpTools"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>MCP Tools</FormLabel>
                          <FormControl>
                            <ToolMultiSelect value={field.value} onChange={field.onChange} />
                          </FormControl>
                          <FormDescription className="text-[11px]">
                            이 skill 이 활용할 Rally MCP tool 들을 선택하세요.
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
                            쉼표 또는 줄바꿈으로 구분
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </div>
            </ScrollArea>
          </form>
        </Form>

        <DialogFooter className="shrink-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {readonly ? '닫기' : '취소'}
          </Button>
          {!readonly && (
            <Button
              type="button"
              disabled={updateSkill.isPending}
              onClick={form.handleSubmit(handleSubmit)}
            >
              {updateSkill.isPending ? '저장 중…' : '저장'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
