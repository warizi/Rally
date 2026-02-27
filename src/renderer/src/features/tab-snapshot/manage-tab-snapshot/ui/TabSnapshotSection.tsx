import { JSX, useState } from 'react'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@shared/ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton
} from '@shared/ui/sidebar'
import { ScrollArea } from '@shared/ui/scroll-area'
import { useTabSnapshots } from '@entities/tab-snapshot'
import type { TabSnapshot } from '@entities/tab-snapshot'
import { TabSnapshotItem } from './TabSnapshotItem'
import { SaveSnapshotDialog } from './SaveSnapshotDialog'
import { EditSnapshotDialog } from './EditSnapshotDialog'
import { DeleteSnapshotDialog } from './DeleteSnapshotDialog'

interface Props {
  workspaceId: string
  onRestoreSnapshot: (snapshot: TabSnapshot) => void
  onOverwriteSnapshot: (snapshot: TabSnapshot) => void
}

export function TabSnapshotSection({
  workspaceId,
  onRestoreSnapshot,
  onOverwriteSnapshot
}: Props): JSX.Element {
  const [isOpen, setIsOpen] = useState(true)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<TabSnapshot | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TabSnapshot | null>(null)

  const { data: snapshots = [] } = useTabSnapshots(workspaceId)

  return (
    <>
      <SidebarGroup>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <SidebarGroupLabel asChild>
            <CollapsibleTrigger className="flex w-full items-center justify-between">
              <span>탭 스냅샷</span>
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </CollapsibleTrigger>
          </SidebarGroupLabel>

          <CollapsibleContent>
            <SidebarGroupContent>
              <SidebarMenu>
                <ScrollArea>
                  <div className="max-h-[400px]">
                    {snapshots.map((snapshot) => (
                      <TabSnapshotItem
                        key={snapshot.id}
                        snapshot={snapshot}
                        onRestore={() => onRestoreSnapshot(snapshot)}
                        onOverwrite={() => onOverwriteSnapshot(snapshot)}
                        onEdit={() => setEditTarget(snapshot)}
                        onDelete={() => setDeleteTarget(snapshot)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </SidebarMenu>

              <div className="sticky bottom-0 py-1">
                <SidebarMenuButton
                  size="sm"
                  className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={() => setSaveDialogOpen(true)}
                  tooltip={'현재 탭 저장'}
                >
                  <Plus className="h-4 w-4" />
                  현재 탭 저장
                </SidebarMenuButton>
              </div>
            </SidebarGroupContent>
          </CollapsibleContent>
        </Collapsible>
      </SidebarGroup>

      <SaveSnapshotDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        workspaceId={workspaceId}
      />
      <EditSnapshotDialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null)
        }}
        snapshot={editTarget}
      />
      <DeleteSnapshotDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        snapshot={deleteTarget}
      />
    </>
  )
}
