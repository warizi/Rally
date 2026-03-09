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
    version: '1.1.0',
    date: '2026-03-09',
    changes: [
      {
        type: 'feature',
        title: '노트 내 검색 기능',
        description: 'Cmd+F로 노트 내 텍스트를 검색하고 하이라이트로 결과를 확인할 수 있습니다.'
      },
      {
        type: 'feature',
        title: '노트 링크 자동 변환',
        description:
          'URL 입력 후 스페이스/엔터 시 자동으로 링크가 적용되며, [텍스트](URL) 마크다운 문법도 지원합니다.'
      },
      {
        type: 'feature',
        title: '노트 링크 외부 브라우저 열기',
        description: 'Cmd+Click으로 노트 내 링크를 기본 브라우저에서 열 수 있습니다.'
      },
      {
        type: 'feature',
        title: 'URL 붙여넣기 시 자동 링크',
        description:
          'URL을 붙여넣으면 자동으로 링크가 적용되며, 텍스트 선택 후 붙여넣으면 선택 텍스트에 링크가 적용됩니다.'
      },
      {
        type: 'feature',
        title: '캔버스 노드 색상 변경',
        description:
          '노드 선택 시 8가지 프리셋 색상으로 테두리 색상을 변경할 수 있습니다. 여러 노드 일괄 변경도 지원합니다.'
      },
      {
        type: 'feature',
        title: '캔버스 엣지 편집 툴바',
        description:
          '연결선 선택 시 텍스트 라벨, 선 스타일(실선/점선/점점선), 화살표 방향(없음/단방향/양방향), 색상을 편집할 수 있습니다.'
      },
      {
        type: 'improvement',
        title: '알림이 모든 워크스페이스 대상으로 동작',
        description:
          '비활성 워크스페이스의 알림도 정상 발송되며, 알림 클릭 시 해당 워크스페이스로 자동 전환됩니다.'
      }
    ]
  },
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
