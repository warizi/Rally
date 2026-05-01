import { FileText, Folder, ImageIcon, Network, Sheet } from 'lucide-react'
import { PdfIcon } from '@shared/ui/icons/PdfIcon'

export type EntityIconKind = 'folder' | 'note' | 'csv' | 'pdf' | 'image' | 'canvas'

/** 엔티티 종류별 아이콘 컴포넌트 (트리·히스토리·드래그 오버레이 공통) */
export const ENTITY_ICON: Record<EntityIconKind, React.ElementType> = {
  folder: Folder,
  note: FileText,
  csv: Sheet,
  pdf: PdfIcon,
  image: ImageIcon,
  canvas: Network
}

/** 엔티티 종류별 아이콘 색상 (Tailwind 500 톤) */
export const ENTITY_ICON_COLOR: Record<EntityIconKind, string> = {
  folder: '#f59e0b',
  note: '#3b82f6',
  csv: '#10b981',
  pdf: '#ef4444',
  image: '#0ea5e9',
  canvas: '#a855f7'
}

/** 탭 아이콘 종류 → 엔티티 아이콘 종류 매핑 (해당 없는 종류는 undefined) */
const TAB_ICON_TO_ENTITY: Partial<Record<string, EntityIconKind>> = {
  folder: 'folder',
  note: 'note',
  csv: 'csv',
  pdf: 'pdf',
  image: 'image',
  canvas: 'canvas',
  'canvas-detail': 'canvas'
}

export function getEntityColorByTabIcon(tabIcon: string): string | undefined {
  const kind = TAB_ICON_TO_ENTITY[tabIcon]
  return kind ? ENTITY_ICON_COLOR[kind] : undefined
}
