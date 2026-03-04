# Plan: 캘린더 일간 뷰 시간 설정

## 1. 개요

설정 다이얼로그의 디스플레이 탭에 "일정 > 일간 뷰 > 타임라인 시작/끝 시간" 설정을 추가한다.
현재 `START_HOUR = 6`으로 하드코딩되어 있는 일간 뷰 타임라인의 시작 시간을 사용자가 설정할 수 있도록 하고, 끝 시간도 지정 가능하게 한다.

## 2. 현재 상태 분석

### 하드코딩된 시간 상수
- `src/renderer/src/features/schedule/manage-schedule/model/calendar-constants.ts`
  - `START_HOUR = 6` (06:00 고정)
  - 끝 시간은 24시 고정 (`24 - START_HOUR`)

### 영향 범위
- `calendar-time.ts` → `getTimeSlots()`, `timeToPosition()` — `START_HOUR` 사용
- `TimeGrid.tsx` → `totalHeight`, 스크롤 위치 계산에 `START_HOUR` 사용
- `DayView.tsx` → `TimeGrid` 렌더링
- `CurrentTimeIndicator.tsx` — `START_HOUR` 기준 현재 시각 위치 계산

### 기존 설정 인프라
- **DB**: `app_settings` 테이블 (key-value 구조, 이미 존재)
- **Repository**: `appSettingsRepository.get(key) / set(key, value)` (이미 존재)
- **IPC**: `settings:get`, `settings:set` (이미 등록됨)
- **Preload**: `window.api.settings.get/set` (이미 노출됨)
- **설정 다이얼로그**: `SettingsDialog.tsx` — general/display 탭, `DisplaySettings.tsx` — 테마 설정만 존재

## 3. 요구사항

### 기능 요구사항
| ID | 내용 |
|----|------|
| FR-01 | 디스플레이 설정에 "일정" 섹션을 추가하고, 일간 뷰 타임라인 시작/끝 시간을 설정할 수 있다 |
| FR-02 | 시작 시간: 0~12시 범위, 기본값 6시 |
| FR-03 | 끝 시간: 12~24시 범위, 기본값 24시 |
| FR-04 | 시작 시간 < 끝 시간 검증 (최소 1시간 차이) |
| FR-05 | 설정 변경 시 즉시 일간 뷰에 반영 |
| FR-06 | 앱 재시작 후에도 설정 유지 (DB 저장) |

### 비기능 요구사항
| ID | 내용 |
|----|------|
| NFR-01 | 기존 app_settings key-value 인프라 재사용 |
| NFR-02 | 설정값이 없는 경우 기본값(6, 24) 사용 |

## 4. 기술 설계 방향

### 설정 키
- `schedule.dayView.startHour` → number (0~12, 기본값 6)
- `schedule.dayView.endHour` → number (12~24, 기본값 24)

### 변경 파일 목록

#### 1) 설정 UI (`DisplaySettings.tsx`)
- 테마 섹션 하단에 "일정" 섹션 추가
- "일간 뷰 타임라인" 소제목
- 시작 시간 / 끝 시간 Select 드롭다운 2개

#### 2) 캘린더 상수 → 설정값 연동
- `calendar-constants.ts`의 `START_HOUR` → 설정에서 읽어오는 방식으로 변경
- 끝 시간 상수 `END_HOUR` 추가
- React Query로 설정값 캐싱하거나, Zustand store에서 관리

#### 3) 타임라인 로직 수정
- `calendar-time.ts`: `getTimeSlots(startHour, endHour)`, `timeToPosition(date, hourHeight, startHour)` — 파라미터화
- `TimeGrid.tsx`: props로 `startHour`, `endHour` 받도록 수정
- `DayView.tsx`: 설정값을 읽어 `TimeGrid`에 전달
- `CurrentTimeIndicator.tsx`: `startHour` prop 추가

### 설정값 전달 방식
- `window.api.settings.get('schedule.dayView.startHour')` → React Query 쿼리로 캐싱
- 설정 변경 시 `invalidateQueries`로 즉시 반영

## 5. 구현 순서

1. 설정 React Query 훅 생성 (`useDayViewTimeSettings`)
2. `calendar-time.ts` 함수들 파라미터화 (startHour, endHour)
3. `TimeGrid.tsx`, `DayView.tsx`, `CurrentTimeIndicator.tsx` 수정
4. `DisplaySettings.tsx`에 일정 섹션 UI 추가
5. 통합 테스트 (설정 변경 → 타임라인 반영 확인)

## 6. 리스크

| 리스크 | 대응 |
|--------|------|
| START_HOUR를 import하는 곳이 많아 수정 범위가 넓음 | 단계적으로 파라미터화, 기본값 유지 |
| 설정값 로딩 전 렌더링 시 깜빡임 | 기본값 fallback + React Query initialData |
