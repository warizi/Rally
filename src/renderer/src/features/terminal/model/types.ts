export interface TerminalSession {
  id: string
  name: string
  cwd: string
  shell: string
  rows: number
  cols: number
  screenSnapshot: string | null
  sortOrder: number
}

export type TerminalLayoutNode =
  | { type: 'leaf'; sessionId: string }
  | { type: 'h' | 'v'; ratio: number; children: [TerminalLayoutNode, TerminalLayoutNode] }
