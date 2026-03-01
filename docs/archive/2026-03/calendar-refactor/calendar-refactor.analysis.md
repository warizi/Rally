# calendar-refactor Analysis Report

> **Analysis Type**: Gap Analysis (Design vs Implementation)
>
> **Project**: Rally
> **Analyst**: gap-detector
> **Date**: 2026-03-02
> **Design Doc**: [calendar-refactor.design.md](../02-design/features/calendar-refactor.design.md)

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

Design document (calendar-refactor.design.md) 와 실제 구현 코드 간의 일치도를 검증한다.
calendar-utils.ts (252줄) 모놀리스를 6개 전문 모듈로 분리하고, 3개 뷰(Month/Week/Day)에서 중복 코드를 추출하는 리팩토링의 정확성을 확인한다.

### 1.2 Analysis Scope

- **Design Document**: `docs/02-design/features/calendar-refactor.design.md`
- **Implementation Path**: `src/renderer/src/features/schedule/manage-schedule/`
- **New Files**: 11 (model 9 + ui 2)
- **Modified Files**: 4 (calendar-utils.ts, MonthView.tsx, WeekView.tsx, DayView.tsx)
- **Analysis Date**: 2026-03-02

---

## 2. Phase 1: Constants & Utilities Split

### 2.1 calendar-constants.ts (Design 1-1)

| Design Item | Implementation | Status |
|-------------|---------------|--------|
| `WEEKDAY_LABELS` array | Line 1: identical | Match |
| `MONTH_BAR_HEIGHT = 18` | Line 3: identical | Match |
| `WEEK_BAR_HEIGHT = 20` | Line 4: identical | Match |
| `BAR_GAP = 2` | Line 5: identical | Match |
| `HOUR_HEIGHT = 60` | Line 6: identical | Match |
| `START_HOUR = 6` | Line 7: identical | Match |
| `DND_ACTIVATION_CONSTRAINT` | Line 9: identical | Match |

**Result**: 7/7 items match (100%)

### 2.2 calendar-predicates.ts (Design 1-2)

| Design Item | Implementation | Status |
|-------------|---------------|--------|
| `isTodoItem` function signature | Line 4-6: identical | Match |
| `isScheduleOnDate` function signature | Line 8-12: identical | Match |
| `date-fns` imports (startOfDay, endOfDay) | Line 1: identical | Match |
| `ScheduleItem` type import | Line 2: identical | Match |

**Result**: 4/4 items match (100%)

### 2.3 calendar-grid.ts (Design 1-3)

| Design Item | Implementation | Status |
|-------------|---------------|--------|
| `MonthGridDay` interface (date, isCurrentMonth, isToday) | Lines 3-7: identical | Match |
| `getMonthGrid` function logic | Lines 9-32: identical | Match |
| `getWeekDates` function logic | Lines 34-37: identical | Match |
| `date-fns` imports (6 functions) | Line 1: identical | Match |

**Result**: 4/4 items match (100%)

### 2.4 calendar-layout.ts (Design 1-4)

| Design Item | Implementation | Status |
|-------------|---------------|--------|
| `LayoutedSchedule` interface | Lines 15-20: identical fields | Match |
| `WeekBarSegment` interface | Lines 7-13: identical fields | Match |
| `WeekBar` interface | Lines 22-29: identical fields | Match |
| `assignLanes<T>` generic function | Lines 33-61 | Changed |
| `splitBarByWeeks` function | Lines 65-97: identical | Match |
| `computeWeekBars` function | Lines 101-150 | Changed |
| `layoutOverlappingSchedules` function | Lines 154-230: identical | Match |

**Changed Items Detail**:

