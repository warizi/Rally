import { app, Menu, type MenuItemConstructorOptions } from 'electron'
import { is } from '@electron-toolkit/utils'

/** 애플리케이션 메뉴 구성 (macOS app 메뉴 + Edit/View/Window). */
export function setupAppMenu(): void {
  const isMac = process.platform === 'darwin'
  const template: MenuItemConstructorOptions[] = []

  if (isMac) {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    })
  }

  template.push({
    label: 'Edit',
    submenu: [
      // registerAccelerator:false — 단축키는 메뉴에 표시만 하고 OS 에 등록하지 않는다.
      // 등록하면 macOS redo role 이 Cmd+Shift+Z 를 가로채, editable 이 포커스되지 않은
      // 캔버스에서 렌더러 keydown 핸들러까지 이벤트가 도달하지 못한다(캔버스 redo 미동작).
      // 노트(Milkdown)/CSV 는 각자 keydown 으로 undo/redo 를 처리하므로 영향 없다.
      { role: 'undo', registerAccelerator: false },
      { role: 'redo', registerAccelerator: false },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' }
    ]
  })

  const viewSubmenu: MenuItemConstructorOptions[] = []
  if (is.dev) {
    viewSubmenu.push(
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' }
    )
  }
  viewSubmenu.push({ role: 'togglefullscreen' })
  template.push({ label: 'View', submenu: viewSubmenu })

  const windowSubmenu: MenuItemConstructorOptions[] = [{ role: 'minimize' }, { role: 'zoom' }]
  if (isMac) {
    windowSubmenu.push({ type: 'separator' }, { role: 'front' })
  }
  template.push({ role: 'windowMenu', label: 'Window', submenu: windowSubmenu })

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
