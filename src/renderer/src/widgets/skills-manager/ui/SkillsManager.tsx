import { useState } from 'react'
import { PlusIcon } from 'lucide-react'
import { useSkillStatus, useSkills, type SkillItem, type SkillTarget } from '@entities/skill'
import { OnboardingTipIcon } from '@shared/ui/onboarding-tip'
import { Button } from '@shared/ui/button'
import {
  ApplyToggleButton,
  ExportSkillButton,
  RegisterSkillDialog,
  RemoveSkillButton,
  SkillDetailDialog
} from '@features/skill'
import { SkillCard } from './SkillCard'

interface Props {
  /** 적용 대상 클라이언트 (기본 claude) */
  target?: SkillTarget
}

export function SkillsManager({ target = 'claude' }: Props): React.JSX.Element {
  const skillsQuery = useSkills()
  const statusQuery = useSkillStatus()
  const [selected, setSelected] = useState<SkillItem | null>(null)
  const [registerOpen, setRegisterOpen] = useState(false)

  const skills = skillsQuery.data ?? []
  const status = statusQuery.data ?? []
  const appliedNames = new Set(status.filter((s) => s.applied[target]).map((s) => s.name))

  const systemSkills = skills.filter((s) => s.source === 'system')
  const customSkills = skills.filter((s) => s.source === 'custom')
  const appliedCount = skills.filter((s) => appliedNames.has(s.name)).length

  const isLoading = skillsQuery.isLoading || statusQuery.isLoading
  const error = skillsQuery.error || statusQuery.error

  return (
    <div className="space-y-2 border-t pt-4">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-sm font-medium">Skills 관리</h3>
        <OnboardingTipIcon
          tipId="skills_manage"
          title="Skills 관리"
          description="기본 skill 과 사용자가 등록한 커스텀 skill 을 한 곳에서 관리합니다. 원클릭으로 적용·해제할 수 있어요."
          side="right"
          align="start"
        />
      </div>
      {target === 'claude' ? (
        <p className="text-xs text-muted-foreground mb-3">
          <strong>적용</strong> 은{' '}
          <code className="bg-muted px-1 rounded">~/.claude/skills/&lt;name&gt;/SKILL.md</code> 에
          작성됩니다 — Claude Code 가 자동 인식합니다. Claude Desktop 은 filesystem skill 을
          지원하지 않으므로{' '}
          <strong>
            <code className="bg-muted px-1 rounded">.skill</code> 파일로 내보내기
          </strong>{' '}
          후 앱 Settings 에서 수동 업로드하세요.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground mb-3">
          <strong>적용</strong> 은{' '}
          <code className="bg-muted px-1 rounded">~/.agents/skills/&lt;name&gt;/SKILL.md</code> 에
          작성됩니다. Codex CLI 가 읽는 filesystem skill 형식이라 SKILL.md 원문이 그대로 적용됩니다.
        </p>
      )}

      {isLoading && (
        <div className="text-xs text-muted-foreground py-3">Skill 목록을 불러오는 중…</div>
      )}

      {error && (
        <div className="text-xs text-red-600 py-3">
          Skill 목록을 불러오지 못했습니다: {error.message}
        </div>
      )}

      {!isLoading && !error && (
        <div className="space-y-4">
          <div className="text-[11px] text-muted-foreground">
            전체 {skills.length}개 · 적용됨 {appliedCount}
          </div>

          {systemSkills.length > 0 && (
            <section className="space-y-1.5">
              <h4 className="text-xs font-medium text-muted-foreground">
                기본 ({systemSkills.length})
              </h4>
              <div className="space-y-1.5">
                {systemSkills.map((skill) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    applied={appliedNames.has(skill.name)}
                    onClick={() => setSelected(skill)}
                    actions={
                      <>
                        <ApplyToggleButton
                          skill={skill}
                          applied={appliedNames.has(skill.name)}
                          target={target}
                        />
                        <ExportSkillButton skill={skill} />
                        <RemoveSkillButton skill={skill} />
                      </>
                    }
                  />
                ))}
              </div>
            </section>
          )}

          <section className="space-y-1.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium text-muted-foreground">
                커스텀 ({customSkills.length})
              </h4>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 gap-1 text-xs"
                onClick={() => setRegisterOpen(true)}
              >
                <PlusIcon className="size-3" />
                등록
              </Button>
            </div>
            {customSkills.length === 0 ? (
              <div className="border border-dashed rounded-md px-3 py-4 text-xs text-muted-foreground text-center">
                등록된 커스텀 skill 이 없습니다.
              </div>
            ) : (
              <div className="space-y-1.5">
                {customSkills.map((skill) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    applied={appliedNames.has(skill.name)}
                    onClick={() => setSelected(skill)}
                    actions={
                      <>
                        <ApplyToggleButton
                          skill={skill}
                          applied={appliedNames.has(skill.name)}
                          target={target}
                        />
                        <ExportSkillButton skill={skill} />
                        <RemoveSkillButton skill={skill} />
                      </>
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <SkillDetailDialog
        skill={selected}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      />
      <RegisterSkillDialog open={registerOpen} onOpenChange={setRegisterOpen} />
    </div>
  )
}
