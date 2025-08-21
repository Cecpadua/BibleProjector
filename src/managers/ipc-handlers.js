// ipc-handlers.js - IPC通信处理模块
import { ipcMain, screen, shell } from 'electron'
import { getVersesByRef, getBookSuggestions, getVerseRange } from '../db.js'
import Logger from '../utils/logger.js'

class IPCHandlers {
  constructor(windowManager, settingsManager, store) {
    this.windowManager = windowManager
    this.settingsManager = settingsManager
    this.store = store
    this.setupHandlers()
  }

  setupHandlers() {
    // 窗口控制
    ipcMain.handle('window:hide', () => {
      this.windowManager.hideControlWindow()
    })

    ipcMain.handle('window:resize', async (e, width, height) => {
      return this.windowManager.resizeControlWindow(width, height)
    })

    // 搜索相关
    ipcMain.handle('search:query', async (e, queryText) => {
      try {
        const result = await getVersesByRef(queryText)
        Logger.log('查询结果:', result)
        return result
      } catch (err) {
        Logger.error('查询失败:', err.message)
        return { error: err.message }
      }
    })

    ipcMain.handle('search:suggestions', async (e, input) => {
      try {
        const suggestions = await getBookSuggestions(input)
        return suggestions
      } catch (err) {
        Logger.error('获取建议失败:', err.message)
        return []
      }
    })

    ipcMain.handle('search:verse-range', async (e, py, chapter) => {
      try {
        const range = await getVerseRange(py, chapter)
        return range
      } catch (err) {
        Logger.error('获取节数范围失败:', err.message)
        return { maxVerse: 0 }
      }
    })

    ipcMain.handle('search:next-verse', async (e, py, chapter, currentMaxVerse) => {
      try {
        const nextVerse = currentMaxVerse + 1
        const result = await getVersesByRef(`${py} ${chapter} ${nextVerse}`)
        return result
      } catch (err) {
        Logger.error('获取下一节经文失败:', err.message)
        return { error: err.message }
      }
    })

    // 投影控制
    ipcMain.handle('projector:toggle', () => {
      const projectorWin = this.windowManager.getProjectorWindow()
      if (projectorWin) {
        this.windowManager.destroyProjector()
        return { running: false }
      } else {
        this.windowManager.showOrCreateProjector(this.store)
        return { running: true }
      }
    })

    // 显示器管理
    ipcMain.handle('display:list', () => {
      return screen.getAllDisplays().map(d => ({
        id: d.id,
        label: `${d.id} - ${d.bounds.width}x${d.bounds.height} @(${d.bounds.x},${d.bounds.y})`,
        width: d.size.width,
        height: d.size.height
      }))
    })

    ipcMain.handle('display:set', (e, displayId) => {
      this.store.set('projectorDisplayId', displayId)
      const projectorWin = this.windowManager.getProjectorWindow()
      if (projectorWin) {
        this.windowManager.destroyProjector()
        this.windowManager.showOrCreateProjector(this.store)
      }
      return true
    })

    // 设置管理
    ipcMain.handle('settings:set', async (e, key, value) => {
      return this.settingsManager.setSetting(key, value)
    })

    ipcMain.handle('settings:get', async (e, key) => {
      return this.settingsManager.getSetting(key)
    })

    ipcMain.handle('settings:clear-all', async (e) => {
      return this.settingsManager.clearAllSettings()
    })

    ipcMain.handle('settings:get-default', async (e) => {
      Logger.log("get default settings", await this.settingsManager.getDefaultSettings())
      return this.settingsManager.getDefaultSettings()
    })

    // 系统功能
    ipcMain.handle('app:open-external', async (e, url) => {
      try {
        await shell.openExternal(url)
        Logger.log('External URL opened:', url)
        return { success: true }
      } catch (err) {
        Logger.error('Failed to open external URL:', err.message)
        return { success: false, error: err.message }
      }
    })

    // 单向通信处理
    this.setupOneWayHandlers()
  }

  setupOneWayHandlers() {
    const projectorWin = () => this.windowManager.getProjectorWindow()

    // 内容与滚动同步
    ipcMain.on('preview:content', (e, payload) => {
      const win = projectorWin()
      if (win && !win.isDestroyed() && win.webContents) {
        win.webContents.send('projector:content', payload)
        Logger.log('Content sent to projector:', payload.meta)
      } else {
        Logger.log('Projector window not available for content sync')
      }
    })

    ipcMain.on('preview:scroll', (e, percent) => {
      const win = projectorWin()
      if (win && !win.isDestroyed() && win.webContents) {
        win.webContents.send('projector:scroll', percent)
      }
    })

    // 字体大小设置
    ipcMain.on('set-font-size', (e, size) => {
      const win = projectorWin()
      if (win && !win.isDestroyed() && win.webContents) {
        win.webContents.send('font-size-changed', size)
      }
    })

    // 经文高亮同步
    ipcMain.on('verse:highlight', (e, verseIndex) => {
      const win = projectorWin()
      if (win && !win.isDestroyed() && win.webContents) {
        win.webContents.send('verse:highlight', verseIndex)
      }
    })

    ipcMain.on('verse:highlight-progress', (e, progressData) => {
      const win = projectorWin()
      if (win && !win.isDestroyed() && win.webContents) {
        win.webContents.send('verse:highlight-progress', progressData)
      }
    })

    // 批量设置更新
    ipcMain.on('settings:batch-update', (e, allSettings) => {
      this.settingsManager.batchUpdateSettings(allSettings)
    })
  }
}

export default IPCHandlers
