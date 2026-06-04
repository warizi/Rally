/**
 * Claude SKILL.md (YAML frontmatter + 마크다운 body) 를 Codex 커스텀 프롬프트
 * (~/.codex/prompts/<name>.md) 본문으로 변환한다.
 *
 * Codex 에는 Claude 의 자동 트리거 skill 시스템이 없다. 가장 가까운 건 커스텀 프롬프트로,
 * 파일 내용 전체가 `/name` 슬래시 커맨드의 프롬프트가 된다. Codex 는 frontmatter 를
 * 해석하지 않으므로 선행 YAML frontmatter 블록을 제거하고 본문만 남긴다.
 */

/** 선행 `--- ... ---` YAML frontmatter 블록을 제거. 없으면 원본 그대로. */
function stripFrontmatter(content: string): string {
  // 선행 BOM(U+FEFF) 제거 후 frontmatter fence 판별.
  const normalized = content.replace(/^\uFEFF/, '')
  const lines = normalized.split('\n')
  if (lines[0].trim() !== '---') return content
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      return lines.slice(i + 1).join('\n')
    }
  }
  // 닫는 fence 가 없으면 frontmatter 로 간주하지 않고 원본 유지.
  return content
}

export function toCodexPrompt(skillContent: string): string {
  return `${stripFrontmatter(skillContent).trim()}\n`
}
