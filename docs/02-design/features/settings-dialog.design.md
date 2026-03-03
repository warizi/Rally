# Settings Dialog Design Document

> **Summary**: 사이드바 "기타" → "시스템" 그룹 변경, 설정 다이얼로그 추가, 다크모드 스켈레톤 선택 UI 구현, DB 저장
>
> **Date**: 2026-03-03
> **Status**: Draft
> **Planning Doc**: [settings-dialog.plan.md](../../01-plan/features/settings-dialog.plan.md)

---

## 1. Overview

### 1.1 Design Goals

- 사이드바 "기타" 그룹을 "시스템"으로 변경하고 "설정" 메뉴 항목 추가
- 설정 다이얼로그: 좌측 탭 + 우측 컨텐츠 레이아웃, 블러 백드롭
- 디스플레이 탭에 다크모드 스켈레톤 선택 UI
- 테마 변경 즉시 적용 + DB 영속화
- Sonner(toast) 테마 자동 동기화

### 1.2 Design Principles

- 기존 인프라 최대 활용 — `app_settings` 테이블, IPC, preload bridge 전부 이미 존재
- `.dark` 클래스 토글 — CSS 변수 기반 테마 전환 (`global.css`에 이미 정의됨)
- `next-themes` 미사용 — 직접 DOM 조작으로 단순화

---

## 2. Architecture

### 2.1 Data Flow

```
[테마 변경]
  User → 스켈레톤 카드 클릭 → applyTheme() (DOM .dark 토글) → settings:set IPC → DB 저장

[테마 초기화]
  App 마운트 → ThemeInitializer → settings:get IPC → DB 읽기 → applyTheme()

[Sonner 동기화]
  applyTheme() → <html> class 변경 → MutationObserver → useSyncExternalStore → Sonner 리렌더
```

### 2.2 Layer Map

```
┌─ Main Process (변경 없음) ─────────────────────────────────────┐
│  db/schema/app-settings.ts         (기존, key-value)            │
│  repositories/app-settings.ts      (기존, get/set)              │
│  ipc/app-settings.ts               (기존, settings:get/set)     │
├─ Preload (변경 없음) ──────────────────────────────────────────┤
│  index.ts                          (기존, settings bridge)      │
│  index.d.ts                        (기존, SettingsAPI 타입)     │
├─ Renderer ─────────────────────────────────────────────────────┤
│  shared/lib/theme.ts               (신규) Theme 타입 + applyTheme │
│  shared/ui/sonner.tsx              (수정) next-themes → useSyncExternalStore │
│  app/providers/theme-initializer.tsx (신규) 앱 시작 시 테마 로드   │
│  app/App.tsx                       (수정) ThemeInitializer 등록  │
│  features/settings/manage-settings/ (신규) 설정 다이얼로그       │
│  app/layout/MainSidebar.tsx        (수정) 시스템 그룹 + 설정 항목 │
└────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Design

### 3.1 SettingsDialog

**파일**: `src/renderer/src/features/settings/manage-settings/ui/SettingsDialog.tsx`

```typescript
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
import { DisplaySettings } from './DisplaySettings'

type SettingsTab = 'general' | 'display'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'general', label: '기본' },
  { id: 'display', label: '디스플레이' }
]

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('display')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/30 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className={cn(
            'bg-background fixed top-[50%] left-[50%] z-50',
            'translate-x-[-50%] translate-y-[-50%]',
            'w-full max-w-2xl h-[480px]',
            'rounded-lg border shadow-lg outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'duration-200'
          )}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <DialogTitle className="text-lg font-semibold">설정</DialogTitle>
            <DialogDescription className="sr-only">앱 설정을 변경합니다</DialogDescription>
            <DialogPrimitive.Close className="rounded-xs opacity-70 hover:opacity-100">
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          {/* 본문: 좌측 탭 + 우측 컨텐츠 */}
          <div className="flex h-[calc(100%-57px)]">
            {/* 좌측 탭 */}
            <nav className="w-44 border-r p-3 space-y-1">
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
            <div className="flex-1 p-6 overflow-y-auto">
              {activeTab === 'general' && (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  추후 구현 예정
                </div>
              )}
              {activeTab === 'display' && <DisplaySettings />}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
