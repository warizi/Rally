# Archive Index - 2026-03

| Feature              | Phase     | Match Rate | Archived   |
| -------------------- | --------- | ---------- | ---------- |
| calendar-refactor    | completed | 100%       | 2026-03-02 |
| schedule-test        | completed | 100%       | 2026-03-02 |
| link-test            | completed | 100%       | 2026-03-02 |
| image-viewer-test    | completed | 100%       | 2026-03-02 |
| canvas-visualization | completed | 93%        | 2026-03-03 |
| note-image           | completed | 100%       | 2026-03-03 |
| note-image-test      | completed | 100%       | 2026-03-03 |
| reminder             | completed | 100%       | 2026-03-03 |
| codebase-refactoring | completed | 100%       | 2026-03-07 |

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

## note-image-test

- **Description**: noteImageService + noteService 이미지 통합 테스트 — 7 methods, 36 test cases, path traversal security validation
- **Key Results**: 32 cases (note-image.test.ts) + 4 cases (note.test.ts), 100% match rate, 0 iterations, title attribute regex limitation discovered
- **Documents**: [plan](note-image-test/note-image-test.plan.md) | [design](note-image-test/note-image-test.design.md) | [analysis](note-image-test/note-image-test.analysis.md) | [report](note-image-test/note-image-test.report.md)

## reminder

- **Description**: Todo/Schedule 알림 시스템 — Electron Notification, 1분 간격 폴링 스케줄러, 5개 프리셋 오프셋, polymorphic entity 참조, 완료/날짜변경/삭제 자동 연동
- **Key Results**: 13 new files + 11 modified, 100% match rate (151/151), 0 iterations, 9-stage implementation (schema → repo → service → IPC → scheduler → entities → features → todo/schedule integration → service wiring)
- **Documents**: [plan](reminder/reminder.plan.md) | [design](reminder/reminder.design.md) | [analysis](reminder/reminder.analysis.md) | [report](reminder/reminder.report.md)

## codebase-refactoring

- **Description**: Comprehensive codebase refactoring — 2,500+ lines duplicate removal, factory patterns (repository, fs-utils, own-write-tracker, file-watcher), workspace-watcher 944→500 lines, N+1 query fix, 3 bug fixes
- **Key Results**: 5 new files, 25+ modified, 4 deleted, 100% match rate (88/88), 0 iterations, 647/647 tests passing, zero side effects
- **Documents**: [plan](codebase-refactoring/codebase-refactoring.plan.md) | [design](codebase-refactoring/codebase-refactoring.design.md) | [analysis](codebase-refactoring/codebase-refactoring.analysis.md) | [report](codebase-refactoring/codebase-refactoring.report.md)
