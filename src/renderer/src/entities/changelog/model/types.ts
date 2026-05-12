/**
 * Changelog 도메인 타입.
 *
 * P2-6: shared/constants 에서 entities 로 이전. 콘텐츠 데이터이므로 도메인.
 */
export interface ChangelogChange {
  type: 'feature' | 'improvement' | 'fix'
  title: string
  description?: string
}

export interface ChangelogEntry {
  /** semver "MAJOR.MINOR.PATCH" */
  version: string
  /** ISO date "YYYY-MM-DD" */
  date: string
  changes: ChangelogChange[]
}
