// system-manager.js - 系统管理模块
import { app, globalShortcut, Menu, Tray } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import Logger from '../utils/logger.js'

// ES 模块中的 __dirname 替代方案
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

class SystemManager {
  constructor(windowManager, store) {
    this.windowManager = windowManager
    this.store = store
    this.tray = null
  }

  createTray() {
    this.tray = new Tray(process.platform === 'win32'
      ? path.join(__dirname, '..', '..', 'assets', 'icon.ico')
      : path.join(__dirname, '..', '..', 'assets', 'icon.png'))
    
    const contextMenu = Menu.buildFromTemplate([
      { 
        label: '显示控制窗', 
        click: () => {
          this.windowManager.showControlWindow()
          Logger.log('Tray item [显示控制窗] clicked')
        }
      },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() }
    ])
    
    this.tray.setToolTip('投影控制')
    this.tray.setContextMenu(contextMenu)
    
    this.tray.on('click', () => {
      this.windowManager.showControlWindow()
      Logger.log('Tray icon clicked')
    })

    Logger.log('Tray setup complete')
  }

  registerHotkey() {
    const key = this.store.get('keyShowControl') || 'Shift+Space'
    Logger.log('Registering hotkey:', key)
    globalShortcut.unregisterAll()
    
    const result = globalShortcut.register(key, () => {
      Logger.log('Hotkey pressed:', key)
      const controlWin = this.windowManager.getControlWindow()
      if (!controlWin) return
      
      if (controlWin.isVisible()) {
        controlWin.hide()
      } else {
        controlWin.show()
      }
    })
    
    if (!result) {
      Logger.error('Failed to register hotkey:', key)
    }

    Logger.log('Hotkey registration complete')
  }

  setAutoLaunch(enable) {
    app.setLoginItemSettings({
      openAtLogin: !!enable,
      path: process.execPath,
    })

    Logger.log('Auto-launch setting updated:', enable)
  }

  setupSingleInstance() {
    const gotTheLock = app.requestSingleInstanceLock()
    if (!gotTheLock) {
      Logger.log('Another instance is running. Focusing on the existing one.')
      app.quit()
      return false
    }
    return true
  }

  setupAppEvents() {
    app.on('window-all-closed', (e) => {
      // 常驻托盘，不退出
      e.preventDefault()
      Logger.log('All windows closed, minimizing to tray')
    })

    app.on('before-quit', () => {
      Logger.log('App is about to quit')
      this.windowManager.cleanup()
      globalShortcut.unregisterAll()
    })
  }

  cleanup() {
    Logger.log('Cleaning up SystemManager resources')
    globalShortcut.unregisterAll()
  }
}

export default SystemManager
