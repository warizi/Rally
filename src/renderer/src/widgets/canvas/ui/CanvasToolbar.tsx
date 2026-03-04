import { Type, Plus, Map, Undo2, Redo2 } from 'lucide-react'
import { Button } from '@shared/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@shared/ui/tooltip'

interface CanvasToolbarProps {
  onAddText: () => void
  onAddEntity: () => void
  minimap: boolean
  onToggleMinimap: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
}

export function CanvasToolbar({
  onAddText,
  onAddEntity,
  minimap,
  onToggleMinimap,
  onUndo,
  onRedo,
  canUndo,
  canRedo
}: CanvasToolbarProps): React.JSX.Element {
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-background/90 backdrop-blur border rounded-lg shadow-sm px-2 py-1">
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-3" onClick={onAddText}>
              <Type className="size-4 mr-1.5" />
              텍스트
            </Button>
          </TooltipTrigger>
          <TooltipContent>텍스트 노드 추가</TooltipContent>
        </Tooltip>

        <div className="w-px h-5 bg-border" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-3" onClick={onAddEntity}>
              <Plus className="size-4 mr-1.5" />
              요소 추가
            </Button>
          </TooltipTrigger>
          <TooltipContent>할일, 노트, 일정 등 추가</TooltipContent>
        </Tooltip>

        <div className="w-px h-5 bg-border" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onUndo}
              disabled={!canUndo}
            >
              <Undo2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>실행취소 (⌘Z)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onRedo}
              disabled={!canRedo}
            >
              <Redo2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>다시실행 (⌘⇧Z)</TooltipContent>
        </Tooltip>

        <div className="w-px h-5 bg-border" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 px-3 ${minimap ? 'bg-accent' : ''}`}
              onClick={onToggleMinimap}
            >
              <Map className="size-4 mr-1.5" />
              미리보기
            </Button>
          </TooltipTrigger>
          <TooltipContent>미니맵 {minimap ? '숨기기' : '보기'}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