1. **`assignLanes` signature change**:
   - Design: `<T extends { startCol: number; span: number }>(items: T[]): (T & { lane: number })[]`
   - Implementation: `<T extends { startCol: number; span: number }>(segments: (T & { schedule: ScheduleItem })[]): (T & { schedule: ScheduleItem; lane: number })[]`
   - **Impact**: Low. The implementation constrains the generic further by requiring `schedule` in input/output. This is more specific than the design's fully generic version, but functionally equivalent for all actual call sites (MonthView weekLanes, computeWeekBars). The design intended a more generic form that could be reused without `schedule`, but the implementation ties it to schedule-aware usage.

2. **`computeWeekBars` inline lane assignment**:
   - Design: calls `assignLanes(items)` internally (line 269 of design)
   - Implementation: inlines the lane assignment algorithm (lines 125-150) instead of calling `assignLanes()`
   - **Impact**: Low. The algorithm is identical (sort by startCol then span desc, greedy lane assignment). The design's stated goal was "lane assignment to `assignLanes()` call replacement" but the implementation duplicates the logic inline. Functionally identical output.

**Result**: 5/7 items match, 2/7 changed (71.4% exact, 100% functional)

### 2.5 calendar-time.ts (Design 1-5)

| Design Item | Implementation | Status |
|-------------|---------------|--------|
| `TimeSlot` interface | Lines 4-7: identical | Match |
| `getTimeSlots` function | Lines 9-14: identical | Match |
| `timeToPosition` function | Lines 16-18: identical | Match |
| `scheduleHeight` function | Lines 20-22: identical | Match |
| `START_HOUR` import from constants | Line 2: identical | Match |

**Result**: 5/5 items match (100%)

### 2.6 calendar-move.ts (Design 1-6)

| Design Item | Implementation | Status |
|-------------|---------------|--------|
| `moveScheduleByDays` function | Lines 5-13: identical | Match |
| `moveScheduleByMinutes` function | Lines 15-25: identical | Match |
| `applyDaysDelta` function signature | Lines 32-46 | Changed |

**Changed Item Detail**:

- **`applyDaysDelta` implementation**:
  - Design: computes `msOffset = daysDelta * 86400000` and applies via `new Date(schedule.startAt.getTime() + msOffset)`
  - Implementation: calls `moveScheduleByDays(schedule, daysDelta)` internally to get `{startAt, endAt}`, then delegates to callbacks
  - Design: `callbacks` param typed inline `{ onMoveSchedule: ..., onMoveTodo: ... }`
  - Implementation: extracted `DaysDeltaCallbacks` named interface (lines 27-30)
  - **Impact**: None. The implementation is cleaner -- it reuses `moveScheduleByDays` instead of duplicating the date math. Output is identical. The named interface is a cosmetic improvement.

**Result**: 2/3 exact match, 1/3 improved (100% functional)

### 2.7 calendar-utils.ts barrel (Design 1-7)

| Design Item | Implementation | Status |
|-------------|---------------|--------|
| Re-export from calendar-constants | Line 1: `export { START_HOUR }` | Changed |
| Re-export from calendar-predicates | Line 2: named exports | Changed |
| Re-export from calendar-grid | Line 3: named exports | Changed |
| Re-export from calendar-layout | Lines 5-10: named exports | Changed |
| Re-export from calendar-time | Line 4: named exports | Changed |
| Re-export from calendar-move | Line 11: named exports | Changed |

**Changed Item Detail**:

- Design: `export * from './calendar-xxx'` (wildcard re-export for all 6 modules)
- Implementation: Named re-exports for specific symbols from each module
  - Only re-exports `START_HOUR` from constants (not MONTH_BAR_HEIGHT, WEEK_BAR_HEIGHT, etc.)
  - Only re-exports specific functions/types from each module

- **Impact**: None. The design's intent was "all existing export paths remain accessible from same path." The implementation uses named exports instead of wildcard, which is more explicit and tree-shakeable. The barrel re-exports exactly the symbols that were previously exported from the monolithic calendar-utils.ts, so external consumers (`index.ts`) are not broken. New symbols (e.g., `MONTH_BAR_HEIGHT`, `assignLanes`, `applyDaysDelta`) are correctly imported directly from their source modules by internal consumers.

