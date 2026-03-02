# Changelog

## [2026-03-02] - link-test PDCA Completion

### Added
- **Test Suite for entity-link**: 55 comprehensive test cases across 5 files (55 focused + 413 node + 573 web total)
  - Repository integration tests (19): entity-link CRUD + todo BFS descendant traversal
  - Service unit tests (26): normalize/validation/orphan cleanup with full branch coverage
  - Renderer pure function tests (5): entity type → tab options mapping
  - Mock enhancements (5): todo service link cleanup validation

- **Branch Coverage**: 100% on normalize (4 branches), link error paths (7), getLinked isSource (4 + orphan scenarios)

- **Test Documentation**: Warning comment on JavaScript default parameter behavior in mock setup

### Fixed
- **Critical Bug Fix**: JavaScript default parameter bug in vi.mock pattern
  - Changed `vi.clearAllMocks()` → `vi.resetAllMocks()` in service tests
  - Prevents false negatives where `mockFindById('type', undefined)` triggers default parameter fallback
  - All 26 service tests now pass with explicit mock setup per test

- **todo.test.ts Mock Gap**: Added `findAllDescendantIds` to todoRepository mock (was missing after link integration)
  - Restored 5 remove tests to passing state
  - Added 3 new tests validating link cleanup during todo deletion

### Changed
- **Implementation Quality**: Improved test helper patterns
  - Repository tests: Generic factory `makeTodo(overrides?)` pattern
  - Service tests: `mockBothEntities()` helper correctly handles same-type linking
  - Added defensive comments documenting subtle JavaScript behaviors

### Quality Metrics
- Design Match Rate: 100% (66/66 items)
- Test Pass Rate: 100% (986 total tests: 413 node + 573 web)
- Iteration Count: 0 (no Act phase needed)
- Backward Compatibility: 100% (all 38 existing todo service tests passing)

### Documentation
- Plan: `docs/01-plan/features/link-test.plan.md` ✅
- Design: `docs/02-design/features/link-test.design.md` ✅
- Analysis: `docs/03-analysis/link-test.analysis.md` ✅
- Report: `docs/04-report/link-test.report.md` ✅
