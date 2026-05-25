import { JSX, useEffect } from 'react'
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
import { RotateCcwIcon } from 'lucide-react'
import type { SkillItem } from '@entities/skill'
import { useResetSystemSkill, useUpdateSkill } from '@entities/skill'
import { ToolMultiSelect } from '../../lib/ToolMultiSelect'

interface Props {
  skill: SkillItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const schema = z.object({
  // system skill 은 description 이 frontmatter 파생이라 별도 입력하지 않음 (UI 에서 숨김).
  description: z.string().max(4000, 'description 은 4000자 이하여야 합니다'),
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
  const resetSystem = useResetSystemSkill()
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

  const isSystem = skill.source === 'system'

  const handleSubmit = async (values: FormValues): Promise<void> => {
    try {
      await updateSkill.mutateAsync({
        id: skill.id,
        input: {
          // system skill 의 description 은 frontmatter 파생이라 무시됨.
          ...(isSystem ? {} : { description: values.description }),
          content: values.content,
          mcpTools: values.mcpTools,
          triggers: csvToArray(values.triggersCsv)
        }
      })
      toast.success(`${skill.name} 저장됨`)
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : '저장에 실패했습니다'
      form.setError('content', { message })
      toast.error(message)
    }
  }

  const handleReset = async (): Promise<void> => {
    try {
      const fresh = await resetSystem.mutateAsync({ id: skill.id })
      if (fresh) {
        form.reset({
          description: fresh.description,
          content: fresh.content,
          mcpTools: fresh.mcpTools,
          triggersCsv: arrayToCsv(fresh.triggers)
        })
      }
      toast.success(`${skill.name} 을(를) 기본값으로 복원했습니다.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : '복원에 실패했습니다'
      toast.error(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] grid-rows-[auto_1fr_auto] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="font-mono text-base">{skill.name}</DialogTitle>
            <Badge variant={isSystem ? 'secondary' : 'outline'}>
              {isSystem ? '기본' : '커스텀'}
            </Badge>
            {isSystem && skill.hasOverride && (
              <Badge variant="outline" className="text-amber-600 border-amber-500/40">
                수정됨
              </Badge>
            )}
          </div>
          <DialogDescription className="text-xs">
            {isSystem
              ? 'SKILL.md 본문, MCP Tools, 트리거를 사용자별로 덮어쓸 수 있습니다. 이름은 변경할 수 없으며 "기본값으로 복원" 으로 번들된 원본으로 되돌릴 수 있어요.'
              : 'description, content, mcpTools, triggers 를 수정할 수 있습니다. 이름은 변경할 수 없어요.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex min-h-0 flex-col">
            <ScrollArea className="min-h-0 flex-1" viewportClassName="pr-3">
              <div className="flex flex-col gap-3">
                {!isSystem && (
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
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
                )}

                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKILL.md 본문</FormLabel>
                      <FormControl>
                        {/*
                          Textarea 는 native element 라 div 기반 ScrollArea 로 감쌀 수 없음.
                          대신 전역 .scrollbar-thin (global.css) 으로 native scrollbar 를
                          ScrollArea 와 동일한 모양으로 스타일링.
                        */}
                        <Textarea
                          placeholder="---&#10;name: ...&#10;description: ...&#10;---&#10;&#10;본문..."
                          className="field-sizing-fixed scrollbar-thin h-80 font-mono text-xs leading-relaxed"
                          {...field}
                        />
                      </FormControl>
                      {isSystem && (
                        <FormDescription className="text-[11px]">
                          system skill 의 description 은 본문 frontmatter 의 description 으로부터
                          파생됩니다.
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/*
                  mcpTools / triggers 메타 필드는 커스텀 skill 전용.
                  system skill 은 SKILL.md frontmatter / 본문에서 직접 명시하므로 별도 입력 X.
                */}
                {!isSystem && (
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

        <DialogFooter className="shrink-0 sm:justify-between">
          <div>
            {isSystem && skill.hasOverride && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={resetSystem.isPending}
                className="gap-1.5 text-xs text-muted-foreground"
              >
                <RotateCcwIcon className="size-3" />
                {resetSystem.isPending ? '복원 중…' : '기본값으로 복원'}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button
              type="button"
              disabled={updateSkill.isPending}
              onClick={form.handleSubmit(handleSubmit)}
            >
              {updateSkill.isPending ? '저장 중…' : '저장'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