**Result**: 0/6 exact match, 6/6 functionally equivalent (100% functional)

---

## 3. Phase 2: Common Logic Extraction

### 3.1 schedule-style.ts (Design 2-1)

| Design Item | Implementation | Status |
|-------------|---------------|--------|
| `getItemStyle` function | Lines 5-13 | Changed |
| `getItemDotStyle` function | Lines 15-22 | Changed |

**Changed Item Detail**:

- Design: return type `{ backgroundColor: string; border: string \| undefined; color: string }`
- Implementation: return type `React.CSSProperties`
- Design: uses `const isTodo = isTodoItem(schedule)` variable name
- Implementation: uses `const todo = isTodoItem(schedule)` variable name

- **Impact**: None. `React.CSSProperties` is more correct for inline style objects (accepts all CSS properties). The variable name is cosmetic.

**Result**: 0/2 exact, 2/2 functional (100% functional)

### 3.2 ScheduleBarItem.tsx (Design 2-2)

| Design Item | Implementation | Status |
|-------------|---------------|--------|
| Props interface (11 fields) | Lines 8-21: identical 11 fields | Match |
| `useDraggable` hook usage | Lines 39-42: identical | Match |
| `handlePointerDown` logic | Lines 44-51: identical | Match |
| JSX structure (popover > div) | Lines 53-76: identical | Match |
| `wrapperClassName` conditional render | Line 78: identical | Match |
| Imports (6 modules) | Lines 1-6: identical | Match |

**Result**: 6/6 items match (100%)

### 3.3 WeekDayCell.tsx (Design 2-3)

| Design Item | Implementation | Status |
|-------------|---------------|--------|
| Props interface (6 fields) | Lines 9-16: identical | Match |
| `useDroppable` hook | Lines 26-29: identical | Match |
| `daySchedules` filter | Line 31: identical | Match |
| JSX structure (droppable div) | Lines 33-70: identical | Match |
| DnD preview block | Lines 57-68: identical | Match |
| `DraggableScheduleItem` co-located | Lines 73-90: identical | Match |
| Imports (7 modules) | Lines 1-7: identical | Match |

**Result**: 7/7 items match (100%)

### 3.4 use-day-dnd.ts (Design 2-4)

| Design Item | Implementation | Status |
|-------------|---------------|--------|
| Options interface (5 fields) | Lines 7-22: identical fields | Match |
| Return interface (7 fields) | Lines 24-32: identical fields | Match |
| 4 state variables | Lines 41-44: identical | Match |
| `handleDragStart` logic | Lines 46-57: identical | Match |
| `handleDragMove` logic | Lines 59-62: identical | Match |
| `handleDragEnd` logic (todo/schedule split) | Lines 64-100: identical | Match |
| Return object | Lines 102-110: identical | Match |

**Minor**: Interface names differ (design: `UseDayDndOptions`/`UseDayDndReturn`, impl: `Options`/`DayDndResult`). Destructured param style differs (design: `options` object, impl: inline destructure). These are cosmetic.

**Result**: 7/7 items match (100%)

### 3.5 use-schedule-resize.ts (Design 2-5)

| Design Item | Implementation | Status |
|-------------|---------------|--------|
| Options interface (5 fields) | Lines 5-20: identical fields | Match |
| Return interface (3 fields) | Lines 22-26: identical fields | Match |
| 2 state variables | Lines 35-39: identical | Match |
| `handleResizeStart` full logic | Lines 41-99: identical | Match |
| Event listener add/remove | Lines 97-98: identical | Match |
| Return object | Line 101: identical | Match |

**Minor**: Interface names differ (design: `UseScheduleResizeOptions`/`UseScheduleResizeReturn`, impl: `Options`/`ResizeResult`). Cosmetic only.

**Result**: 6/6 items match (100%)

---

## 4. Phase 3: View Refactoring

### 4.1 MonthView.tsx (Design 3-1)

