import { CheckSquare, FileText, Network, Sheet, Sparkles, Workflow } from 'lucide-react'

interface SlideProps {
  index: number
}

export function WelcomeSlide({ index }: SlideProps): React.JSX.Element {
  if (index === 0) return <SlideValue />
  if (index === 1) return <SlideFeatures />
  return <SlideAi />
}

function SlideValue(): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-5 px-2 text-center">
      <div className="grid grid-cols-2 gap-3">
        <FeatureIcon icon={FileText} label="노트" />
        <FeatureIcon icon={Sheet} label="표" />
        <FeatureIcon icon={Network} label="캔버스" />
        <FeatureIcon icon={CheckSquare} label="할 일" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">
          Rally — 노트, 표, 캔버스, 할 일을 한 곳에서
        </h2>
        <p className="text-sm text-muted-foreground">
          데이터는 모두 내 컴퓨터에. 백업·복구·검색 모두 빠르게.
        </p>
      </div>
    </div>
  )
}

function SlideFeatures(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4 px-2">
      <h2 className="text-center text-lg font-semibold tracking-tight">핵심 기능 4가지</h2>
      <div className="grid grid-cols-2 gap-3">
        <FeatureCard
          icon={FileText}
          title="노트"
          description="마크다운으로 빠르게. 이미지·코드 블록 지원."
        />
        <FeatureCard icon={Sheet} title="표" description="가벼운 CSV 편집기. 정렬·검색 즉시." />
        <FeatureCard icon={Network} title="캔버스" description="아이디어를 노드와 선으로 연결." />
        <FeatureCard
          icon={CheckSquare}
          title="할 일"
          description="서브 할 일·반복·일정 연동까지."
        />
      </div>
    </div>
  )
}

function SlideAi(): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-5 px-2 text-center">
      <div className="rounded-xl bg-primary/10 p-4 text-primary">
        <Sparkles className="size-8" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">Claude와 함께 쓰면 더 강력합니다</h2>
        <p className="text-sm text-muted-foreground">
          설정 &gt; AI에서 1-click 등록 — 노트·할 일·캔버스를 AI가 자유롭게 다룹니다.
        </p>
      </div>
      <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Workflow className="mr-1.5 inline size-3" />
        Claude Desktop / Claude Code 모두 지원
      </div>
    </div>
  )
}

function FeatureIcon({
  icon: Icon,
  label
}: {
  icon: typeof FileText
  label: string
}): React.JSX.Element {
  return (
    <div className="flex h-20 w-24 flex-col items-center justify-center gap-1.5 rounded-lg bg-muted/40">
      <Icon className="size-6 text-foreground/80" />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function FeatureCard({
  icon: Icon,
  title,
  description
}: {
  icon: typeof FileText
  title: string
  description: string
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border bg-muted/20 p-3">
      <Icon className="size-4 text-foreground/80" />
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-muted-foreground leading-snug">{description}</div>
    </div>
  )
}
