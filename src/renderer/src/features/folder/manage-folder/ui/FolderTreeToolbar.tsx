import type { JSX } from 'react'
import {
  ChevronsDownUp,
  FilePlus,
  FileText,
  FileUp,
  FolderPlus,
  ImageIcon,
  Search,
  Sheet
} from 'lucide-react'
import { Button } from '@shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@shared/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@shared/ui/tooltip'
import type { FolderCreateHandlers } from '../model/use-folder-create-handlers'

interface Props {
  createHandlers: FolderCreateHandlers
  onCollapseAll: () => void
  onCreateFolder: () => void
  onToggleSearch: () => void
}

/**
 * FolderTree 상단 툴바.
 *
 * - 모두 접기 버튼
 * - 노트 / 테이블 dropdown (가져오기 + 추가)
 * - PDF / 이미지 가져오기 버튼
 * - 폴더 추가 버튼 (root)
 */
export function FolderTreeToolbar({
  createHandlers,
  onCollapseAll,
  onCreateFolder,
  onToggleSearch
}: Props): JSX.Element {
  const {
    handleCreateNote,
    handleCreateCsv,
    handleImportNote,
    handleImportCsv,
    handleImportPdf,
    handleImportImage
  } = createHandlers

  return (
    <div className="flex items-center justify-between py-1 shrink-0 border-b">
      <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        탐색기
      </span>
      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 cursor-pointer"
              onClick={onToggleSearch}
            >
              <Search className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>검색</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 cursor-pointer"
              onClick={onCollapseAll}
            >
              <ChevronsDownUp className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>모두 접기</TooltipContent>
        </Tooltip>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-6 cursor-pointer">
                  <FileText className="size-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>노트</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => handleImportNote(null)}>
              <FileUp className="size-4 mr-2" />
              노트 가져오기
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleCreateNote(null)}>
              <FilePlus className="size-4 mr-2" />
              노트 추가하기
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-6 cursor-pointer">
                  <Sheet className="size-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>테이블</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => handleCreateCsv(null)}>
              <FilePlus className="size-4 mr-2" />
              테이블 추가하기
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleImportCsv(null)}>
              <FileUp className="size-4 mr-2" />
              테이블 가져오기
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 cursor-pointer"
              onClick={() => handleImportPdf(null)}
            >
              <FileUp className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>PDF 가져오기</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 cursor-pointer"
              onClick={() => handleImportImage(null)}
            >
              <ImageIcon className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>이미지 가져오기</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 cursor-pointer"
              onClick={onCreateFolder}
            >
              <FolderPlus className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>폴더 추가</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