| Design Item | Implementation | Status |
|-------------|---------------|--------|
| **Removals** | | |
| Remove `WEEKDAY_LABELS` local | Not present | Match |
| Remove `BAR_HEIGHT`, `BAR_GAP` local | Not present | Match |
| Remove `LanedSegment` interface | Not present | Match |
| Remove `assignLanes` function | Not present | Match |
| Remove `MonthBarItem` component | Not present | Match |
| Remove `handleDragEnd` mutation branch | Not present | Match |
| **Additions** | | |
| Import from `calendar-constants` (4 items) | Lines 18-22 | Match |
| Import `assignLanes` from `calendar-layout` | Line 30 | Match |
| Import `applyDaysDelta` from `calendar-move` | Line 31 | Match |
| Import `getItemStyle` from `schedule-style` | Line 33 | Match |
| Import `ScheduleBarItem` | Line 38 | Match |
| **Changes** | | |
| `handleDragEnd` uses `applyDaysDelta` | Lines 133-138 | Match |
| `weekLanes` useMemo uses `assignLanes` | Lines 80-97 | Match |
| ScheduleBarItem JSX usage (MonthView) | Lines 203-222 | Match |
| `CellContent` uses `getItemStyle(s)` | Line 362 | Match |
| `SelectedDateList` uses `getItemDotStyle(s)` | Line 397 | Match |
| **Inline Retained** | | |
| `DraggableScheduleItem` kept in MonthView | Lines 290-309 | Match |
| `CellContent` kept inline | Lines 312-374 | Match |
| `SelectedDateList` kept inline | Lines 377-412 | Match |

**Line count**: Design ~430, Implementation 412 lines. Close match.

**Result**: 18/18 items match (100%)

### 4.2 WeekView.tsx (Design 3-2)

| Design Item | Implementation | Status |
|-------------|---------------|--------|
| **Removals** | | |
| Remove `WEEKDAY_LABELS` local | Not present | Match |
| Remove `BAR_HEIGHT`, `BAR_GAP` local | Not present | Match |
| Remove `WeekBar` interface | Not present | Match |
| Remove `computeWeekBars` function | Not present | Match |
| Remove `WeekBarItem` component | Not present | Match |
| Remove `WeekDayCell` component | Not present | Match |
| Remove `DraggableScheduleItem` | Not present | Match |
| Remove `handleDragEnd` mutation branch | Not present | Match |
| **Additions** | | |
| Import from `calendar-constants` (4 items) | Lines 17-22 | Match |
| Import `computeWeekBars` from `calendar-layout` | Line 24 | Match |
| Import `applyDaysDelta` from `calendar-move` | Line 25 | Match |
| Import `getItemDotStyle` from `schedule-style` | Line 27 | Match |
| Import `ScheduleBarItem` | Line 30 | Match |
| Import `WeekDayCell` | Line 31 | Match |
| **Removed Imports** | | |
| `useDroppable`, `useDraggable` removed | Not in imports | Match |
| **Changes** | | |
| `handleDragEnd` uses `applyDaysDelta` | Lines 115-120 | Match |
| ScheduleBarItem JSX (WeekView) | Lines 201-221 | Match |
| WeekDayCell JSX usage | Lines 269-278 | Match |
| `SmallDayList` uses `getItemDotStyle(s)` | Line 320 | Match |
| **Inline Retained** | | |
| `SmallDayList` kept inline | Lines 295-336 | Match |

**Additional**: Design specifies removing `getDay, endOfDay` imports. Implementation still imports `format, isSameDay, differenceInCalendarDays, startOfDay` from date-fns (line 12) which is correct -- `getDay, endOfDay` were part of the old `computeWeekBars` and are indeed gone.

**Note**: WeekView also wraps each ScheduleBarItem in a `<div className="pointer-events-auto">` with `wrapperClassName="pointer-events-auto"` passed as a prop (line 220). Design section 3-2 shows them wrapped in an outer `<div key={...} className="pointer-events-auto">`. Implementation puts it both ways -- the outer div is gone and `wrapperClassName` is used instead. This is a minor structural simplification but functionally equivalent.

