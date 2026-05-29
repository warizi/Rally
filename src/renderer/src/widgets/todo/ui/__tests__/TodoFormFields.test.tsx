/**
 * widgets/todo/ui/TodoFormFields.test.tsx
 *
 * titleOnly 분기 — 제목 만 / 설명+상태+중요도 포함.
 * react-hook-form Control 은 useForm으로 실제 생성.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useForm, FormProvider } from 'react-hook-form'
import { Form } from '@shared/ui/form'
import { TodoFormFields } from '../TodoFormFields'

function Harness({ titleOnly }: { titleOnly?: boolean }): React.JSX.Element {
  const form = useForm({
    defaultValues: { title: '', description: '', status: '할일', priority: 'medium' }
  })
  return (
    <FormProvider {...form}>
      <Form {...form}>
        <TodoFormFields
          control={form.control}
          errors={form.formState.errors}
          titleOnly={titleOnly}
        />
      </Form>
    </FormProvider>
  )
}

describe('TodoFormFields', () => {
  it('기본 → 제목/설명/상태/중요도 4개 필드', () => {
    render(<Harness />)
    expect(screen.getByText('제목')).toBeInTheDocument()
    expect(screen.getByText('설명')).toBeInTheDocument()
    expect(screen.getByText('상태')).toBeInTheDocument()
    expect(screen.getByText('중요도')).toBeInTheDocument()
  })

  it('titleOnly=true → 제목만, 설명/상태/중요도 미노출', () => {
    render(<Harness titleOnly />)
    expect(screen.getByText('제목')).toBeInTheDocument()
    expect(screen.queryByText('설명')).not.toBeInTheDocument()
    expect(screen.queryByText('상태')).not.toBeInTheDocument()
    expect(screen.queryByText('중요도')).not.toBeInTheDocument()
  })

  it('Input 노출 (제목 placeholder)', () => {
    render(<Harness />)
    expect(screen.getByPlaceholderText('할 일 제목')).toBeInTheDocument()
  })
})
