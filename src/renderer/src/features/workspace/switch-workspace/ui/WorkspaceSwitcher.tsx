import { JSX, useState } from 'react'
import { ChevronsUpDown, Plus, Check, Pencil, Trash2, Download } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@shared/ui/dropdown-menu'
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@shared/ui/sidebar'
import { toast } from 'sonner'
import { useWorkspaceSwitch } from '../model/useWorkspaceSwitch'
import { useExportBackup } from '@features/workspace/backup-workspace'
import { CreateWorkspaceDialog } from './CreateWorkspaceDialog'
import { EditWorkspaceDialog } from './EditWorkspaceDialog'
import { DeleteWorkspaceDialog } from './DeleteWorkspaceDialog'

export function WorkspaceSwitcher(): JSX.Element {
  const {
    workspaces,
    currentWorkspaceId,
    currentWorkspace,
    handleSwitch,
    handleCreated,
    handleDeleted,
    isLastWorkspace
  } = useWorkspaceSwitch()

  const { mutate: exportBackup } = useExportBackup()

  const handleExport = (): void => {
    if (!currentWorkspaceId) return
    exportBackup(currentWorkspaceId, {
      onSuccess: () => toast.success('백업이 완료되었습니다.'),
      onError: () => toast.error('백업에 실패했습니다.')
    })
  }

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton className="cursor-pointer" tooltip="워크스페이스 전환">
                <span className="flex size-5 group-data-[collapsible=icon]:size-4 items-center justify-center rounded-md group-data-[collapsible=icon]:rounded-sm bg-primary text-primary-foreground text-xs font-bold shrink-0">
                  {(currentWorkspace?.name ?? 'W').charAt(0).toUpperCase()}
                </span>
                <span className="truncate font-semibold">
                  {currentWorkspace?.name ?? '워크스페이스'}
                </span>
                <ChevronsUpDown className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start">
              {workspaces?.map((workspace) => (
                <DropdownMenuItem
                  key={workspace.id}
                  onClick={() => handleSwitch(workspace.id)}
                  className="cursor-pointer"
                >
                  <span className="truncate">{workspace.name}</span>
                  {workspace.id === currentWorkspaceId && <Check className="ml-auto size-4" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setCreateOpen(true)} className="cursor-pointer">
                <Plus className="size-4 mr-2" />
                워크스페이스 추가
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setEditOpen(true)} className="cursor-pointer">
                <Pencil className="size-4 mr-2" />
                이름 변경
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExport} className="cursor-pointer">
                <Download className="size-4 mr-2" />
                백업 내보내기
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setDeleteOpen(true)}
                className="cursor-pointer text-destructive focus:text-destructive"
                disabled={isLastWorkspace}
              >
                <Trash2 className="size-4 mr-2" />
                워크스페이스 삭제
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
      <CreateWorkspaceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />
      <EditWorkspaceDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        workspace={currentWorkspace ?? null}
      />
      <DeleteWorkspaceDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        workspace={currentWorkspace ?? null}
        onDeleted={handleDeleted}
        disabled={isLastWorkspace}
      />
    </>
  )
}
