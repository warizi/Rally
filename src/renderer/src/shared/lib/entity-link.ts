import { Check, Calendar, FileText, ImageIcon, Sheet } from 'lucide-react'
import { PdfIcon } from '@shared/ui/icons/PdfIcon'

export type LinkableEntityType = 'todo' | 'schedule' | 'note' | 'pdf' | 'csv' | 'image'

export interface LinkedEntity {
  entityType: LinkableEntityType
  entityId: string
  title: string
  linkedAt: Date
}

export const ENTITY_TYPE_LABEL: Record<LinkableEntityType, string> = {
  todo: '할 일',
  schedule: '일정',
  note: '노트',
  pdf: 'PDF',
  csv: 'CSV',
  image: '이미지'
}

export const ENTITY_TYPE_ICON: Record<LinkableEntityType, React.ElementType> = {
  todo: Check,
  schedule: Calendar,
  note: FileText,
  pdf: PdfIcon,
  csv: Sheet,
  image: ImageIcon
}
