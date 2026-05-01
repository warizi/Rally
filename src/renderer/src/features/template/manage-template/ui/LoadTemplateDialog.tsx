import { JSX, useMemo, useState } from 'react'
import { Search, Trash2, FileText } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@shared/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@shared/ui/alert-dialog'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { ScrollArea } from '@shared/ui/scroll-area'
import { cn } from '@shared/lib/utils'
import {
  useDeleteTemplate,
  useTemplates,
  type Template,
  type TemplateType
} from '@entities/template'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  type: TemplateType
  hasContent: boolean
  onApply: (jsonData: string) => void
}

export function LoadTemplateDialog({
  open,
  onOpenChange,
  workspaceId,
  type,
  hasContent,
  onApply
}: Props): JSX.Element {
  const { data: templates = [] } = useTemplates(workspaceId, type)
  const { mutate: deleteTemplate } = useDeleteTemplate()
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pendingApply, setPendingApply] = useState<Template | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return templates
    return templates.filter((t) => t.title.toLowerCase().includes(q))
  }, [templates, query])

  const selected = templates.find((t) => t.id === selectedId) ?? null

  const handleApplyClick = (): void => {
    if (!selected) return
    if (hasContent) {
      setPendingApply(selected)
      return
    }
    applyTemplate(selected)
  }

  const applyTemplate = (template: Template): void => {
    onApply(template.jsonData)
    onOpenChange(false)
    setQuery('')
    setSelectedId(null)
  }

  const handleDelete = (template: Template): void => {
    deleteTemplate(
      { id: template.id, workspaceId, type },
      {
        onSuccess: () => {
          toast.success('템플릿이 삭제되었습니다')
          if (selectedId === template.id) setSelectedId(null)
        },
        onError: (err) => {
          toast.error(`삭제에 실패했습니다: ${err.message}`)
        }
      }
    )
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          onOpenChange(next)
          if (!next) {
            setQuery('')
            setSelectedId(null)
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>템플릿 불러오기</DialogTitle>
            <DialogDescription>저장된 템플릿을 선택하여 적용합니다.</DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="템플릿 검색..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>

          <ScrollArea className="h-72 rounded-md border">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground py-12">
                <FileText className="size-8" />
                <p className="text-sm">
                  {templates.length === 0 ? '저장된 템플릿이 없습니다' : '검색 결과가 없습니다'}
                </p>
              </div>
            ) : (
              <ul className="p-1">
                {filtered.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      onDoubleClick={() => {
                        setSelectedId(t.id)
                        if (hasContent) {
                          setPendingApply(t)
                        } else {
                          applyTemplate(t)
                        }
                      }}
                      className={cn(
                        'group w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-left text-sm',
                        'transition-colors',
                        selectedId === t.id
                          ? 'bg-accent text-accent-foreground'
                          : 'hover:bg-accent/50'
                      )}
                    >
                      <span className="truncate">{t.title}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-6 shrink-0 opacity-0 group-hover:opacity-100 hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(t)
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button onClick={handleApplyClick} disabled={!selected}>
              적용
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingApply !== null}
        onOpenChange={(next) => !next && setPendingApply(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>기존 내용을 덮어씁니다</AlertDialogTitle>
            <AlertDialogDescription>
              현재 작성된 내용이 템플릿 내용으로 덮어쓰여집니다. 계속하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingApply) applyTemplate(pendingApply)
                setPendingApply(null)
              }}
            >
              덮어쓰기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