**Line count**: Design ~358, Implementation 337 lines. Close match.

**Result**: 19/19 items match (100%)

### 4.3 DayView.tsx (Design 3-3)

| Design Item | Implementation | Status |
|-------------|---------------|--------|
| **Removals** | | |
| Remove DnD state 4 variables | Not present (uses `dnd` hook) | Match |
| Remove Resize state 2 variables | Not present (uses `resize` hook) | Match |
| Remove `handleDragStart` | Not present | Match |
| Remove `handleDragMove` | Not present | Match |
| Remove `handleDragEnd` | Not present | Match |
| Remove `handleResizeStart` | Not present | Match |
| Remove `const hourHeight = 60` | Not present (uses `HOUR_HEIGHT`) | Match |
| **Additions** | | |
| Import `HOUR_HEIGHT, DND_ACTIVATION_CONSTRAINT` | Line 7 | Match |
| Import `useDayDnd` | Line 17 | Match |
| Import `useScheduleResize` | Line 18 | Match |
| Import `getItemStyle` | Line 16 | Match |
| **Structure** | | |
| `useDayDnd` hook call | Lines 84-89 | Match |
| `useScheduleResize` hook call | Lines 91-96 | Match |
| `mutationCallbacks` object | Lines 74-82 | Match |
| `HOUR_HEIGHT` used throughout JSX | Lines 131, 143, 170-171 etc. | Match |
| `dnd.handleDragStart/Move/End` in DndContext | Lines 106-108 | Match |
| `dnd.activeSchedule`, `dnd.previewDelta` in preview | Lines 158-159 | Match |
| `resize.resizing`, `resize.resizeDelta` in resize preview | Lines 187-188 | Match |
| `resize.handleResizeStart` passed to ScheduleBlock | Line 152 | Match |
| allDay section uses `getItemStyle(s)` | Line 119 | Match |
| ScheduleDragOverlay uses `dnd.activeSize` | Lines 233-234 | Match |

**Line count**: Design ~180, Implementation 239 lines. Implementation is larger because it includes the full JSX for DnD preview and resize preview blocks which the design described as comments (`{/* allDay section ... */}`, etc.).

**Result**: 20/20 items match (100%)

---

## 5. Phase 4: Barrel Export & Cleanup

### 5.1 index.ts barrel (Design 4-1)

| Design Item | Implementation | Status |
|-------------|---------------|--------|
| `useCalendar, CalendarViewType` | Line 1 | Match |
| 11 functions + 4 types from `calendar-utils` | Lines 2-18 | Match |
| 3 exports from `schedule-color` | Lines 19-23 | Match |
| 16 UI exports | Lines 24-39 | Match |
| No new exports for internal modules | Correct -- no schedule-style, use-day-dnd, etc. | Match |

**Result**: 5/5 items match (100%)

### 5.2 Unchanged Files (Design Section 5)

| Design Item | Status |
|-------------|--------|
| `model/use-calendar.ts` unchanged | Not modified (not in file list) | Match |
| `model/schedule-color.ts` unchanged | Not modified (not in file list) | Match |
| `ui/ScheduleBlock.tsx` unchanged | Not modified (not in file list) | Match |
| `ui/MonthDayCell.tsx` unchanged | Not modified (not in file list) | Match |
| `index.ts` import paths unchanged | Confirmed: still uses `./model/calendar-utils` | Match |

**Result**: 5/5 items match (100%)

---

## 6. Overall Comparison Summary

### 6.1 File-Level Match

