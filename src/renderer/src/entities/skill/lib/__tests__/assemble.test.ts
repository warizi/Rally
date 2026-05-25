import { describe, it, expect } from 'vitest'
import { assembleSkillContent } from '../assemble'

describe('assembleSkillContent', () => {
  it('필수 항목만으로 frontmatter + 본문 헤더 생성', () => {
    const out = assembleSkillContent({
      name: 'my-skill',
      description: 'does the thing',
      mcpTools: [],
      triggers: []
    })
    expect(out).toContain('---\nname: my-skill\ndescription: |\n  does the thing\n---')
    expect(out).toContain('# my-skill')
    expect(out).not.toContain('## 사용 MCP Tools')
    expect(out).not.toContain('## 트리거 키워드')
  })

  it('description 여러 줄을 YAML block 으로 들여쓰기', () => {
    const out = assembleSkillContent({
      name: 'multi',
      description: 'first line\nsecond line',
      mcpTools: [],
      triggers: []
    })
    expect(out).toContain('description: |\n  first line\n  second line')
  })

  it('triggers 가 있으면 description 끝에 자연어 부착', () => {
    const out = assembleSkillContent({
      name: 'with-triggers',
      description: 'desc',
      mcpTools: [],
      triggers: ['foo', 'bar']
    })
    expect(out).toContain('Triggers: foo, bar.')
    expect(out).toContain('## 트리거 키워드')
    expect(out).toContain('- foo')
    expect(out).toContain('- bar')
  })

  it('mcpTools 가 있으면 본문 섹션에 코드 백틱 포함', () => {
    const out = assembleSkillContent({
      name: 'with-tools',
      description: 'desc',
      mcpTools: ['read', 'browse'],
      triggers: []
    })
    expect(out).toContain('## 사용 MCP Tools')
    expect(out).toContain('- `read`')
    expect(out).toContain('- `browse`')
  })

  it('body 가 있으면 # heading 다음에 포함', () => {
    const out = assembleSkillContent({
      name: 'has-body',
      description: 'desc',
      body: 'custom body content here',
      mcpTools: [],
      triggers: []
    })
    expect(out).toMatch(/# has-body\n\ncustom body content here/)
  })

  it('공백만 있는 항목은 자동 제거', () => {
    const out = assembleSkillContent({
      name: 'trim',
      description: 'desc',
      mcpTools: ['  ', 'real-tool', ''],
      triggers: ['', '  ', 'foo']
    })
    expect(out).toContain('- `real-tool`')
    expect(out).not.toContain('-  \n')
    expect(out).toContain('- foo')
  })
})