```

**핵심 설계 결정**:

- `DialogContent` 미사용: 내부에서 `<DialogOverlay />`를 props 없이 렌더하므로, 블러 백드롭을 위해 `DialogPortal` + `DialogOverlay` + `DialogPrimitive.Content` 직접 조합
- `DialogOverlay`의 `cn()` 함수가 className을 머지하므로, `bg-black/30`이 기본 `bg-black/50`을 오버라이드
- `max-w-2xl` (672px) + `h-[480px]` 고정 크기
- 헤더 높이 57px (py-4 + border-b), 본문 `h-[calc(100%-57px)]`
- `DialogDescription`은 접근성을 위해 `sr-only`로 숨김 (Radix UI가 aria-describedby 경고 방지)
- 기본 활성 탭: `'display'` (현재 유일한 기능이므로)

---

### 3.2 DisplaySettings

**파일**: `src/renderer/src/features/settings/manage-settings/ui/DisplaySettings.tsx`

```typescript
import { useEffect, useState } from 'react'
import { CheckIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { applyTheme, type Theme } from '@/shared/lib/theme'

export function DisplaySettings() {
  const [currentTheme, setCurrentTheme] = useState<Theme>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  )

  const handleThemeChange = async (theme: Theme) => {
    setCurrentTheme(theme)
    applyTheme(theme)
    await window.api.settings.set('theme', theme)
  }

  return (
    <div>
      <h3 className="text-sm font-medium mb-4">테마</h3>
      <div className="flex gap-4">
        <ThemeCard
          label="라이트"
          theme="light"
          selected={currentTheme === 'light'}
          onClick={() => handleThemeChange('light')}
        />
        <ThemeCard
          label="다크"
          theme="dark"
          selected={currentTheme === 'dark'}
          onClick={() => handleThemeChange('dark')}
        />
      </div>
    </div>
  )
}

function ThemeCard({
  label,
  theme,
  selected,
  onClick
}: {
  label: string
  theme: Theme
  selected: boolean
  onClick: () => void
}) {
  const isDark = theme === 'dark'

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-center gap-2 p-2 rounded-lg border-2 transition-all',
        'cursor-pointer hover:border-primary/50',
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-border'
      )}
    >
      {/* 스켈레톤 미리보기 */}
      <div
        className={cn(
          'w-32 h-24 rounded-md overflow-hidden border',
          isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-200'
        )}
      >
        {/* 헤더 바 */}
        <div
          className={cn('h-3', isDark ? 'bg-zinc-800' : 'bg-zinc-100')}
        />
        <div className="flex h-[calc(100%-12px)]">
          {/* 사이드바 */}
          <div
            className={cn('w-6', isDark ? 'bg-zinc-800' : 'bg-zinc-50')}
          />
          {/* 컨텐츠 영역 */}
          <div className="flex-1 p-2 space-y-1.5">
            <div
              className={cn(
                'h-1.5 w-full rounded-full',
                isDark ? 'bg-zinc-700' : 'bg-zinc-200'
              )}
            />
            <div
              className={cn(
                'h-1.5 w-3/4 rounded-full',
                isDark ? 'bg-zinc-700' : 'bg-zinc-200'
              )}
            />
            <div
              className={cn(
                'h-1.5 w-5/6 rounded-full',
                isDark ? 'bg-zinc-700' : 'bg-zinc-200'
              )}
            />
          </div>
        </div>
      </div>

      {/* 레이블 + 체크 표시 */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium">{label}</span>
        {selected && <CheckIcon className="size-3 text-primary" />}
      </div>
    </button>
  )
}
```

**스켈레톤 UI 구조**:

```
┌────────────────────────┐
│ ████████████████████ h3 │  ← 헤더 바 (h-3)
├────┬───────────────────┤
│ ██ │ ████████████ h1.5  │  ← 사이드바(w-6) + 컨텐츠 라인
│ ██ │ █████████   h1.5   │
│ ██ │ ██████████  h1.5   │
│ w6 │                    │
└────┴───────────────────┘
      w-32 × h-24
```

- 카드 전체 크기: `w-32`(128px) × `h-24`(96px) 스켈레톤 + 레이블
- 라이트: `bg-white` 배경 + `bg-zinc-200` 스켈레톤 바
- 다크: `bg-zinc-900` 배경 + `bg-zinc-700` 스켈레톤 바
- 선택 시: `border-primary ring-2 ring-primary/20` + CheckIcon 표시

---

### 3.3 Theme Utility

**파일**: `src/renderer/src/shared/lib/theme.ts`

```typescript
export type Theme = 'light' | 'dark'

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}
```

---

### 3.4 ThemeInitializer

**파일**: `src/renderer/src/app/providers/theme-initializer.tsx`

```typescript
import { useEffect } from 'react'
import { applyTheme, type Theme } from '@shared/lib/theme'

export function ThemeInitializer(): null {
  useEffect(() => {
    window.api.settings.get('theme').then((res) => {
      if (res.success && res.data) {
        applyTheme(res.data as Theme)
      }
    })
  }, [])

  return null
}
```

**App.tsx 등록 위치**:

```tsx
// src/renderer/src/app/App.tsx (변경 후)
import { ThemeInitializer } from './providers/theme-initializer'

