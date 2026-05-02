import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { workspaceService } from './workspace'
import { workspaceRepository } from '../repositories/workspace'
import { folderService } from './folder'
import { noteService } from './note'
import { csvFileService } from './csv-file'
import { canvasService } from './canvas'
import { canvasNodeService } from './canvas-node'
import { canvasEdgeService } from './canvas-edge'
import { todoService } from './todo'
import { scheduleService } from './schedule'
import { tagService } from './tag'
import { itemTagService } from './item-tag'
import { ensureClaudeCommands } from './claude-commands-setup'

const SAMPLE_WORKSPACE_NAME = 'Rally 둘러보기'

export interface SampleWorkspaceResult {
  workspaceId: string
  path: string
}

function resolveSamplePath(): string {
  const baseDir = path.join(app.getPath('home'), 'Rally')
  let candidate = path.join(baseDir, SAMPLE_WORKSPACE_NAME)
  let suffix = 2
  const used = new Set(workspaceRepository.findAll().map((w) => path.normalize(w.path)))
  while (fs.existsSync(candidate) || used.has(path.normalize(candidate))) {
    candidate = path.join(baseDir, `${SAMPLE_WORKSPACE_NAME} ${suffix}`)
    suffix++
  }
  return candidate
}

export const onboardingSampleService = {
  createSampleWorkspace(): SampleWorkspaceResult {
    const workspacePath = resolveSamplePath()
    fs.mkdirSync(workspacePath, { recursive: true })

    let workspaceId: string | null = null
    try {
      const workspace = workspaceService.create(SAMPLE_WORKSPACE_NAME, workspacePath)
      workspaceId = workspace.id
      ensureClaudeCommands(workspacePath)

      // ── 1. 폴더 3개
      const meetingsFolder = folderService.create(workspaceId, null, '회의록')
      const researchFolder = folderService.create(workspaceId, null, '연구')

      // ── 2. 노트 4개 + 콘텐츠
      const kickoffNote = noteService.create(workspaceId, meetingsFolder.id, '킥오프 회의록')
      noteService.writeContent(
        workspaceId,
        kickoffNote.id,
        [
          '# 킥오프 회의록',
          '',
          '> 작성일: 오늘',
          '',
          '## 참석자',
          '- 디자이너, 개발자, 기획자',
          '',
          '## 안건',
          '1. 프로젝트 목표 합의',
          '2. 마일스톤 정의',
          '3. 다음 액션',
          '',
          '## 메모',
          'Rally의 모든 데이터는 내 컴퓨터에 저장됩니다. 마음껏 편집해보세요.'
        ].join('\n')
      )

      const standupNote = noteService.create(workspaceId, meetingsFolder.id, '주간 스탠드업 (예시)')
      noteService.writeContent(
        workspaceId,
        standupNote.id,
        [
          '# 주간 스탠드업',
          '',
          '## 지난주',
          '- [x] 디자인 시안 검토',
          '',
          '## 이번주',
          '- [ ] 프로토타입 테스트',
          '- [ ] 사용자 인터뷰 정리',
          '',
          '## 막혀있는 것',
          '- 없음'
        ].join('\n')
      )

      const competitorNote = noteService.create(
        workspaceId,
        researchFolder.id,
        '경쟁사 분석 (예시)'
      )
      noteService.writeContent(
        workspaceId,
        competitorNote.id,
        [
          '# 경쟁사 분석',
          '',
          '| 제품 | 강점 | 약점 |',
          '| --- | --- | --- |',
          '| Notion | 협업, 템플릿 | 오프라인 약함 |',
          '| Obsidian | 로컬 마크다운 | 진입장벽 |',
          '',
          '## 우리의 차별점',
          '- 로컬 SQLite + 마크다운 → 데이터 주권',
          '- AI 통합 (Claude) → 자연어로 워크플로 자동화'
        ].join('\n')
      )

      const projectNote = noteService.create(workspaceId, null, '프로젝트 노트')
      noteService.writeContent(
        workspaceId,
        projectNote.id,
        [
          '# 프로젝트 노트',
          '',
          'Rally를 둘러보는 중이시군요!',
          '',
          '## 추천 동선',
          '1. 좌측 사이드바에서 다른 노트 열어보기',
          '2. **할 일** 페이지에서 샘플 할 일 확인',
          '3. **캔버스**에서 노드 끌어보기',
          '4. **표**에서 행 추가해보기',
          '',
          '> 설정 > AI에서 Claude를 1-click 등록하면, AI가 노트·할 일을 직접 다룰 수 있어요.'
        ].join('\n')
      )

      // ── 3. 표 1개 + 콘텐츠
      const csvFile = csvFileService.create(workspaceId, null, '기능 우선순위')
      const csvPath = path.join(workspacePath, csvFile.relativePath)
      const csvContent = [
        '기능,우선순위,담당,상태',
        '환영 모달,High,팀,진행중',
        '빈 상태 카드,High,팀,진행중',
        '샘플 워크스페이스,High,팀,완료',
        '체크리스트 위젯,Medium,팀,대기',
        '미니 팁,Low,팀,대기'
      ].join('\n')
      fs.writeFileSync(csvPath, csvContent, 'utf-8')

      // ── 4. 캔버스 1개 + 노드 4개 + edge 3개
      const canvas = canvasService.create(workspaceId, {
        title: '프로젝트 흐름',
        description: '기획 → 개발 → QA → 배포'
      })
      const node1 = canvasNodeService.create(canvas.id, {
        type: 'text',
        x: 60,
        y: 60,
        width: 160,
        height: 80,
        content: '기획'
      })
      const node2 = canvasNodeService.create(canvas.id, {
        type: 'text',
        x: 280,
        y: 60,
        width: 160,
        height: 80,
        content: '개발'
      })
      const node3 = canvasNodeService.create(canvas.id, {
        type: 'text',
        x: 500,
        y: 60,
        width: 160,
        height: 80,
        content: 'QA'
      })
      const node4 = canvasNodeService.create(canvas.id, {
        type: 'text',
        x: 720,
        y: 60,
        width: 160,
        height: 80,
        content: '배포'
      })
      canvasEdgeService.create(canvas.id, { fromNode: node1.id, toNode: node2.id })
      canvasEdgeService.create(canvas.id, { fromNode: node2.id, toNode: node3.id })
      canvasEdgeService.create(canvas.id, { fromNode: node3.id, toNode: node4.id })

      // ── 5. 할 일: 부모 1 + 서브 3, 별도 부모 1
      const tourTodo = todoService.create(workspaceId, {
        title: 'Rally 둘러보기',
        priority: 'high'
      })
      todoService.create(workspaceId, {
        title: '노트 1개 열어보기',
        parentId: tourTodo.id
      })
      todoService.create(workspaceId, {
        title: '캔버스에 노드 끌어보기',
        parentId: tourTodo.id
      })
      todoService.create(workspaceId, {
        title: '표에 행 추가해보기',
        parentId: tourTodo.id
      })

      const linkTodo = todoService.create(workspaceId, {
        title: '할 일 ↔ 노트 링크 만들기',
        priority: 'high',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      })

      // ── 6. 일정 1개 (7일 뒤)
      const scheduleStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      scheduleStart.setHours(10, 0, 0, 0)
      const scheduleEnd = new Date(scheduleStart)
      scheduleEnd.setHours(11, 0, 0, 0)
      scheduleService.create(workspaceId, {
        title: 'Rally 사용 후기 작성',
        startAt: scheduleStart,
        endAt: scheduleEnd,
        priority: 'medium'
      })

      // ── 7. 태그 2개 + attach
      const tutorialTag = tagService.create(workspaceId, {
        name: '튜토리얼',
        color: '#3b82f6'
      })
      const sampleTag = tagService.create(workspaceId, {
        name: '예시',
        color: '#6b7280'
      })
      void sampleTag
      itemTagService.attach('note', tutorialTag.id, projectNote.id)
      itemTagService.attach('note', tutorialTag.id, kickoffNote.id)
      itemTagService.attach('todo', tutorialTag.id, tourTodo.id)
      itemTagService.attach('todo', tutorialTag.id, linkTodo.id)
      itemTagService.attach('canvas', tutorialTag.id, canvas.id)

      return { workspaceId, path: workspacePath }
    } catch (err) {
      // Rollback: best-effort cleanup
      if (workspaceId) {
        try {
          workspaceService.delete(workspaceId)
        } catch {
          // ignore — DB may already be partially clean
        }
      }
      try {
        fs.rmSync(workspacePath, { recursive: true, force: true })
      } catch {
        // ignore — fs may already be gone
      }
      throw err
    }
  }
}