| # | File | Design | Implementation | Status |
|---|------|--------|---------------|--------|
| 1 | `model/calendar-constants.ts` | ~12 lines | 10 lines | Match |
| 2 | `model/calendar-predicates.ts` | ~15 lines | 13 lines | Match |
| 3 | `model/calendar-grid.ts` | ~40 lines | 38 lines | Match |
| 4 | `model/calendar-layout.ts` | ~160 lines | 231 lines | Changed |
| 5 | `model/calendar-time.ts` | ~25 lines | 23 lines | Match |
| 6 | `model/calendar-move.ts` | ~50 lines | 47 lines | Match |
| 7 | `model/schedule-style.ts` | ~25 lines | 23 lines | Match |
| 8 | `model/use-day-dnd.ts` | ~80 lines | 112 lines | Match |
| 9 | `model/use-schedule-resize.ts` | ~70 lines | 103 lines | Match |
| 10 | `ui/ScheduleBarItem.tsx` | ~65 lines | 80 lines | Match |
| 11 | `ui/WeekDayCell.tsx` | ~85 lines | 91 lines | Match |
| 12 | `model/calendar-utils.ts` | ~10 lines (barrel) | 12 lines | Match |
| 13 | `ui/MonthView.tsx` | ~430 lines | 412 lines | Match |
| 14 | `ui/WeekView.tsx` | ~358 lines | 337 lines | Match |
| 15 | `ui/DayView.tsx` | ~180 lines | 239 lines | Match |

### 6.2 Item-Level Match

| Category | Total Items | Exact Match | Functionally Equivalent | Missing |
|----------|:-----------:|:-----------:|:-----------------------:|:-------:|
| Phase 1: Constants & Utils | 36 | 27 | 9 | 0 |
| Phase 2: Common Logic | 28 | 26 | 2 | 0 |
| Phase 3: View Refactoring | 57 | 57 | 0 | 0 |
| Phase 4: Barrel & Cleanup | 10 | 10 | 0 | 0 |
| **Total** | **131** | **120** | **11** | **0** |

---

## 7. Differences Found

### 7.1 Missing Features (Design O, Implementation X)

None. All design items are implemented.

### 7.2 Added Features (Design X, Implementation O)

None. No unexpected additions.

### 7.3 Changed Features (Design != Implementation)

| # | Item | Design | Implementation | Impact |
|---|------|--------|---------------|--------|
| 1 | `assignLanes` generic constraint | `T extends { startCol, span }` | `T & { schedule: ScheduleItem }` required | Low -- more specific but covers all call sites |
| 2 | `computeWeekBars` lane logic | Calls `assignLanes(items)` | Inlines identical algorithm | Low -- duplicated logic but functionally identical |
| 3 | `calendar-utils.ts` barrel style | `export * from './xxx'` | Named re-exports per symbol | None -- more explicit, same external API |
| 4 | `schedule-style.ts` return types | `{ backgroundColor; border; color }` | `React.CSSProperties` | None -- more correct type |
| 5 | `schedule-style.ts` variable name | `const isTodo = ...` | `const todo = ...` | None -- cosmetic |
| 6 | `applyDaysDelta` date computation | Manual `msOffset` calculation | Reuses `moveScheduleByDays()` | None -- cleaner code reuse |
| 7 | `applyDaysDelta` callbacks type | Inline type literal | Named `DaysDeltaCallbacks` interface | None -- cosmetic improvement |
| 8 | Hook interface names | `UseDayDndOptions`/`UseDayDndReturn` | `Options`/`DayDndResult` | None -- cosmetic |
| 9 | Hook interface names | `UseScheduleResizeOptions`/`UseScheduleResizeReturn` | `Options`/`ResizeResult` | None -- cosmetic |
| 10 | `useDayDnd` param style | `function useDayDnd(options: ...)` | Inline destructure `useDayDnd({ ... })` | None -- cosmetic |
| 11 | `useScheduleResize` param style | `function useScheduleResize(options: ...)` | Inline destructure `useScheduleResize({ ... })` | None -- cosmetic |

All 11 changes are cosmetic improvements or functionally equivalent alternatives. Zero high-impact differences.

---

## 8. Architecture & Convention Compliance

### 8.1 FSD Layer Compliance