function App(): React.JSX.Element {
  return (
    <QueryClientProviderWrapper>
      <TooltipProvider>
        <WorkspaceInitializer />
        <ThemeInitializer />
        <RouterProvider router={DefaultRouter} />
        <Toaster />
      </TooltipProvider>
    </QueryClientProviderWrapper>
  )
}
```

> `WorkspaceInitializer`와 동일한 null-returning 컴포넌트 패턴. `RouterProvider` 이전에 실행되어 FOUC 최소화.

---

### 3.5 Sonner 테마 연동 수정

**파일**: `src/renderer/src/shared/ui/sonner.tsx`

```typescript
// 변경 후 전체 코드
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon
} from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

function getThemeSnapshot(): 'light' | 'dark' {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function subscribeTheme(callback: () => void): () => void {
  const observer = new MutationObserver(callback)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  })
  return () => observer.disconnect()
}

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot)

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)'
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster, ToasterProps }
```

**변경 포인트**:
- `'use client'` 디렉티브 제거 (Electron 앱, 불필요)
- `import { useTheme } from 'next-themes'` → `import { useSyncExternalStore } from 'react'`
- `const { theme = 'system' } = useTheme()` → `const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot)`
- `MutationObserver`로 `<html>` class 변경 감지 → Sonner 자동 리렌더
- 기존 icons, style 구성은 동일 유지

---

### 3.6 MainSidebar 수정

**파일**: `src/renderer/src/app/layout/MainSidebar.tsx`

```typescript
// 변경 후 전체 코드
import { useState } from 'react'
import { Settings } from 'lucide-react'
import { useTabStore, applySessionToStore } from '@/features/tap-system/manage-tab-system'
import type { SerializedTab, SessionData } from '@/features/tap-system/manage-tab-system'
import { useUpdateTabSnapshot } from '@/entities/tab-snapshot'
import type { TabSnapshot } from '@/entities/tab-snapshot'
import { TabSnapshotSection } from '@/features/tab-snapshot/manage-tab-snapshot'
import { WorkspaceSwitcher } from '@/features/workspace/switch-workspace'
import { SettingsDialog } from '@/features/settings/manage-settings'
import { sidebar_items, SidebarItem } from '@/shared/constants/tab-url'
import { useCurrentWorkspaceStore } from '@/shared/store/current-workspace'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/shared/ui/sidebar'

