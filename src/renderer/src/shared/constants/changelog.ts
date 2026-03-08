export interface ChangelogChange {
  type: 'feature' | 'improvement' | 'fix'
  title: string
  description?: string
}

export interface ChangelogEntry {
  version: string
  date: string
  changes: ChangelogChange[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.0.3',
    date: '2026-03-08',
    changes: [
      {
        type: 'feature',
        title: '앱 업데이트 내역 안내 추가',
        description: '업데이트 후 첫 실행 시 변경 사항을 자동으로 안내합니다.'
      },
      {
        type: 'fix',
        title: '앱 업데이트 알림 한글로 수정',
        description: '자동 업데이트 완료 알림이 한글로 표시됩니다.'
      }
    ]
  },
  {
    version: '1.0.2',
    date: '2026-03-08',
    changes: [
      {
        type: 'feature',
        title: '대시보드 헤더에 워크스페이스 안내 문구 추가'
      },
      {
        type: 'feature',
        title: 'GitHub 릴리즈 배포 및 자동 업데이트 지원',
        description: '새 버전이 출시되면 앱에서 자동으로 다운로드 및 설치됩니다.'
      },
      {
        type: 'feature',
        title: '워크스페이스 백업/복원 기능',
        description: '워크스페이스 데이터를 파일로 내보내고 복원할 수 있습니다.'
      },
      {
        type: 'feature',
        title: '대시보드 그래프 추가'
      },
      {
        type: 'improvement',
        title: '캘린더 가독성 개선'
      }
    ]
  },
  {
    version: '1.0.0',
    date: '2026-03-01',
    changes: [{ type: 'feature', title: '첫 번째 릴리즈' }]
  }
]
