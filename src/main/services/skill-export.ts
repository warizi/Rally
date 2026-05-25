import { dialog } from 'electron'
import { writeFileSync } from 'fs'
import AdmZip from 'adm-zip'
import { skillService } from './skill'

/**
 * Skill 을 `.skill` (ZIP) 형식으로 묶어 사용자가 선택한 경로에 저장한다.
 *
 * `.skill` 포맷 규약:
 *   <name>.skill   (ZIP)
 *   └─ <name>/
 *      └─ SKILL.md
 *
 * 이 파일은 Claude Desktop / Claude.ai 의 Settings > Skills > Upload 로
 * 수동 등록한다. Claude Code 는 filesystem (~/.claude/skills/) 자동 인식이라 불필요.
 */
function buildSkillZip(name: string, content: string): Buffer {
  const zip = new AdmZip()
  zip.addFile(`${name}/SKILL.md`, Buffer.from(content, 'utf-8'))
  return zip.toBuffer()
}

export interface SkillExportResult {
  /** 저장된 .skill 파일 절대 경로. */
  path: string
}

export const skillExportService = {
  /**
   * 사용자에게 저장 dialog 를 띄워 .skill 파일로 export.
   * 사용자가 취소하면 null 리턴.
   */
  async exportWithDialog(id: string): Promise<SkillExportResult | null> {
    const item = skillService.get(id)
    const result = await dialog.showSaveDialog({
      title: `${item.name}.skill 내보내기`,
      defaultPath: `${item.name}.skill`,
      filters: [{ name: 'Claude Skill', extensions: ['skill'] }]
    })
    if (result.canceled || !result.filePath) return null

    const buffer = buildSkillZip(item.name, item.content)
    writeFileSync(result.filePath, buffer)
    return { path: result.filePath }
  }
}
