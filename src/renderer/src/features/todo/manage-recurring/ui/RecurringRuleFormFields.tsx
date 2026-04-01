import type { Control } from 'react-hook-form'
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@shared/ui/form'
import { Input } from '@shared/ui/input'
import { Textarea } from '@shared/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select'
import { Button } from '@shared/ui/button'
import { DatePickerButton } from '@shared/ui/date-picker-button'
import { TimePickerButton } from '@shared/ui/time-picker-button'
import { RECURRENCE_TYPE_LABELS, DAY_LABELS, REMINDER_OPTIONS } from '../model/recurring-rule-form'

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>
}

export function RecurringRuleFormFields({ control }: Props): React.JSX.Element {
  return (
    <div className="space-y-4">
      {/* 제목 */}
      <FormField
        control={control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>제목</FormLabel>
            <FormControl>
              <Input placeholder="반복 할일 제목" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* 설명 */}
      <FormField
        control={control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>설명</FormLabel>
            <FormControl>
              <Textarea placeholder="설명 (선택)" rows={2} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* 중요도 */}
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

      {/* 반복 유형 */}
      <FormField
        control={control}
        name="recurrenceType"
        render={({ field }) => (
          <FormItem>
            <FormLabel>반복</FormLabel>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(RECURRENCE_TYPE_LABELS).map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  variant={field.value === value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => field.onChange(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* 요일 선택 (custom 타입에서만) */}
      <FormField
        control={control}
        name="recurrenceType"
        render={({ field: typeField }) =>
          typeField.value === 'custom' ? (
            <FormField
              control={control}
              name="daysOfWeek"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>요일 선택</FormLabel>
                  <div className="flex gap-1.5 flex-wrap">
                    {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                      const selected = (field.value as number[]).includes(day)
                      return (
                        <Button
                          key={day}
                          type="button"
                          variant={selected ? 'default' : 'outline'}
                          size="sm"
                          className="w-9 h-9 p-0"
                          onClick={() => {
                            const next = selected
                              ? (field.value as number[]).filter((d: number) => d !== day)
                              : [...(field.value as number[]), day]
                            field.onChange(next)
                          }}
                        >
                          {DAY_LABELS[day]}
                        </Button>
                      )
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <></>
          )
        }
      />

      {/* 반복 기간 */}
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={control}
          name="startDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>시작일</FormLabel>
              <FormControl>
                <DatePickerButton
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="시작일 선택"
                  className="w-full"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="endDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>종료일</FormLabel>
              <FormControl>
                <DatePickerButton
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="없음 (무기한)"
                  className="w-full"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* 시간 설정 */}
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={control}
          name="startTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>시작 시간</FormLabel>
              <FormControl>
                <TimePickerButton
                  value={field.value ?? null}
                  onChange={field.onChange}
                  placeholder="시간 선택"
                  className="w-full"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="endTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>종료 시간</FormLabel>
              <FormControl>
                <TimePickerButton
                  value={field.value ?? null}
                  onChange={field.onChange}
                  placeholder="시간 선택"
                  className="w-full"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* 알림 */}
      <FormField
        control={control}
        name="reminderOffsetMs"
        render={({ field }) => (
          <FormItem>
            <FormLabel>알림</FormLabel>
            <Select
              onValueChange={(v) => field.onChange(v === 'null' ? null : Number(v))}
              value={field.value === null ? 'null' : String(field.value)}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {REMINDER_OPTIONS.map((opt) => (
                  <SelectItem
                    key={String(opt.value)}
                    value={opt.value === null ? 'null' : String(opt.value)}
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