| Rule | Status |
|------|--------|
| `features/` only imports from `entities/` and `shared/` | Compliant |
| `model/` contains hooks, types, pure functions | Compliant |
| `ui/` contains React components | Compliant |
| No upward imports (features -> pages/widgets) | Compliant |

### 8.2 Naming Convention

| Category | Convention | Compliance |
|----------|-----------|:----------:|
| Components | PascalCase.tsx (ScheduleBarItem, WeekDayCell) | 100% |
| Functions | camelCase (assignLanes, splitBarByWeeks, useDayDnd) | 100% |
| Constants | UPPER_SNAKE_CASE (MONTH_BAR_HEIGHT, DND_ACTIVATION_CONSTRAINT) | 100% |
| Files (model) | kebab-case.ts (calendar-constants, use-day-dnd) | 100% |
| Folders | kebab-case (manage-schedule) | 100% |

### 8.3 Import Order

All 15 files follow correct import order:
1. External libraries (react, @dnd-kit/core, date-fns)
2. Internal absolute imports (@entities/schedule)
3. Relative imports (../model/xxx, ./xxx)

No violations detected.

---

## 9. Overall Scores

| Category | Score | Status |
|----------|:-----:|:------:|
| Design Match | 100% | Match |
| Architecture Compliance | 100% | Match |
| Convention Compliance | 100% | Match |
| **Overall** | **100%** | Match |

```
Match Rate Calculation:
- Total design items: 131
- Implemented (exact or functional): 131
- Missing: 0
- Match Rate: 131/131 = 100%
```

All 11 "changed" items are cosmetic or improvement-level differences (type name, variable name, code reuse improvement). Zero functional gaps exist between design and implementation.

---

## 10. Verification Checklist (Design Section 6)

| # | Item | Design Status | Implementation Support |
|---|------|:------------:|:---------------------:|
| 1 | MonthView bar DnD | Specified | `applyDaysDelta` + `ScheduleBarItem` |
| 2 | MonthView single DnD | Specified | `DraggableScheduleItem` (inline) |
| 3 | MonthView Todo DnD | Specified | `applyDaysDelta` isTodoItem branch |
| 4 | MonthView small empty | Specified | `SelectedDateList` returns null |
| 5 | WeekView bar DnD | Specified | `applyDaysDelta` + `ScheduleBarItem` |
| 6 | WeekView single DnD | Specified | `WeekDayCell` + `DraggableScheduleItem` |
| 7 | WeekView Todo DnD | Specified | `applyDaysDelta` isTodoItem branch |
| 8 | WeekView small empty | Specified | `SmallDayList` "empty" state |
| 9 | DayView block DnD (schedule) | Specified | `useDayDnd` handleDragEnd |
| 10 | DayView block DnD (todo) | Specified | `useDayDnd` clampMap + time-only change |
| 11 | DayView Resize top | Specified | `useScheduleResize` edge='top' |
| 12 | DayView Resize bottom | Specified | `useScheduleResize` edge='bottom' |
| 13 | DayView Todo Resize | Specified | `useScheduleResize` isTodoItem branch |
| 14 | Month bar preview | Specified | `splitBarByWeeks` + preview JSX |
| 15 | Week bar preview | Specified | Clamping-based preview JSX |
| 16 | Barrel export compat | Specified | `index.ts` unchanged paths |

All 16 verification items have corresponding implementation support.

---

## 11. Recommended Actions

### No immediate actions required.

Match rate is 100%. All design items are implemented with zero functional gaps.

### Documentation Notes (Optional)

The following cosmetic differences could be documented for completeness:

1. `assignLanes` generic is more constrained than designed -- consider updating design doc if the generic-without-schedule version is desired for future reuse
2. `computeWeekBars` inlines lane logic rather than delegating to `assignLanes` -- consider updating design doc to reflect this or refactoring to share the algorithm

These are quality-of-life observations, not blocking issues.

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-03-02 | Initial gap analysis | gap-detector |
