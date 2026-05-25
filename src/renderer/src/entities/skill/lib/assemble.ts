/**
 * 사용자가 입력한 구조화된 정보 (이름 / 설명 / 트리거 / MCP 툴 / 본문) 를
 * Claude 가 읽기 좋은 SKILL.md 형식 (YAML frontmatter + 본문) 으로 어셈블한다.
 *
 * - LLM 호출 없이 결정적으로 변환.
 * - description 은 YAML block (`|`) 형식으로 라인 보존.
 * - triggers 가 있으면 description 끝에 자연어 문장으로 부착해 자동 트리거 강화.
 * - mcpTools 와 triggers 는 본문 섹션에도 목록으로 추가.
 */
export interface AssembleSkillInput {
  name: string
  description: string
  body?: string
  mcpTools: string[]
  triggers: string[]
}

export function assembleSkillContent(input: AssembleSkillInput): string {
  const name = input.name.trim()
  const description = input.description.trim()
  const body = input.body?.trim() ?? ''
  const mcpTools = input.mcpTools.map((t) => t.trim()).filter(Boolean)
  const triggers = input.triggers.map((t) => t.trim()).filter(Boolean)

  const descriptionWithTriggers = triggers.length
    ? `${description}\n\nTriggers: ${triggers.join(', ')}.`
    : description

  const indentedDescription = descriptionWithTriggers
    .split('\n')
    .map((line) => (line ? `  ${line}` : ''))
    .join('\n')

  const frontmatter = `---\nname: ${name}\ndescription: |\n${indentedDescription}\n---`

  const sections: string[] = [frontmatter, '', `# ${name}`]

  if (body) {
    sections.push('', body)
  }

  if (mcpTools.length > 0) {
    sections.push('', '## 사용 MCP Tools', '', ...mcpTools.map((t) => `- \`${t}\``))
  }

  if (triggers.length > 0) {
    sections.push('', '## 트리거 키워드', '', ...triggers.map((t) => `- ${t}`))
  }

  return sections.join('\n') + '\n'
}
