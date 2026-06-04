/**
 * codex-prompt 단위 테스트 — Claude SKILL.md → Codex 프롬프트 변환.
 */
import { describe, it, expect } from 'vitest'
import { toCodexPrompt } from '../codex-prompt'

describe('toCodexPrompt', () => {
  it('선행 YAML frontmatter 를 제거하고 본문만 남긴다', () => {
    const skill = '---\nname: rally-do\ndescription: 실행 루프\n---\n# 본문\n내용\n'
    const out = toCodexPrompt(skill)
    expect(out).toBe('# 본문\n내용\n')
    expect(out).not.toContain('description:')
  })

  it('frontmatter 가 없으면 본문 그대로 (trim + 개행)', () => {
    expect(toCodexPrompt('# 그냥 본문\nabc')).toBe('# 그냥 본문\nabc\n')
  })

  it('닫는 fence 가 없으면 frontmatter 로 보지 않는다', () => {
    const noClose = '---\n본문인데 fence 안닫힘'
    expect(toCodexPrompt(noClose)).toBe('---\n본문인데 fence 안닫힘\n')
  })

  it('빈 frontmatter 도 처리', () => {
    expect(toCodexPrompt('---\n---\n# body\n')).toBe('# body\n')
  })

  it('항상 단일 trailing newline 으로 끝난다', () => {
    expect(toCodexPrompt('# x\n\n\n')).toBe('# x\n')
  })
})
