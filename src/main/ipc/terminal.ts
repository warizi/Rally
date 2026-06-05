import { ipcMain, IpcMainEvent } from 'electron'
import { validateIpc, idSchema } from '../lib/ipc-validate'
import {
  terminalCreateSchema,
  terminalUpdateSessionSchema,
  contentSchema,
  jsonStringSchema
} from './schemas'
import { nanoid } from 'nanoid'
import { terminalService } from '../services/terminal'
import { terminalSessionRepository } from '../repositories/terminal-session'
import { terminalLayoutRepository } from '../repositories/terminal-layout'

export function registerTerminalHandlers(): void {
  // PTY 생성 → 동일 ID를 PTY 서비스와 DB 세션 양쪽에 사용.
  // 보안-1 Phase 3: cwd / shell / cols / rows / id zod 검증.
  ipcMain.handle(
    'terminal:create',
    validateIpc([terminalCreateSchema], (args) => {
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

  // 단일 PTY kill — 보안-1 Phase 3: nanoid 형식 검증.
  ipcMain.handle(
    'terminal:destroy',
    validateIpc([idSchema], (id) => terminalService.destroy(id))
  )

  // 워크스페이스의 모든 PTY kill — 보안-1 Phase 3: nanoid 검증.
  ipcMain.handle(
    'terminal:destroyAll',
    validateIpc([idSchema], (workspaceId) => terminalService.destroyAll(workspaceId))
  )

  // 키 입력 (fire-and-forget) — ipcMain.on 이라 invoke 응답 없음.
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
    validateIpc([idSchema, contentSchema] as const, (id, snapshot) =>
      terminalSessionRepository.saveSnapshot(id, snapshot)
    )
  )

  // DB: 워크스페이스의 활성 세션 목록
  ipcMain.handle(
    'terminal:getSessions',
    validateIpc([idSchema], (workspaceId) =>
      terminalSessionRepository.findActiveByWorkspaceId(workspaceId)
    )
  )

  // DB: 레이아웃 조회
  ipcMain.handle(
    'terminal:getLayout',
    validateIpc(
      [idSchema],
      (workspaceId) => terminalLayoutRepository.findByWorkspaceId(workspaceId) ?? null
    )
  )

  // DB: 세션 메타 갱신 (이름, cwd, rows, cols)
  ipcMain.handle(
    'terminal:updateSession',
    validateIpc([idSchema, terminalUpdateSessionSchema] as const, (id, data) =>
      terminalSessionRepository.update(id, data)
    )
  )

  // DB: 레이아웃 저장 (upsert)
  ipcMain.handle(
    'terminal:saveLayout',
    validateIpc([idSchema, jsonStringSchema] as const, (workspaceId, layoutJson) =>
      terminalLayoutRepository.upsert(workspaceId, layoutJson)
    )
  )

  // DB: 탭 소프트 삭제
  ipcMain.handle(
    'terminal:closeSession',
    validateIpc([idSchema], (id) => terminalSessionRepository.softDelete(id))
  )
}
