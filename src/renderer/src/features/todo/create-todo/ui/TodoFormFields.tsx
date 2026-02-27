import type { Control, FieldErrors } from 'react-hook-form'
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@shared/ui/form'
import { Input } from '@shared/ui/input'
import { Textarea } from '@shared/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select'

export interface CreateTodoFormValues {
  title: string
  description: string
  status: '할일' | '진행중' | '완료' | '보류'
  priority: 'high' | 'medium' | 'low'
}

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>
  errors: FieldErrors<CreateTodoFormValues>
  titleOnly?: boolean
}

export function TodoFormFields({ control, titleOnly }: Props): React.JSX.Element {
  return (
    <div className="space-y-4">
      <FormField
        control={control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>제목</FormLabel>
            <FormControl>
              <Input placeholder="할 일 제목" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {!titleOnly && (
        <FormField
          control={control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>설명</FormLabel>
              <FormControl>
                <Textarea placeholder="설명 (선택)" rows={3} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {!titleOnly && (
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>상태</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="할일">할일</SelectItem>
                    <SelectItem value="진행중">진행중</SelectItem>
                    <SelectItem value="완료">완료</SelectItem>
                    <SelectItem value="보류">보류</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>중요도</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="high">높음</SelectItem>
                    <SelectItem value="medium">보통</SelectItem>
                    <SelectItem value="low">낮음</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </div>
  )
}
