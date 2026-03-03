# Plan: 설정 다이얼로그 (다크모드)

> 작성일: 2026-03-03
> 기능: settings-dialog
> 레벨: Dynamic

---

## 1. 배경 및 목적

Rally 앱에 설정 다이얼로그를 추가한다. 사이드바의 "기타" 그룹을 "시스템"으로 변경하고, "설정" 메뉴 항목을 추가한다. 설정 다이얼로그는 좌측 탭 + 우측 컨텐츠 레이아웃이며, 첫 번째 기능으로 다크모드 전환을 구현한다. 테마 설정은 DB(`app_settings` 테이블)에 저장한다.

---

## 2. 기술 선택

| 항목 | 선택 | 사유 |
|------|------|------|
| 테마 관리 | `<html>` 태그 `.dark` 클래스 토글 | 이미 `global.css`에 `.dark` 셀렉터 정의됨 |
| 저장소 | `app_settings` 테이블 (key-value) | 이미 존재하는 테이블, IPC 핸들러도 구현 완료 |
| 다이얼로그 | Radix UI `Dialog` (shadcn/ui) | 이미 `shared/ui/dialog.tsx`에 존재 |
| 백드롭 | `backdrop-blur` CSS | DialogOverlay 커스터마이즈 |

---

## 3. 현재 인프라 상태

이미 구현되어 있는 것:
- `app_settings` 테이블 (key-value 구조) — `src/main/db/schema/app-settings.ts`
- `appSettingsRepository.get(key)` / `.set(key, value)` — `src/main/repositories/app-settings.ts`
- `settings:get` / `settings:set` IPC 핸들러 — `src/main/ipc/app-settings.ts`
- `window.api.settings.get(key)` / `.set(key, value)` preload bridge
- `global.css`의 `:root` (라이트) / `.dark` (다크) CSS 변수 정의
- shadcn/ui `Dialog` 컴포넌트
- `next-themes` 패키지 설치됨 (미사용 상태)

새로 구현해야 하는 것:
- 사이드바 "기타" → "시스템" 이름 변경 + "설정" 메뉴 항목
- 설정 다이얼로그 UI (탭 레이아웃)
- 다크모드 스켈레톤 선택 UI
- Sonner(toast) 테마 연동 수정
- 테마 초기화 로직 (앱 시작 시 DB에서 읽어서 적용)

---

## 4. 구현 범위

### Phase A: 사이드바 수정

#### A-1. MainSidebar — 그룹 이름 변경 + 설정 항목 추가

**파일**: `src/renderer/src/app/layout/MainSidebar.tsx`

```tsx
// "기타" → "시스템"
<SidebarGroupLabel>시스템</SidebarGroupLabel>

// 설정 메뉴 항목 추가
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
```

- `useState<boolean>`로 설정 다이얼로그 open 상태 관리
- `lucide-react`에서 `Settings` 아이콘 import
- `SettingsDialog` 컴포넌트를 하단에 렌더

---

### Phase B: 설정 다이얼로그

#### B-1. SettingsDialog 컴포넌트

**디렉토리**: `src/renderer/src/features/settings/manage-settings/`

```
ui/SettingsDialog.tsx    → 메인 다이얼로그 (탭 + 컨텐츠 레이아웃)
ui/DisplaySettings.tsx   → 디스플레이 탭 컨텐츠 (다크모드 스켈레톤 UI)
index.ts                 → barrel export
```

> FSD 컨벤션: 기존 features는 `manage-folder/`, `switch-workspace/` 등 동사 기반 하위 디렉토리를 사용하므로 `manage-settings/`로 통일

**SettingsDialog 레이아웃**:

```
┌─────────────────────────────────────────┐
│ 설정                              [X]   │
├──────────┬──────────────────────────────┤
│          │                              │
│ 기본     │   (컨텐츠 영역)              │
│          │                              │
│ 디스플레이│                              │
│          │                              │
│          │                              │
│          │                              │
└──────────┴──────────────────────────────┘
```

- 좌측: 탭 목록 (세로 배치, 버튼 형태)
- 우측: 선택된 탭의 컨텐츠
- `useState<'general' | 'display'>`로 활성 탭 관리

**백드롭 블러 구현**:

현재 `DialogContent`는 내부에서 `<DialogOverlay />`를 props 없이 직접 렌더하므로, className을 외부에서 전달할 수 없다. 따라서 설정 다이얼로그에서는 `DialogContent`를 사용하지 않고 `DialogPortal` + `DialogOverlay` + `DialogPrimitive.Content`를 직접 조합한다:

```tsx
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogPortal>
    <DialogOverlay className="bg-black/30 backdrop-blur-sm" />
    <DialogPrimitive.Content className="fixed top-[50%] left-[50%] ...">
      {/* 다이얼로그 내용 */}
    </DialogPrimitive.Content>
  </DialogPortal>
</Dialog>
```

> `DialogOverlay`의 `cn()` 함수는 className을 머지하므로, `bg-black/30`으로 기본 `bg-black/50`을 오버라이드하고 `backdrop-blur-sm`을 추가

