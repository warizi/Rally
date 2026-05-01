import { useState } from 'react'
import { XIcon } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import {
  Dialog,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogDescription
} from '@/shared/ui/dialog'
import { cn } from '@/shared/lib/utils'
import { GeneralSettings } from './GeneralSettings'
import { DisplaySettings } from './DisplaySettings'
import { AISettings } from './AISettings'
import { TrashSettings } from './TrashSettings'

type SettingsTab = 'general' | 'display' | 'trash' | 'ai'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'general', label: '기본' },
  { id: 'display', label: '디스플레이' },
  { id: 'trash', label: '휴지통' },
  { id: 'ai', label: 'AI (Claude)' }
]

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/30 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className={cn(
            'bg-background fixed top-[50%] left-[50%] z-50',
            'translate-x-[-50%] translate-y-[-50%]',
            'w-full max-w-3xl h-[480px]',
            'flex flex-col',
            'rounded-lg border shadow-lg outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'duration-200'
          )}
        >
          {/* 헤더 */}
          <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b">
            <DialogTitle className="text-lg font-semibold">설정</DialogTitle>
            <DialogDescription className="sr-only">앱 설정을 변경합니다</DialogDescription>
            <DialogPrimitive.Close className="rounded-xs opacity-70 hover:opacity-100 transition-opacity">
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          {/* 본문: 좌측 탭 + 우측 컨텐츠 */}
          <div className="flex flex-1 min-h-0">
            {/* 좌측 탭 */}
            <nav className="w-44 border-r p-3 space-y-1 shrink-0">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-md text-sm',
                    'transition-colors',
                    activeTab === tab.id
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            {/* 우측 컨텐츠 */}
            <div className="flex-1 min-w-0 p-6 overflow-y-auto">
              {activeTab === 'general' && <GeneralSettings />}
              {activeTab === 'display' && <DisplaySettings />}
              {activeTab === 'trash' && <TrashSettings />}
              {activeTab === 'ai' && <AISettings />}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
