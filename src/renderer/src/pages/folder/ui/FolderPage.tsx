import { TabContainer } from '@shared/ui/tab-container'
import TabHeader from '@shared/ui/tab-header'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { FolderTree } from '@features/folder/manage-folder'

export function FolderPage(): React.JSX.Element {
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId)

  return (
    <TabContainer
      header={<TabHeader title="파일 탐색기" description="파일 탐색기 관리 페이지입니다." />}
    >
      {workspaceId ? (
        <FolderTree workspaceId={workspaceId} />
      ) : (
        <div className="text-sm text-muted-foreground">워크스페이스를 선택해주세요.</div>
      )}
    </TabContainer>
  )
}
