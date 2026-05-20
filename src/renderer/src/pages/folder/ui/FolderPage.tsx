import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { FolderTree } from '@features/folder/manage-folder'

// PageProps 대신 tabId만 인라인 타입으로 선언 (FSD 위반 방지: pages → app 금지)
// 스크롤 컨테이너는 FolderTree 가 자체적으로 보유 (가상화 scrollElement 와 일체).
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