function MainSidebar(): React.JSX.Element {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const openTab = useTabStore((state) => state.openTab)
  const { mutate: updateSnapshot } = useUpdateTabSnapshot()
  const tabs = useTabStore((state) => state.tabs)
  const panes = useTabStore((state) => state.panes)
  const activePaneId = useTabStore((state) => state.activePaneId)
  const currentWorkspaceId = useCurrentWorkspaceStore((state) => state.currentWorkspaceId)

  const activePane = panes[activePaneId]
  const activeTab = activePane?.activeTabId ? tabs[activePane.activeTabId] : null
  const activePathname = activeTab?.pathname

  const handleOpenStaticTab = (item: SidebarItem): void => {
    openTab({ type: item.tabType, pathname: item.pathname, title: item.title })
  }

  const handleOverwrite = (snapshot: TabSnapshot): void => {
    const { tabs, panes, layout } = useTabStore.getState()
    updateSnapshot({
      id: snapshot.id,
      tabsJson: JSON.stringify(tabs),
      panesJson: JSON.stringify(panes),
      layoutJson: JSON.stringify(layout)
    })
  }

  const handleRestore = (snapshot: TabSnapshot): void => {
    const panes = JSON.parse(snapshot.panesJson) as SessionData['panes']
    const sessionData: SessionData = {
      tabs: JSON.parse(snapshot.tabsJson) as Record<string, SerializedTab>,
      panes,
      layout: JSON.parse(snapshot.layoutJson) as SessionData['layout'],
      activePaneId: Object.keys(panes)[0] ?? ''
    }
    applySessionToStore(sessionData)
  }

  return (
    <>
      <Sidebar collapsible="icon" className="mt-9">
        <SidebarHeader>
          <WorkspaceSwitcher />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>기능</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {sidebar_items.map((item) => (
                  <SidebarMenuItem key={item.pathname}>
                    <SidebarMenuButton
                      className="cursor-pointer"
                      isActive={activePathname === item.pathname}
                      tooltip={item.title}
                      onClick={() => handleOpenStaticTab(item)}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {currentWorkspaceId && (
            <TabSnapshotSection
              workspaceId={currentWorkspaceId}
              onRestoreSnapshot={handleRestore}
              onOverwriteSnapshot={handleOverwrite}
            />
          )}
          <SidebarGroup>
            <SidebarGroupLabel>시스템</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="cursor-pointer"
                    tooltip="설정"
                    onClick={() => setSettingsOpen(true)}
                  >
                    <Settings />
                    <span>설정</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  )
}

export default MainSidebar
```

**변경 포인트**:
- `useState(false)` 추가 — `settingsOpen` 상태
- `Settings` 아이콘 import (lucide-react)
- `SettingsDialog` import (features/settings/manage-settings)
- "기타" → "시스템" 레이블 변경
- 설정 `SidebarMenuItem` 추가 (tooltip="설정")
- `<Sidebar>` + `<SettingsDialog>`를 `<>...</>`로 감싸기 (Fragment)

---

## 4. Barrel Exports

### 4.1 features/settings/manage-settings/index.ts

```typescript
export { SettingsDialog } from './ui/SettingsDialog'
```

### 4.2 features/settings/index.ts

```typescript
export { SettingsDialog } from './manage-settings'
```

---

## 5. Implementation Order

| 순서 | 파일 | 작업 | 의존 |
|------|------|------|------|
| 1 | `shared/lib/theme.ts` | 신규: Theme 타입 + applyTheme | 없음 |
| 2 | `shared/ui/sonner.tsx` | 수정: next-themes → useSyncExternalStore | theme.ts (간접) |
| 3 | `features/settings/manage-settings/ui/DisplaySettings.tsx` | 신규: 다크모드 스켈레톤 UI | theme.ts |
| 4 | `features/settings/manage-settings/ui/SettingsDialog.tsx` | 신규: 설정 다이얼로그 | DisplaySettings |
| 5 | `features/settings/manage-settings/index.ts` | 신규: barrel export | SettingsDialog |
| 6 | `features/settings/index.ts` | 신규: barrel export | manage-settings |
| 7 | `app/layout/MainSidebar.tsx` | 수정: 시스템 그룹 + 설정 항목 | SettingsDialog |
| 8 | `app/providers/theme-initializer.tsx` | 신규: 테마 초기화 | theme.ts |
| 9 | `app/App.tsx` | 수정: ThemeInitializer 등록 | theme-initializer |

총 **9개 파일** (신규 6, 수정 3)

---

## 6. File Summary

### 신규 파일

| 파일 | FSD 레이어 | 설명 |
|------|-----------|------|
| `src/renderer/src/shared/lib/theme.ts` | shared | Theme 타입 + applyTheme 함수 |
| `src/renderer/src/features/settings/manage-settings/ui/SettingsDialog.tsx` | features | 설정 다이얼로그 (블러 백드롭, 탭 레이아웃) |
| `src/renderer/src/features/settings/manage-settings/ui/DisplaySettings.tsx` | features | 디스플레이 설정 (다크모드 스켈레톤 카드) |
| `src/renderer/src/features/settings/manage-settings/index.ts` | features | barrel export |
| `src/renderer/src/features/settings/index.ts` | features | barrel export |
| `src/renderer/src/app/providers/theme-initializer.tsx` | app | 앱 시작 시 DB → DOM 테마 초기화 |

### 수정 파일

| 파일 | 변경 요약 |
|------|----------|
| `src/renderer/src/shared/ui/sonner.tsx` | `useTheme()` → `useSyncExternalStore` + MutationObserver |
| `src/renderer/src/app/layout/MainSidebar.tsx` | "기타"→"시스템", 설정 메뉴, SettingsDialog, Fragment |
| `src/renderer/src/app/App.tsx` | ThemeInitializer 컴포넌트 추가 |

---

## 7. Edge Cases & Notes

- **FOUC**: `ThemeInitializer`가 `useEffect`에서 비동기로 DB를 읽으므로, 앱 시작 시 라이트 모드가 잠깐 표시될 수 있음. Electron 앱 특성상 로딩이 빠르고 splash 화면으로 가려지므로 실질적 문제 없음
- **DB에 theme 키 없는 경우**: `res.data`가 `null`이면 `applyTheme` 미호출 → 기본 라이트 모드 유지 (`:root` CSS)
- **다이얼로그 열릴 때 현재 테마 감지**: `DisplaySettings`에서 `document.documentElement.classList.contains('dark')`로 초기값 설정
- **`bg-black/30` 오버라이드**: Tailwind CSS v4의 `cn()` (clsx + twMerge)이 `bg-black/50`을 `bg-black/30`으로 정상 오버라이드
- **MutationObserver 정리**: `useSyncExternalStore`의 subscribe 함수가 cleanup을 반환하므로 컴포넌트 언마운트 시 observer 자동 disconnect
- **Radix DialogDescription 경고**: `DialogDescription`이 없으면 Radix가 콘솔 경고를 출력하므로, `sr-only`로 숨김 처리하여 접근성 유지
