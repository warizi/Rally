import { ipcMain, IpcMainInvokeEvent, IpcMainEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { terminalService } from '../services/terminal'

export function registerTerminalHandlers(): void {
  ipcMain.handle(
    'terminal:create',
    (_: IpcMainInvokeEvent, args: { cwd: string; cols: number; rows: number }): IpcResponse =>
      handle(() => terminalService.create(args.cwd, args.cols, args.rows))
  )

  ipcMain.handle(
    'terminal:destroy',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_: IpcMainInvokeEvent): IpcResponse => handle(() => terminalService.destroy())
  )

  ipcMain.on('terminal:write', (_: IpcMainEvent, args: { data: string }) => {
    terminalService.write(args.data)
  })

  ipcMain.on('terminal:resize', (_: IpcMainEvent, args: { cols: number; rows: number }) => {
    terminalService.resize(args.cols, args.rows)
  })
}
