/**
 * P-1 — MCP 등록 고지·동의 다이얼로그 회귀 차단.
 *
 * 이 다이얼로그의 존재 이유는 "등록이 무슨 일을 하는지 알리는 것"이다. 따라서 검증 대상은
 * 렌더링 여부가 아니라 **고지 3요소가 실제로 화면에 있는가**와 **동의 없이는 등록이
 * 실행되지 않는가** 두 가지다.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { McpConsentDialog } from '../McpConsentDialog'

const setup = (
  over: Partial<Parameters<typeof McpConsentDialog>[0]> = {}
): { onConfirm: ReturnType<typeof vi.fn>; onOpenChange: ReturnType<typeof vi.fn> } => {
  const onConfirm = vi.fn()
  const onOpenChange = vi.fn()
  render(
    <McpConsentDialog
      open
      onOpenChange={onOpenChange}
      clientName="Claude Desktop"
      onConfirm={onConfirm}
      {...over}
    />
  )
  return { onConfirm, onOpenChange }
}

describe('McpConsentDialog — 고지 3요소', () => {
  it('① 워크스페이스 전체를 읽고 수정할 수 있음을 알린다', () => {
    setup()
    expect(screen.getByText(/모든 노트·할 일·일정·캔버스를 읽고 수정/)).toBeInTheDocument()
  })

  it('② 제공사 서버로 전송될 수 있음 + 국외 가능성을 알린다', () => {
    setup()
    expect(screen.getByText(/해당 서비스 제공사의 서버로 전송/)).toBeInTheDocument()
    expect(screen.getByText(/국외에 있을 수 있습니다/)).toBeInTheDocument()
  })

  it('③ 언제든 연결을 끊을 수 있음을 알린다', () => {
    setup()
    expect(screen.getByText(/로 끊을 수 있습니다/)).toBeInTheDocument()
  })

  it('대상 클라이언트 이름을 제목과 본문에 명시한다', () => {
    setup({ clientName: 'Codex' })
    expect(screen.getByText(/Codex에 이 워크스페이스를 연결할까요\?/)).toBeInTheDocument()
  })
})

describe('McpConsentDialog — 동의 흐름', () => {
  it('확인 버튼을 눌러야 onConfirm 이 실행된다', () => {
    const { onConfirm } = setup()
    expect(onConfirm).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /확인했습니다, 연결/ }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('취소하면 onConfirm 이 실행되지 않는다', () => {
    const { onConfirm } = setup()
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('busy 중에는 확인 버튼이 비활성화된다 (중복 등록 방지)', () => {
    setup({ busy: true })
    expect(screen.getByRole('button', { name: /연결 중/ })).toBeDisabled()
  })

  it('open=false 면 아무것도 렌더링하지 않는다', () => {
    render(
      <McpConsentDialog
        open={false}
        onOpenChange={vi.fn()}
        clientName="Claude Desktop"
        onConfirm={vi.fn()}
      />
    )
    expect(screen.queryByText(/연결할까요\?/)).not.toBeInTheDocument()
  })
})