**Props**:

```typescript
interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}
```

#### B-2. DisplaySettings — 다크모드 UI

**다크모드 스켈레톤 UI**:

```
┌──────────────────────────────────────┐
│ 테마                                 │
│                                      │
│ ┌─────────────┐  ┌─────────────┐     │
│ │ ┌──────┐    │  │ ┌──────┐    │     │
│ │ │▓▓▓▓▓▓│    │  │ │░░░░░░│    │     │
│ │ ├──────┤    │  │ ├──────┤    │     │
│ │ │▓▓▓   │    │  │ │░░░   │    │     │
│ │ │▓▓▓▓▓ │    │  │ │░░░░░ │    │     │
│ │ │▓▓▓   │    │  │ │░░░   │    │     │
│ │ └──────┘    │  │ └──────┘    │     │
│ │  라이트     │  │  다크       │     │
│ │    ✓        │  │             │     │
│ └─────────────┘  └─────────────┘     │
│                                      │
└──────────────────────────────────────┘
```

- 라이트/다크 2개 카드를 나란히 배치
- 각 카드 안에는 앱 UI를 축소 모사한 스켈레톤
  - 상단: 헤더 바 (사각형)
  - 좌측: 사이드바 (좁은 사각형)
  - 우측: 컨텐츠 영역 (줄 형태 스켈레톤 3개)
- 라이트 카드: 밝은 배경 + 어두운 스켈레톤 바
- 다크 카드: 어두운 배경 + 밝은 스켈레톤 바
- 선택된 카드에 `ring-2 ring-primary` 하이라이트 + 체크 표시
- 카드 클릭 시 즉시 테마 전환 + DB 저장

---

### Phase C: 테마 적용 로직

#### C-1. 테마 적용 함수

**파일**: `src/renderer/src/shared/lib/theme.ts`

```typescript
export type Theme = 'light' | 'dark'

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}
```

#### C-2. 테마 초기화 — ThemeInitializer 컴포넌트

**파일**: `src/renderer/src/app/providers/theme-initializer.tsx`

`WorkspaceInitializer`와 동일한 패턴으로, 앱 시작 시 DB에서 테마를 읽어 적용하는 null-returning 컴포넌트.

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

**App.tsx에 등록** (`WorkspaceInitializer` 옆):

```tsx
// src/renderer/src/app/App.tsx
<QueryClientProviderWrapper>
  <TooltipProvider>
    <WorkspaceInitializer />
    <ThemeInitializer />         {/* 추가 */}
    <RouterProvider router={DefaultRouter} />
    <Toaster />
  </TooltipProvider>
</QueryClientProviderWrapper>
```

> `MainLayout.tsx`가 아닌 `App.tsx`에 배치하는 이유: `MainLayout`은 `RouterProvider` 내부에서 렌더되므로 초기화가 늦어짐. `App.tsx`에 직접 배치해야 라우터 렌더 전에 테마가 적용되어 FOUC(Flash of Unstyled Content) 최소화

#### C-3. 테마 변경 시 즉시 적용 + DB 저장

```typescript
const handleThemeChange = async (theme: Theme) => {
  applyTheme(theme)
  await window.api.settings.set('theme', theme)
}
```

---

### Phase D: Sonner 테마 연동 수정

#### D-1. sonner.tsx 수정

**파일**: `src/renderer/src/shared/ui/sonner.tsx`

현재 `next-themes`의 `useTheme()`을 사용하지만 `ThemeProvider`가 없어서 항상 `'system'`을 반환한다. `.dark` 클래스 기반 테마 전환과 연동하도록 수정:

```tsx
// 변경 전
import { useTheme } from 'next-themes'
const { theme = 'system' } = useTheme()

// 변경 후 — next-themes 의존성 제거, DOM에서 직접 읽기
import { useSyncExternalStore } from 'react'

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
  // ...
}
```

> `useSyncExternalStore`로 `<html>` 태그의 class 변경을 감지하면, `applyTheme()`으로 `.dark` 클래스를 토글할 때 Sonner가 자동으로 테마를 업데이트한다. `next-themes` 의존성을 완전히 제거.

---

## 5. FSD 레이어 배치

| 파일 | FSD 레이어 | 사유 |
|------|-----------|------|
| `SettingsDialog.tsx` | features/settings/manage-settings | 사용자 인터랙션 (설정 변경) |
| `DisplaySettings.tsx` | features/settings/manage-settings | 디스플레이 설정 UI |
| `theme.ts` | shared/lib | 재사용 가능한 유틸리티 |
| `ThemeInitializer` | app/providers | 앱 전체 초기화 로직 (WorkspaceInitializer 패턴) |

---

## 6. 구현 순서

