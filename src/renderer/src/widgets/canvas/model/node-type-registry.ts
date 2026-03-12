import { Type, Check, FileText, Calendar, Sheet, ImageIcon, Network } from 'lucide-react'
import { PdfIcon } from '@shared/ui/icons/PdfIcon'
import { TodoNodeContent } from '../ui/node-content/TodoNodeContent'
import { NoteNodeContent } from '../ui/node-content/NoteNodeContent'
import { ScheduleNodeContent } from '../ui/node-content/ScheduleNodeContent'
import { CsvNodeContent } from '../ui/node-content/CsvNodeContent'
import { PdfNodeContent } from '../ui/node-content/PdfNodeContent'
import { ImageNodeContent } from '../ui/node-content/ImageNodeContent'
import { CanvasNodeContent } from '../ui/node-content/CanvasNodeContent'
import type { NodeContentProps } from './node-content-registry'
import type { CanvasNodeType } from '@entities/canvas'

export interface NodeTypeConfig {
  component: React.ComponentType<NodeContentProps> | null
  icon: React.ElementType
  label: string
  defaultWidth: number
  defaultHeight: number
  resizable: boolean
  pickable: boolean
}

export const NODE_TYPE_REGISTRY: Record<CanvasNodeType, NodeTypeConfig> = {
  text: {
    component: null,
    icon: Type,
    label: '텍스트',
    defaultWidth: 260,
    defaultHeight: 160,
    resizable: true,
    pickable: false
  },
  todo: {
    component: TodoNodeContent,
    icon: Check,
    label: '할 일',
    defaultWidth: 260,
    defaultHeight: 160,
    resizable: true,
    pickable: true
  },
  note: {
    component: NoteNodeContent,
    icon: FileText,
    label: '노트',
    defaultWidth: 300,
    defaultHeight: 240,
    resizable: true,
    pickable: true
  },
  schedule: {
    component: ScheduleNodeContent,
    icon: Calendar,
    label: '일정',
    defaultWidth: 260,
    defaultHeight: 160,
    resizable: false,
    pickable: true
  },
  csv: {
    component: CsvNodeContent,
    icon: Sheet,
    label: 'CSV',
    defaultWidth: 360,
    defaultHeight: 280,
    resizable: true,
    pickable: true
  },
  pdf: {
    component: PdfNodeContent,
    icon: PdfIcon,
    label: 'PDF',
    defaultWidth: 280,
    defaultHeight: 360,
    resizable: true,
    pickable: true
  },
  image: {
    component: ImageNodeContent,
    icon: ImageIcon,
    label: '이미지',
    defaultWidth: 300,
    defaultHeight: 260,
    resizable: true,
    pickable: true
  },
  canvas: {
    component: CanvasNodeContent,
    icon: Network,
    label: '캔버스',
    defaultWidth: 280,
    defaultHeight: 200,
    resizable: true,
    pickable: true
  }
}

export const PICKABLE_TYPES = Object.entries(NODE_TYPE_REGISTRY)
  .filter(([, config]) => config.pickable)
  .map(([type, config]) => ({
    type: type as CanvasNodeType,
    icon: config.icon,
    label: config.label
  }))
