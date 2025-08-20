// window-manager.js - 窗口管理模块
import { BrowserWindow, screen } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import Logger from '../utils/logger.js'

// ES 模块中的 __dirname 替代方案
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

class WindowManager {
  constructor() {
    this.controlWin = null
    this.projectorWin = null
  }

  createControlWindow() {
    this.controlWin = new BrowserWindow({
      width: 400,//420,
      height: 550,//560,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      movable: true,
      resizable: false,
      skipTaskbar: false,
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    // 添加窗口焦点事件监听
    this.controlWin.on('focus', () => {
      // 确保control窗口保持置顶
      this.controlWin.setAlwaysOnTop(true)
      
      // 确保投影窗口保持全屏和置顶状态
      if (this.projectorWin && !this.projectorWin.isDestroyed()) {
        this.projectorWin.setFullScreen(true)
        this.projectorWin.setAlwaysOnTop(true, 'screen-saver', 1)
        this.projectorWin.moveTop()
      }
    })
    
    // 控制窗口关闭时也关闭投影窗口
    this.controlWin.on('closed', () => {
      if (this.projectorWin && !this.projectorWin.isDestroyed()) {
        this.projectorWin.destroy()
        this.projectorWin = null
        Logger.info('Projector window closed when control window closed')
      }
      this.controlWin = null
    })
    
    this.controlWin.loadFile(path.join(__dirname, '..', '..', 'renderer', 'control.html'))
    
    return this.controlWin
  }

  createProjectorWindow(display) {
    const bounds = display.bounds
    this.projectorWin = new BrowserWindow({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      frame: false,
      fullscreen: false,
      movable: false,
      resizable: false,
      focusable: true,
      transparent: false,
      alwaysOnTop: true,
      skipTaskbar: false,
      minimizable: false,
      maximizable: false,
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    })
    
    this.projectorWin.loadFile(path.join(__dirname, '..', '..', 'renderer', 'projector.html'))
    
    // 确保窗口覆盖任务栏
    this.projectorWin.once('ready-to-show', () => {
      this.projectorWin.setBounds({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
      })
      this.projectorWin.setFullScreen(true)
      this.projectorWin.setAlwaysOnTop(true, 'screen-saver', 1)
      this.projectorWin.moveTop()
      this.projectorWin.show()

      Logger.info('Projector window created and shown')
    })
    
    // 监听投影窗口关闭事件
    this.projectorWin.on('closed', () => {
      this.projectorWin = null
      if (this.controlWin && !this.controlWin.isDestroyed()) {
        this.controlWin.webContents.send('projector-closed')
        this.controlWin.webContents.send('display-info', {
          id: null,
          width: 16,
          height: 9
        })
      }
    })
    
    return this.projectorWin
  }

  showOrCreateProjector(store) {
    const displays = screen.getAllDisplays()
    const id = store.get('projectorDisplayId') ?? displays[displays.length - 1]?.id
    const target = displays.find(d => d.id === id) || displays[displays.length - 1]
    
    if (!this.projectorWin || this.projectorWin.isDestroyed()) {
      Logger.info('Creating new projector window for display:', target)
      this.createProjectorWindow(target)
      this.controlWin.webContents.send('display-info', {
        id: target.id,
        width: target.size.width,
        height: target.size.height
      })
    } else {
      Logger.info('Showing existing projector window for display:', target)
      this.projectorWin.showInactive()
    }
  }

  destroyProjector() {
    if (this.projectorWin && !this.projectorWin.isDestroyed()) {
      this.projectorWin.destroy()
      this.projectorWin = null
      if (this.controlWin && !this.controlWin.isDestroyed()) {
        this.controlWin.webContents.send('display-info', {
          id: null,
          width: 16,
          height: 9
        })
        Logger.info('Projector window destroyed and display info sent to control window')
      }
    } else {
      Logger.warn('Attempted to destroy non-existent projector window')
    }
  }

  resizeControlWindow(width = -1, height = -1) {
    try {
      if (this.controlWin && !this.controlWin.isDestroyed()) {
        const currentSize = this.controlWin.getContentSize()
        const adjustedWidth = width
        this.controlWin.setContentSize(adjustedWidth, currentSize[1])
        Logger.info('Control window resized:', adjustedWidth, currentSize[1])
        return true
      }
      return false
    } catch (error) {
      Logger.error('Failed to resize window:', error)
      return false
    }
  }

  hideControlWindow() {
    if (this.controlWin && !this.controlWin.isDestroyed()) {
      this.controlWin.hide()
    }
    this.destroyProjector()
    Logger.info('Control window hidden and projector destroyed')
  }

  showControlWindow() {
    if (this.controlWin) {
      if (this.controlWin.isMinimized()) {
        this.controlWin.restore()
        Logger.info('Control window restored from minimized state')
      }
      if (!this.controlWin.isVisible()) {
        this.controlWin.show()
        Logger.info('Control window shown')
      }
      this.controlWin.focus()
      this.controlWin.setAlwaysOnTop(true)
    } else {
      Logger.warn('Attempted to show non-existent control window')
    }
  }

  getControlWindow() {
    return this.controlWin
  }

  getProjectorWindow() {
    return this.projectorWin
  }

  cleanup() {
    if (this.projectorWin && !this.projectorWin.isDestroyed()) {
      this.projectorWin.destroy()
      this.projectorWin = null
      Logger.info('Projector window destroyed')
    }
  }
}

export default WindowManager
