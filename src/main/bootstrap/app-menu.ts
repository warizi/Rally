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
      // undo/redo 는 의도적으로 메뉴에서 제외한다. 메뉴에 두면 macOS 에서 Cmd+Z /
      // Cmd+Shift+Z 가 OS accelerator 로 등록돼, editable 이 포커스되지 않은 캔버스에서
      // 렌더러 keydown 핸들러까지 이벤트가 도달하지 못한다. undo/redo 는 각 에디터/캔버스가
      // 자체 keydown 으로 처리한다(노트 Milkdown, CSV, 캔버스 history).
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
