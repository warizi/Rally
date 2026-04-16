import { ipcMain, IpcMainInvokeEvent, IpcMainEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { nanoid } from 'nanoid'
import { terminalService } from '../services/terminal'
import { terminalSessionRepository } from '../repositories/terminal-session'
import { terminalLayoutRepository } from '../repositories/terminal-layout'

export function registerTerminalHandlers(): void {
  // PTY 생성 → 동일 ID를 PTY 서비스와 DB 세션 양쪽에 사용
  ipcMain.handle(
    'terminal:create',
    (
      _: IpcMainInvokeEvent,
      args: {
        workspaceId: string
        cwd: string
        shell?: string
        cols: number
        rows: number
        id?: string // 복원 시 기존 DB 세션 ID 전달, 신규 시 생략
        sortOrder?: number // 신규 탭의 순서 (기본 0)
      }
    ): IpcResponse<{ id: string }> =>
      handle(() => {
        const id = args.id ?? nanoid()
        terminalService.create(id, args.workspaceId, args.cwd, args.shell, args.cols, args.rows)

        if (!args.id) {
          // 신규 탭: DB 세션 레코드도 생성 — sortOrder는 호출자가 전달
          terminalSessionRepository.create({
            id,
            workspaceId: args.workspaceId,
            layoutId: null,
            name: 'zsh',
            cwd: args.cwd,
            shell: args.shell ?? 'zsh',
            rows: args.rows,
            cols: args.cols,
            screenSnapshot: null,
            sortOrder: args.sortOrder ?? 0,
            isActive: 1
          })
        }
        return { id }
      })
  )

  // 단일 PTY kill
  ipcMain.handle(
    'terminal:destroy',
    (_: IpcMainInvokeEvent, id: string): IpcResponse => handle(() => terminalService.destroy(id))
  )

  // 워크스페이스의 모든 PTY kill
  ipcMain.handle(
    'terminal:destroyAll',
    (_: IpcMainInvokeEvent, workspaceId: string): IpcResponse =>
      handle(() => terminalService.destroyAll(workspaceId))
  )

  // 키 입력 (fire-and-forget)
  ipcMain.on('terminal:write', (_: IpcMainEvent, args: { id: string; data: string }) => {
    terminalService.write(args.id, args.data)
  })

  // 리사이즈 (fire-and-forget)
  ipcMain.on(
    'terminal:resize',
    (_: IpcMainEvent, args: { id: string; cols: number; rows: number }) => {
      terminalService.resize(args.id, args.cols, args.rows)
    }
  )

  // 스냅샷 저장 (id = DB 세션 ID = PTY ID → 동일하게 동작)
  ipcMain.handle(
    'terminal:saveSnapshot',
    (_: IpcMainInvokeEvent, id: string, snapshot: string): IpcResponse =>
      handle(() => terminalSessionRepository.saveSnapshot(id, snapshot))
  )

  // DB: 워크스페이스의 활성 세션 목록
  ipcMain.handle(
    'terminal:getSessions',
    (_: IpcMainInvokeEvent, workspaceId: string): IpcResponse =>
      handle(() => terminalSessionRepository.findActiveByWorkspaceId(workspaceId))
  )

  // DB: 레이아웃 조회
  ipcMain.handle(
    'terminal:getLayout',
    (_: IpcMainInvokeEvent, workspaceId: string): IpcResponse =>
      handle(() => terminalLayoutRepository.findByWorkspaceId(workspaceId) ?? null)
  )

  // DB: 세션 메타 갱신 (이름, cwd, rows, cols)
  ipcMain.handle(
    'terminal:updateSession',
    (
      _: IpcMainInvokeEvent,
      id: string,
      data: Parameters<typeof terminalSessionRepository.update>[1]
    ): IpcResponse => handle(() => terminalSessionRepository.update(id, data))
  )

  // DB: 레이아웃 저장 (upsert)
  ipcMain.handle(
    'terminal:saveLayout',
    (_: IpcMainInvokeEvent, workspaceId: string, layoutJson: string): IpcResponse =>
      handle(() => terminalLayoutRepository.upsert(workspaceId, layoutJson))
  )

  // DB: 탭 소프트 삭제
  ipcMain.handle(
    'terminal:closeSession',
    (_: IpcMainInvokeEvent, id: string): IpcResponse =>
      handle(() => terminalSessionRepository.softDelete(id))
  )
}
