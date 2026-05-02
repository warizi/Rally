import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@shared/ui/dialog'
import { Button } from '@shared/ui/button'
import { useOnboardingStore } from '@shared/store/onboarding'
import { useWorkspaceIsEmpty } from '@shared/hooks/use-workspace-is-empty'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { WelcomeSlide } from './WelcomeSlides'

const SLIDE_COUNT = 3

interface Props {
  /** Optional: triggers sample workspace creation. WelcomeModal handles dismiss internally. */
  onCreateSample?: () => Promise<void>
}

export function WelcomeModal({ onCreateSample }: Props): React.JSX.Element | null {
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId)
  const hydrated = useOnboardingStore((s) => s.hydrated)
  const welcomeDismissed = useOnboardingStore((s) => s.welcomeDismissed)
  const dismissWelcome = useOnboardingStore((s) => s.dismissWelcome)
  const { isEmpty, isLoading: isLoadingEmptiness } = useWorkspaceIsEmpty(workspaceId)

  const [open, setOpen] = useState(false)
  const [slide, setSlide] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!hydrated || isLoadingEmptiness) return
    if (welcomeDismissed) return
    if (!workspaceId) return
    if (!isEmpty) return
    setOpen(true)
  }, [hydrated, welcomeDismissed, workspaceId, isEmpty, isLoadingEmptiness])

  const handleClose = useCallback(async (): Promise<void> => {
    setOpen(false)
    await dismissWelcome()
  }, [dismissWelcome])

  const handleSample = useCallback(async (): Promise<void> => {
    if (!onCreateSample) {
      await handleClose()
      return
    }
    try {
      setBusy(true)
      await onCreateSample()
      setOpen(false)
      await dismissWelcome()
    } finally {
      setBusy(false)
    }
  }, [onCreateSample, dismissWelcome, handleClose])

  const isLast = slide === SLIDE_COUNT - 1

  function next(): void {
    if (slide < SLIDE_COUNT - 1) setSlide(slide + 1)
  }

  function prev(): void {
    if (slide > 0) setSlide(slide - 1)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          handleClose().catch(console.error)
        }
      }}
    >
      <DialogContent className="sm:max-w-xl" showCloseButton={!busy}>
        <DialogTitle className="sr-only">Rally 환영 화면</DialogTitle>
        <div className="flex min-h-[320px] flex-col gap-6">
          <div className="flex-1 py-4">
            <WelcomeSlide index={slide} />
          </div>

          <div className="flex items-center justify-center gap-1.5">
            {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === slide ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={prev}
              disabled={slide === 0 || busy}
              className="gap-1"
            >
              <ChevronLeft className="size-4" />
              이전
            </Button>

            {isLast ? (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleClose} disabled={busy}>
                  빈 워크스페이스로 시작
                </Button>
                <Button size="sm" onClick={handleSample} disabled={busy || !onCreateSample}>
                  {busy && <Loader2 className="size-3 animate-spin" />}
                  샘플 워크스페이스 만들기
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={next} className="gap-1">
                다음
                <ChevronRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