| 순서 | Phase | 파일 수 | 설명 |
|------|-------|---------|------|
| 1 | C-1 | 1 | 테마 유틸리티 (`shared/lib/theme.ts`) |
| 2 | D-1 | 1 | Sonner 테마 연동 수정 (`shared/ui/sonner.tsx`) |
| 3 | B-1~2 | 3 | 설정 다이얼로그 + 디스플레이 설정 UI |
| 4 | A-1 | 1 | 사이드바 수정 (시스템 그룹 + 설정 항목) |
| 5 | C-2 | 2 | ThemeInitializer + App.tsx 등록 |

총 **~8개 파일** (신규 ~4, 수정 ~4)

---

## 7. 수정 대상 기존 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/renderer/src/app/layout/MainSidebar.tsx` | "기타" → "시스템", 설정 메뉴 항목 추가, SettingsDialog 렌더 |
| `src/renderer/src/app/App.tsx` | `ThemeInitializer` 컴포넌트 등록 |
| `src/renderer/src/shared/ui/sonner.tsx` | `next-themes` → `useSyncExternalStore` 기반 테마 감지로 교체 |
| `src/renderer/src/features/settings/index.ts` | barrel export (features/settings 루트) |

---

## 8. 신규 파일

| 파일 | 설명 |
|------|------|
| `src/renderer/src/features/settings/manage-settings/ui/SettingsDialog.tsx` | 설정 다이얼로그 (탭 레이아웃, 블러 백드롭) |
| `src/renderer/src/features/settings/manage-settings/ui/DisplaySettings.tsx` | 디스플레이 설정 (다크모드 스켈레톤 UI) |
| `src/renderer/src/features/settings/manage-settings/index.ts` | barrel export |
| `src/renderer/src/features/settings/index.ts` | barrel export |
| `src/renderer/src/shared/lib/theme.ts` | 테마 유틸리티 (applyTheme, Theme 타입) |
| `src/renderer/src/app/providers/theme-initializer.tsx` | 앱 시작 시 테마 초기화 컴포넌트 |

---

## 9. DB 키

| key | value | 설명 |
|-----|-------|------|
| `theme` | `'light'` \| `'dark'` | 테마 설정 (기본값: `'light'`) |

기존 `app_settings` 테이블을 그대로 사용. 스키마 변경이나 마이그레이션 불필요.

---

## 10. 검증

```bash
npm run typecheck       # 타입 체크
npm run dev             # 수동 테스트
```

수동 검증 항목:

- [ ] 사이드바 "시스템" 그룹 표시
- [ ] "설정" 클릭 시 다이얼로그 열림
- [ ] 다이얼로그 백드롭 블러 효과
- [ ] 좌측 탭 (기본 / 디스플레이) 전환
- [ ] 기본 탭은 빈 컨텐츠 (나중 구현)
- [ ] 디스플레이 탭에 다크모드 스켈레톤 UI 표시
- [ ] 라이트 모드 스켈레톤 클릭 → 라이트 테마 적용
- [ ] 다크 모드 스켈레톤 클릭 → 다크 테마 적용
- [ ] 테마 변경 시 즉시 UI 반영
- [ ] 테마 설정이 DB에 저장됨
- [ ] 앱 재시작 후 저장된 테마 복원
- [ ] 사이드바 축소(icon) 모드에서 설정 tooltip 표시
- [ ] Sonner(toast) 테마가 앱 테마와 동기화
- [ ] 다크모드에서 다이얼로그 UI 정상 표시

---

## 11. 주의사항

- **DialogOverlay 블러**: `DialogContent`는 내부에서 `<DialogOverlay />`를 props 없이 렌더하므로, 블러 백드롭을 위해 `DialogContent` 대신 `DialogPortal` + `DialogOverlay` + `DialogPrimitive.Content`를 직접 조합. `DialogOverlay`의 `cn()` 함수가 className을 머지하므로 `bg-black/30 backdrop-blur-sm`으로 오버라이드 가능
- **Sonner 테마 충돌 해결**: `sonner.tsx`가 `next-themes`의 `useTheme()`을 사용하지만 `ThemeProvider`가 없음. `useSyncExternalStore`로 `<html>` class 변경을 감지하는 방식으로 교체하여 `.dark` 클래스 토글과 자동 연동
- **테마 초기화 위치**: `App.tsx`에 `ThemeInitializer` 컴포넌트를 `WorkspaceInitializer`와 나란히 배치. `MainLayout`(라우터 내부)이 아닌 `App.tsx`(라우터 외부)에 둬야 FOUC 최소화
- **FSD 디렉토리 컨벤션**: 기존 features는 `manage-folder/`, `switch-workspace/` 등 동사 기반 하위 디렉토리를 사용. `features/settings/manage-settings/`로 동일 패턴 적용
- **FSD 레이어 규칙**: `SettingsDialog`는 `features` 레이어에 배치. `app` 레이어의 `MainSidebar`에서 import하므로 FSD 규칙(상위 → 하위 import) 준수
- **CSS 변수 충돌 없음**: 라이트/다크 테마 CSS 변수가 이미 `global.css`에 완전히 정의되어 있으므로 추가 CSS 변경 불필요
