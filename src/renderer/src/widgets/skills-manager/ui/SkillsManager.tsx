import { useState } from 'react'
import { PlusIcon } from 'lucide-react'
import { useSkillStatus, useSkills, type SkillItem } from '@entities/skill'
import { OnboardingTipIcon } from '@shared/ui/onboarding-tip'
import { Button } from '@shared/ui/button'
import {
  ApplyToggleButton,
  RegisterSkillDialog,
  RemoveSkillButton,
  SkillDetailDialog
} from '@features/skill'
import { SkillCard } from './SkillCard'

export function SkillsManager(): React.JSX.Element {
  const skillsQuery = useSkills()
  const statusQuery = useSkillStatus()
  const [selected, setSelected] = useState<SkillItem | null>(null)
  const [registerOpen, setRegisterOpen] = useState(false)

  const skills = skillsQuery.data ?? []
  const status = statusQuery.data ?? []
  const appliedNames = new Set(status.filter((s) => s.applied).map((s) => s.name))

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
          description="기본 skill 과 사용자가 등록한 커스텀 skill 을 한 곳에서 관리합니다. 원클릭으로 Claude Desktop / Code 에 적용·해제할 수 있어요."
          side="right"
          align="start"
        />
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Claude 에 적용할 skill 을 관리합니다. 적용된 skill 은{' '}
        <code className="bg-muted px-1 rounded">~/.claude/skills/&lt;name&gt;/SKILL.md</code> 로
        저장됩니다.
      </p>

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
                        <ApplyToggleButton skill={skill} applied={appliedNames.has(skill.name)} />
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
                        <ApplyToggleButton skill={skill} applied={appliedNames.has(skill.name)} />
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
