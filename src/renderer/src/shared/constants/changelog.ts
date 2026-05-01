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
    version: '1.6.0',
    date: '2026-05-02',
    changes: [
      {
        type: 'feature',
        title: '휴지통 추가',
        description:
          '폴더·노트·표·PDF·이미지·캔버스·할 일·일정·반복 규칙·템플릿 — 모든 항목을 삭제하면 즉시 영구 삭제되지 않고 휴지통으로 이동합니다. 사이드바의 "휴지통"에서 복구하거나 영구 삭제할 수 있고, 폴더처럼 하위 항목이 많은 경우에도 한 묶음으로 묶여 한 번에 복구됩니다. 설정 > 휴지통에서 자동 비우기 주기를 1일/1주/30일/90일/1년 또는 "안 함"으로 변경할 수 있습니다 (기본 30일).'
      },
      {
        type: 'feature',
        title: 'AI 통합 도구 대폭 확장',
        description:
          'Claude Code 등 외부 AI 도구가 워크스페이스를 다룰 수 있는 MCP 도구가 12개에서 29개로 늘었습니다. 일정·알림·반복 할일·태그·템플릿·PDF·이미지·히스토리·워크스페이스 통계 등 거의 모든 도메인이 노출되며, 통합 검색·여러 노트 일괄 읽기·휴지통 복구 등 새 작업이 가능해졌습니다.'
      },
      {
        type: 'improvement',
        title: '삭제 안전성 향상',
        description:
          '실수로 삭제한 항목을 복구할 수 있도록 모든 삭제 경로(파일 탐색기·캔버스·할 일·일정·반복 규칙·템플릿)가 휴지통을 거치도록 변경됐습니다. 폴더처럼 하위 항목이 많은 경우도 한 묶음으로 안전하게 복구됩니다.'
      },
      {
        type: 'improvement',
        title: '항목 조회·검색 옵션 강화',
        description:
          '큰 워크스페이스에서 항목 조회 시 응답 크기를 줄일 수 있는 옵션(폴더 범위, 종류 필터, 요약 모드, 페이지네이션)이 추가됐습니다. AI 통합 검색이 노트뿐 아니라 표·캔버스·할 일까지 한 번에 처리하며, 매칭 부분 발췌 표시도 지원합니다.'
      },
      {
        type: 'improvement',
        title: '대량 작업 안정성·성능 개선',
        description:
          '여러 항목을 한 번에 처리하는 일괄 작업(이름 변경·이동·삭제·연결 등)이 트랜잭션으로 묶여 중간에 실패해도 부분 적용 없이 모두 되돌려집니다. 할 일 목록의 연결 정보 조회도 일괄 쿼리로 최적화돼 큰 워크스페이스에서 응답 속도가 크게 개선됐습니다.'
      },
      {
        type: 'fix',
        title: '연결된 항목 양쪽 휴지통 → 복구 시 연결 손실 수정',
        description:
          '서로 연결된 두 항목(예: 할 일 ↔ 노트)이 각각 휴지통에 들어간 뒤 한쪽만 먼저 복구할 때, 다른 한쪽이 아직 휴지통에 있다는 이유로 연결이 끊어져 영구 손실되던 문제를 수정했습니다. 이제 양쪽 모두 복구되면 자동으로 연결이 살아납니다.'
      },
      {
        type: 'fix',
        title: '항목 삭제 시 휴지통 화면 갱신 누락 수정',
        description:
          '파일 탐색기·할 일 등에서 항목을 삭제했을 때 휴지통 화면이 즉시 갱신되지 않던 문제와, 다른 화면에서 보고 있던 연결 목록이 갱신되지 않던 문제를 수정했습니다.'
      }
    ]
  },
  {
    version: '1.5.1',
    date: '2026-05-01',
    changes: [
      {
        type: 'improvement',
        title: 'MCP 서버 tools 기능 개선',
        description:
          'MCP 서버의 tools 기능이 개편되었으며, AI가 더 직관적으로 도구를 사용할 수 있도록 개선되었습니다. 이제 각 도구는 명확한 목적과 사용법이 정의되어 있으며, AI가 상황에 맞는 도구를 선택하여 활용할 수 있습니다. 또한, 도구 사용 시 발생하는 오류 처리와 예외 상황에 대한 대응도 강화되어 안정적인 운영이 가능합니다.'
      }
    ]
  },
  {
    version: '1.5.0',
    date: '2026-05-01',
    changes: [
      {
        type: 'feature',
        title: '히스토리 기능 추가',
        description:
          '완료한 할 일과 연결된 노트·테이블·이미지·PDF·캔버스를 시간순으로 한눈에 확인할 수 있는 히스토리 페이지를 추가했습니다. 사이드바의 "히스토리"에서 진입할 수 있고, 날짜별로 자동 그룹화되며 텍스트·날짜 검색을 지원합니다. 무한 스크롤로 과거 기록까지 부드럽게 탐색할 수 있고, 연결된 파일 노드를 클릭하거나 다른 패널로 드래그해 바로 열 수 있습니다. 반복 할일 완료도 함께 표시됩니다.'
      },
      {
        type: 'feature',
        title: '노트·테이블 템플릿 기능 추가',
        description:
          '자주 사용하는 노트나 테이블 구성을 템플릿으로 저장하고 다시 불러올 수 있습니다. 노트와 테이블 상세 화면 헤더의 템플릿 버튼에서 현재 구성 저장, 저장된 템플릿 불러오기·삭제가 가능합니다. 테이블의 경우 본문 데이터와 함께 열 너비도 함께 저장됩니다.'
      },
      {
        type: 'improvement',
        title: '엔티티 아이콘 색상 통일',
        description:
          '탐색기, 히스토리, 탭바, 드래그 오버레이 등 모든 영역에서 노트(파랑)·테이블(녹색)·PDF(빨강)·이미지(하늘)·캔버스(보라) 아이콘 색상이 일관되게 표시되도록 통합했습니다.'
      },
      {
        type: 'improvement',
        title: 'macOS 앱 메뉴 정리',
        description:
          '앱 메뉴에서 사용하지 않는 항목들(Services, 음성 입력, 자동 완성, 줌, 화면 확대 등)을 정리해 깔끔하게 표시되도록 개선했습니다.'
      },
      {
        type: 'improvement',
        title: '테이블 툴바 가로 스크롤 적용',
        description:
          '테이블 상세 화면의 탭 너비가 좁아질 때 툴바가 줄바꿈되어 UI가 깨지던 문제를 개선했습니다. 이제 툴바가 가로로 스크롤되어 좁은 화면에서도 깔끔하게 표시됩니다.'
      },
      {
        type: 'improvement',
        title: '워크스페이스 백업에 누락된 데이터 포함',
        description:
          '기존 워크스페이스 백업에 포함되지 않던 반복 할일, 반복 할일 완료 이력, 템플릿, 터미널 레이아웃·세션이 백업/복원 시 함께 처리되도록 개선했습니다. 기존 백업 파일도 그대로 복원 가능합니다.'
      },
      {
        type: 'fix',
        title: '설정 다이얼로그 스크롤 영역 깨짐 수정',
        description:
          '글꼴 크기를 크게로 설정했을 때 설정 다이얼로그의 콘텐츠 일부가 영역 밖으로 잘려 보이던 문제를 수정했습니다.'
      },
      {
        type: 'fix',
        title: 'macOS 풀스크린 타이틀 및 앱 정보 표시 수정',
        description:
          'macOS 풀스크린 모드 시 상단에 "Electron"으로 표시되던 문제와 앱 정보 보기 카피라이트 표기 오류를 수정했습니다.'
      }
    ]
  },
  {
    version: '1.4.2',
    date: '2026-05-01',
    changes: [
      {
        type: 'improvement',
        title: '탐색기 dnd 성능 개선',
        description:
          '탐색기에서 파일과 폴더를 드래그 앤 드롭할 때 발생하던 성능 저하 문제를 개선했습니다. 이제 많은 수의 파일과 폴더가 있는 경우에도 원활하게 드래그 앤 드롭이 가능합니다.'
      },
      {
        type: 'fix',
        title: '탐색기에서 파일 이동 시 간헐적으로 발생하던 오류 수정',
        description:
          '탐색기에서 파일이나 폴더를 다른 위치로 이동할 때 간헐적으로 발생하던 오류를 수정했습니다. 이제 파일 이동이 안정적으로 이루어집니다.'
      }
    ]
  },
  {
    version: '1.4.1',
    date: '2026-04-30',
    changes: [
      {
        type: 'fix',
        title: '1.4.0에서 업데이트가 안 되는 문제 수정',
        description: '1.4.0에서 업데이트 시 누락된 내용 적용'
      }
    ]
  },
  {
    version: '1.4.0',
    date: '2026-04-30',
    changes: [
      {
        type: 'feature',
        title: '파일 복사 기능 추가',
        description:
          '탐색기에서 노트, CSV, PDF, 이미지 파일을 우클릭하여 같은 위치에 복사할 수 있습니다. 복사된 파일은 이름 끝에 "(1)", "(2)"가 붙고 원본 바로 아래에 배치됩니다.'
      },
      {
        type: 'improvement',
        title: '탐색기에서 파일과 폴더 이름이 길 때 툴팁으로 전체 이름 표시',
        description:
          '탐색기에서 파일과 폴더 이름이 길어서 잘리는 경우, 마우스를 올리면 전체 이름이 툴팁으로 표시됩니다.'
      },
      {
        type: 'fix',
        title: '같은 종류 항목 간 연결 불가 문제 수정',
        description:
          '연결 추가 시 자기 자신과 같은 종류의 탭(예: 노트에서 노트 탭)이 보이지 않아 같은 종류끼리 연결할 수 없던 문제를 수정했습니다. 이제 모든 종류의 탭이 표시되며, 자기 자신만 목록에서 제외됩니다.'
      },
      {
        type: 'improvement',
        title: '연결 팝오버 탭 레이아웃 개선',
        description:
          '연결 팝오버의 탭이 7개로 늘어나면서 라벨이 잘리던 문제를 해결했습니다. 팝오버 너비가 넓어졌고, 좁은 경우에도 라벨이 깔끔하게 처리되며 마우스를 올리면 전체 이름이 툴팁으로 표시됩니다.'
      },
      {
        type: 'fix',
        title: '기본 워크스페이스 위치 변경',
        description:
          'macOS의 Documents 폴더 권한 문제로 워크스페이스 설정 파일을 읽지 못하던 문제를 해결하기 위해, 신규 설치 시 기본 워크스페이스 위치를 ~/Documents/Rally에서 ~/Rally로 변경했습니다. 기존 사용자도 다음 실행 시 자동으로 새 위치로 마이그레이션되며, 가능한 경우 노트·파일 데이터도 함께 이동됩니다.'
      },
      {
        type: 'feature',
        title: '탐색기에서 드래그로 파일 열기 추가',
        description:
          '탐색기에서 노트, CSV, PDF, 이미지 파일을 드래그하여 열 수 있습니다. 드래그한 파일이 열려 있는 탭으로 이동하며, 해당 탭이 없는 경우 새 탭으로 열립니다.'
      }
    ]
  },
  {
    version: '1.3.8',
    date: '2026-04-28',
    changes: [
      {
        type: 'fix',
        title: '대시보드 그래프 0값 표시 오류 수정',
        description: '대시보드의 그래프가 0값 밑으로 표시되던 문제를 수정했습니다.'
      },
      {
        type: 'improvement',
        title: '노트, CSV 가져오기 추가',
        description:
          '폴더 컨텍스트 메뉴에서 노트와 CSV 파일을 가져올 수 있는 기능이 추가되었습니다.'
      },
      {
        type: 'improvement',
        title: '탐색기 컨텍스트 메뉴의 가독성 향상',
        description:
          '탐색기에서 파일과 폴더를 우클릭했을 때 나타나는 컨텍스트 메뉴의 항목들이 그룹화되고 구분선으로 나뉘어져서 가독성이 향상되었습니다.'
      }
    ]
  },
  {
    version: '1.3.7',
    date: '2026-04-24',
    changes: [
      {
        type: 'fix',
        title: '완료된 할 일 표기 오류 수정',
        description:
          '일반 할 일을 완료 했을 때 완료된 항목 리스트에서 나타나지 않던 문제를 수정했습니다.'
      },
      {
        type: 'improvement',
        title: '할 일 추가 시 시작일, 마감일 자동 설정 추가',
        description:
          '할 일을 추가할 때 시작일과 마감일이 오늘로 자동으로 설정됩니다. 설정 > 기본 > 할일에서 이 기능을 켜고 끌 수 있습니다.'
      },
      {
        type: 'improvement',
        title: '파일 확장자 표시 설정 추가',
        description:
          '설정 > 기본 > 파일탐색기에서 파일 확장자를 표시할지 여부를 선택할 수 있습니다.'
      },
      {
        type: 'improvement',
        title: '탭 헤더 축소 설정 추가',
        description:
          '설정 > 기본에서 탭 헤더를 축소하여 작은 제목과 버튼만 표시하도록 설정할 수 있습니다.'
      }
    ]
  },
  {
    version: '1.3.6',
    date: '2026-04-17',
    changes: [
      {
        type: 'fix',
        title: '터미널 한글 오류 수정',
        description:
          'tmux가 아닌 터미널에서 한글이 깨져서 보이던 문제가 수정되었습니다. 이제 터미널에서 한글이 정상적으로 표시됩니다.'
      }
    ]
  },
  {
    version: '1.3.5',
    date: '2026-04-17',
    changes: [
      {
        type: 'fix',
        title: '터미널 한글 오류 수정',
        description:
          '터미널에서 한글이 깨져서 보이던 문제가 수정되었습니다. 이제 터미널에서 한글이 정상적으로 표시됩니다.'
      }
    ]
  },
  {
    version: '1.3.4',
    date: '2026-04-16',
    changes: [
      {
        type: 'improvement',
        title: '터미널 세션 영속성 개선',
        description:
          '앱을 재시작해도 터미널 세션이 유지됩니다. tmux를 백엔드로 사용하여 실행 중인 프로세스가 앱 종료 후에도 살아있으며, 재시작 시 자동으로 재연결됩니다.'
      },
      {
        type: 'improvement',
        title: '터미널 tab 관리',
        description:
          '터미널을 탭으로 관리할 수 있습니다. 여러 터미널 세션을 탭으로 구분하여 사용할 수 있으며, 탭 간 전환이 편리해집니다.'
      }
    ]
  },
  {
    version: '1.3.3',
    date: '2026-03-13',
    changes: [
      {
        type: 'improvement',
        title: '반복 할일 관리 추가',
        description:
          '반복 할일 관리를 추가하였습니다. 할일을 생성할 때 반복 옵션을 설정하여 매일, 매주, 매월 등 원하는 주기로 할일이 자동으로 생성되도록 할 수 있습니다.'
      }
    ]
  },
  {
    version: '1.3.2',
    date: '2026-03-12',
    changes: [
      {
        type: 'feature',
        title: '캔버스에 캔버스 노드 추가',
        description:
          '캔버스 안에 다른 캔버스를 노드로 추가할 수 있으며, 참조된 캔버스의 미니맵 프리뷰가 표시됩니다.'
      },
      {
        type: 'improvement',
        title: '캔버스 노드 타이틀 표시 개선',
        description: '노드 헤더에 노드 종류 대신 실제 요소 제목이 표시됩니다.'
      },
      {
        type: 'feature',
        title: '노트 에디터 구문 힌트',
        description: '포커스된 줄에 마크다운 구문 마커(#, ---)가 표시됩니다.'
      },
      {
        type: 'fix',
        title: '노트 에디터 인용문·수평선 스타일 추가',
        description: '마크다운 blockquote와 horizontal rule이 정상적으로 렌더링됩니다.'
      }
    ]
  },
  {
    version: '1.2.1',
    date: '2026-03-11',
    changes: [
      {
        type: 'fix',
        title: '폴더 이름 변경 시 하위 파일 경로 미갱신 수정',
        description:
          '상위 폴더 이름 변경 시 하위 테이블(CSV), PDF, 이미지 파일의 경로가 함께 갱신되지 않던 문제를 수정했습니다.'
      },
      {
        type: 'fix',
        title: '설정 커맨드/스킬즈 상세보기 스크롤 수정',
        description:
          '설정 > AI 탭에서 커맨드·스킬즈 내용을 펼쳤을 때 스크롤이 되지 않던 문제를 수정했습니다.'
      }
    ]
  },
  {
    version: '1.2.0',
    date: '2026-03-09',
    changes: [
      {
        type: 'feature',
        title: '터미널 사이드 패널',
        description:
          '터미널이 탭 대신 사이드 패널로 열립니다. 접어도 터미널 컨텍스트가 유지되며, 워크스페이스 전환 시 자동 정리됩니다.'
      },
      {
        type: 'feature',
        title: 'Claude Code 커맨드 자동 세팅',
        description:
          '워크스페이스 생성/활성화 시 .claude/commands에 Rally 커맨드(rally-doc, rally-task, rally-context, rally-plan, rally-organize)를 자동 배포합니다.'
      },
      {
        type: 'feature',
        title: 'MCP 서버 자동 등록',
        description:
          '워크스페이스 폴더에 .mcp.json을 자동 생성하여 Claude Code에서 Rally MCP 서버가 바로 연결됩니다.'
      },
      {
        type: 'improvement',
        title: 'AI 설정에 커맨드 설명 표시',
        description: '설정 > AI 탭에서 각 Rally 커맨드의 설명을 확인하고 내용을 복사할 수 있습니다.'
      }
    ]
  },
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
