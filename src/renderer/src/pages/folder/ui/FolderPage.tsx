import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { FolderTree } from '@features/folder/manage-folder'

// PageProps 대신 tabId만 인라인 타입으로 선언 (FSD 위반 방지: pages → app 금지)
//
// [TabContainer 규칙의 의도된 예외 — AGENTS.md "Tab Page Responsive Layout" 참고]
// FolderTree 가 full-height 가상화 scroll 컨테이너(ScrollArea viewportRef + useVirtualizer
// scrollElement)를 직접 소유한다. 이 페이지를 TabContainer(scrollable=false 포함)로 감싸면
// padding/래퍼 div 가 끼어 scroll target 이 바뀌고 가상화·DnD 가 깨진다. 또한 folder 기능은
// container query(@container / @[..]:)를 쓰지 않아 @container 컨텍스트가 필요 없다.
// 이 예외는 FolderPage.test.tsx 가 회귀로 잠근다 (TabContainer wrap 추가 시 실패).
export function FolderPage({ tabId }: { tabId?: string }): React.JSX.Element {
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId)

  if (!workspaceId) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        워크스페이스를 선택해주세요.
      </div>
    )
  }

  return <FolderTree workspaceId={workspaceId} tabId={tabId} />
}
