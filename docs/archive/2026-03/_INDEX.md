# Archive Index - 2026-03

| Feature              | Phase     | Match Rate | Archived   |
| -------------------- | --------- | ---------- | ---------- |
| calendar-refactor    | completed | 100%       | 2026-03-02 |
| schedule-test        | completed | 100%       | 2026-03-02 |
| link-test            | completed | 100%       | 2026-03-02 |
| image-viewer-test    | completed | 100%       | 2026-03-02 |
| canvas-visualization | completed | 93%        | 2026-03-03 |
| note-image           | completed | 100%       | 2026-03-03 |

## calendar-refactor

- **Description**: Pure structural refactoring of calendar feature (MonthView, WeekView, DayView)
- **Key Results**: 252-line monolithic utils split into 6 focused modules, 12 new files, 3 views refactored (~30% line reduction each), 100% match rate
- **Documents**: [plan](calendar-refactor/calendar-refactor.plan.md) | [design](calendar-refactor/calendar-refactor.design.md) | [analysis](calendar-refactor/calendar-refactor.analysis.md) | [report](calendar-refactor/calendar-refactor.report.md)

## schedule-test

- **Description**: Unit tests for schedule model (manage-schedule/model/) with 100% coverage target
- **Key Results**: 165 tests (162 planned + 3 extra), 27/27 edge cases, 100% Stmt/Branch/Func/Line coverage, 0 iterations needed
- **Documents**: [plan](schedule-test/schedule-test.plan.md) | [analysis](schedule-test/schedule-test.analysis.md) | [report](schedule-test/schedule-test.report.md)

## link-test

- **Description**: Entity-link feature test code — Repository integration, Service unit, Renderer pure function, todo mock enhancement
- **Key Results**: 55 tests across 5 files, normalize 4-branch 100% coverage, orphan cleanup 3 scenarios, JS default parameter bug discovery, 0 iterations needed
- **Documents**: [plan](link-test/link-test.plan.md) | [design](link-test/link-test.design.md) | [analysis](link-test/link-test.analysis.md) | [report](link-test/link-test.report.md)

## image-viewer-test

- **Description**: Image viewer feature test code — Repository integration (21), Service unit (29), own-write-tracker (5), React Query hooks (11), to-tab-options (1)
- **Key Results**: 67 tests across 5 files, 100% match rate, entityLinkService call order verification, folder→root move path stripping, timer reset edge case, 0 iterations needed
- **Documents**: [plan](image-viewer-test/image-viewer-test.plan.md) | [design](image-viewer-test/image-viewer-test.design.md) | [analysis](image-viewer-test/image-viewer-test.analysis.md) | [report](image-viewer-test/image-viewer-test.report.md)

## canvas-visualization

- **Description**: Obsidian Canvas-style infinite canvas tool — 4 DB tables, 15 IPC channels, @xyflow/react integration, 8 React components, Phase 1 MVP
- **Key Results**: 24 new files + 6 modified, 93% match rate (87% initial → 93% after 1 iteration), backend 100% match, Phase 2 features (EntityPicker) delivered early
- **Documents**: [plan](canvas-visualization/canvas-visualization.plan.md) | [design](canvas-visualization/canvas-visualization.design.md) | [analysis](canvas-visualization/canvas-visualization.analysis.md) | [report](canvas-visualization/canvas-visualization.report.md)

## note-image

- **Description**: Milkdown MD editor image DnD/Paste — .images/ folder storage, blob URL rendering, auto-cleanup on delete
- **Key Results**: 3 new files + 6 modified, 100% match rate, 0 iterations, 12 enhancements beyond design (image garbage collection)
- **Documents**: [plan](note-image/note-image.plan.md) | [design](note-image/note-image.design.md) | [analysis](note-image/note-image.analysis.md) | [report](note-image/note-image.report.md)
