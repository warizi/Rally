import { History, Sparkles, Wrench, Bug } from 'lucide-react'
import { TabContainer } from '@shared/ui/tab-container'
import TabHeader from '@shared/ui/tab-header'
import { Badge } from '@shared/ui/badge'
import { CHANGELOG, type ChangelogEntry } from '@shared/constants/changelog'

const TYPE_CONFIG = {
  feature: { label: '새 기능', icon: Sparkles, variant: 'default' as const },
  improvement: { label: '개선', icon: Wrench, variant: 'secondary' as const },
  fix: { label: '수정', icon: Bug, variant: 'outline' as const }
}

function VersionCard({ entry }: { entry: ChangelogEntry }): React.JSX.Element {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center gap-3">
        <h3 className="text-lg font-semibold">v{entry.version}</h3>
        <span className="text-sm text-muted-foreground">{entry.date}</span>
      </div>
      <ul className="space-y-3">
        {entry.changes.map((change, i) => {
          const config = TYPE_CONFIG[change.type]
          const Icon = config.icon
          return (
            <li key={i} className="space-y-1">
              <div className="flex items-start gap-2">
                <Badge variant={config.variant} className="shrink-0 gap-1 text-xs">
                  <Icon className="size-3" />
                  {config.label}
                </Badge>
                <span className="text-sm font-medium">{change.title}</span>
              </div>
              {change.description && (
                <p className="text-xs text-muted-foreground ml-[70px]">{change.description}</p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function ChangelogPage(): React.JSX.Element {
  return (
    <TabContainer
      header={
        <TabHeader
          title="업데이트 내역"
          description="Rally의 새로운 기능과 변경 사항을 확인하세요."
          icon={History}
        />
      }
    >
      <div className="space-y-4 py-4">
        {CHANGELOG.map((entry) => (
          <VersionCard key={entry.version} entry={entry} />
        ))}
      </div>
    </TabContainer>
  )
}
