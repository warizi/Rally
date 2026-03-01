# Archive Index - 2026-03

| Feature | Phase | Match Rate | Archived |
|---------|-------|------------|----------|
| calendar-refactor | completed | 100% | 2026-03-02 |
| schedule-test | completed | 100% | 2026-03-02 |

## calendar-refactor

- **Description**: Pure structural refactoring of calendar feature (MonthView, WeekView, DayView)
- **Key Results**: 252-line monolithic utils split into 6 focused modules, 12 new files, 3 views refactored (~30% line reduction each), 100% match rate
- **Documents**: [plan](calendar-refactor/calendar-refactor.plan.md) | [design](calendar-refactor/calendar-refactor.design.md) | [analysis](calendar-refactor/calendar-refactor.analysis.md) | [report](calendar-refactor/calendar-refactor.report.md)

## schedule-test

- **Description**: Unit tests for schedule model (manage-schedule/model/) with 100% coverage target
- **Key Results**: 165 tests (162 planned + 3 extra), 27/27 edge cases, 100% Stmt/Branch/Func/Line coverage, 0 iterations needed
- **Documents**: [plan](schedule-test/schedule-test.plan.md) | [analysis](schedule-test/schedule-test.analysis.md) | [report](schedule-test/schedule-test.report.md)
