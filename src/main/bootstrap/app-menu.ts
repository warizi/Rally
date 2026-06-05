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
      { role: 'undo' },
      { role: 'redo' },
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
