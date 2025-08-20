// main.js
const { app, BrowserWindow, ipcMain, globalShortcut, Menu, Tray, screen } = require('electron')
const path = require('path')
const robot = require('robotjs')
const isDev = !app.isPackaged 
const { getVersesByRef, initDB, closeDB, getBookSuggestions, getVerseRange } = require('./db')
const Store = require('./store')
const keyboardState = require('keyboard-state');

let controlWin = null
let projectorWin = null
let tray = null
let originalCapsState = false // 保存原始CAPS LOCK状态


const store = new Store({
  defaults: {
    dbPath: path.join(__dirname, '..', 'data', 'bible.db'), // 替换为你的实际路径
    projectorDisplayId: null,
    hotkey: 'Control+Space',
    autoLaunch: true
  }
})

function createControlWindow() {
  controlWin = new BrowserWindow({
    width: 420,
    height: 560, // 增加高度以容纳字体大小控制
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    movable: true,
    resizable: false,
    skipTaskbar: false, // 允许在任务栏显示
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  
  // 添加窗口焦点事件监听
  controlWin.on('focus', () => {
    
    // 确保control窗口保持置顶
    controlWin.setAlwaysOnTop(true)
    
    // 确保投影窗口保持全屏和置顶状态
    if (projectorWin && !projectorWin.isDestroyed()) {
      // 确保投影窗口仍然全屏和置顶
      projectorWin.setFullScreen(true)
      projectorWin.setAlwaysOnTop(true, 'screen-saver', 1)
      projectorWin.moveTop()
    }
  })
  
  
  // 控制窗口关闭时也关闭投影窗口
  controlWin.on('closed', () => {
    if (projectorWin && !projectorWin.isDestroyed()) {
      projectorWin.destroy()
      projectorWin = null
      console.log('Projector window closed when control window closed')
    }
    controlWin = null
  })
  
  controlWin.loadFile(path.join(__dirname, '..', 'renderer', 'control.html'))
  
  // 窗口加载完成后默认显示创世纪1:1-2
  controlWin.webContents.once('did-finish-load', async () => {
    try {
      const defaultResult = await getVersesByRef('CSJ 1 1-13')
      controlWin.webContents.send('default-content', defaultResult)
      console.log('默认内容已加载: 创世纪 1:1-13')
    } catch (err) {
      console.error('加载默认内容失败:', err.message)
    }
  })
  
  if (isDev) controlWin.webContents.openDevTools({ mode: 'detach' })
}

function createProjectorWindow(display) {
  const bounds = display.bounds
  projectorWin = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    fullscreen: false, // 先创建非全屏窗口
    movable: false,
    resizable: false,
    focusable: true,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    minimizable: false,
    maximizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  
  projectorWin.loadFile(path.join(__dirname, '..', 'renderer', 'projector.html'))
  
  // 确保窗口覆盖任务栏 - Windows 11兼容方法
  projectorWin.once('ready-to-show', () => {
    // 确保在指定显示器上
    projectorWin.setBounds({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    })
    // 然后设置为全屏
    projectorWin.setFullScreen(true)
    // 设置最高优先级置顶
    projectorWin.setAlwaysOnTop(true, 'screen-saver', 1)
    // 强制置顶并获得焦点
    projectorWin.moveTop()
    projectorWin.show()
  })
  
  // 确保投影窗口加载完成后才允许发送内容
  projectorWin.webContents.once('did-finish-load', () => {
    console.log('Projector window loaded successfully')
  })
  
  // 监听投影窗口关闭事件，更新控制面板状态
  projectorWin.on('closed', () => {
    projectorWin = null
    if (controlWin && !controlWin.isDestroyed()) {
      controlWin.webContents.send('projector-closed')
      // 恢复预览原始尺寸 (16:9 比例)
      controlWin.webContents.send('display-info', {
        id: null,
        width: 16,
        height: 9
      })
    }
  })
  
  if (isDev) projectorWin.webContents.openDevTools({ mode: 'detach' })
}

function showOrCreateProjector() {
  const displays = screen.getAllDisplays()
  const id = store.get('projectorDisplayId') ?? displays[displays.length - 1]?.id
  const target = displays.find(d => d.id === id) || displays[displays.length - 1]
  if (!projectorWin || projectorWin.isDestroyed()) {
    createProjectorWindow(target)
    // 只在新建投影窗口时发送显示器信息改变预览尺寸
    controlWin.webContents.send('display-info', {
      id: target.id,
      width: target.size.width,
      height: target.size.height
    })
  } else {
    projectorWin.showInactive()
    // 如果投影窗口已存在，不改变预览尺寸
  }
}

function destroyProjector() {
  if (projectorWin && !projectorWin.isDestroyed()) {
    projectorWin.destroy()
    projectorWin = null
    // 恢复预览原始尺寸
    if (controlWin && !controlWin.isDestroyed()) {
      controlWin.webContents.send('display-info', {
        id: null,
        width: 16,
        height: 9
      })
    }
  }
}

function createTray() {
  tray = new Tray(process.platform === 'win32'
    ? path.join(__dirname, '..', 'assets', 'icon.ico')
    : path.join(__dirname, '..', 'assets', 'icon.png'))
  const ctx = Menu.buildFromTemplate([
    { 
      label: '显示控制窗', 
      click: () => {
        if (controlWin) {
          if (controlWin.isMinimized()) {
            controlWin.restore()
          }
          if (!controlWin.isVisible()) {
            controlWin.show()
          }
          controlWin.focus()
          controlWin.setAlwaysOnTop(true)
        }
      }
    },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ])
  tray.setToolTip('投影控制')
  tray.setContextMenu(ctx)
  tray.on('click', () => {
    if (controlWin) {
      if (controlWin.isMinimized()) {
        controlWin.restore()
      }
      if (!controlWin.isVisible()) {
        controlWin.show()
      }
      controlWin.focus()
      controlWin.setAlwaysOnTop(true)
    }
  })
}

function registerHotkey() {
  const key = store.get('keyShowControl') || 'Shift+Space'
  console.log('Registering hotkey:', key)
  globalShortcut.unregisterAll()
  let result =  globalShortcut.register(key, () => {
    console.log('Hotkey pressed:', key)
    if (!controlWin) return
    if (controlWin.isVisible()) controlWin.hide()
    else controlWin.show()
  })
  if (!result) {
    console.error('Failed to register hotkey:', key)
  }
}


function setAutoLaunch(enable) {
  app.setLoginItemSettings({
    openAtLogin: !!enable,
    path: process.execPath,
  })
}

// 防止程序重复运行
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  // 如果没有获得锁，说明已经有实例在运行，直接退出
  app.quit()
} else {
  // 当试图运行第二个实例时，聚焦到现有的控制窗口
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // 如果控制窗口存在，显示并聚焦它
    if (controlWin) {
      if (controlWin.isMinimized()) {
        controlWin.restore()
      }
      if (!controlWin.isVisible()) {
        controlWin.show()
      }
      controlWin.focus()
      controlWin.setAlwaysOnTop(true)
    }
  })

  app.whenReady().then(async () => {
    await initDB(store.get('dbPath'))
    createControlWindow()
    createTray()
    registerHotkey()
    setAutoLaunch(store.get('autoLaunch'))
  })
}

app.on('window-all-closed', (e) => {
  // 常驻托盘，不退出
  e.preventDefault()
})

app.on('before-quit', () => {
  // 关闭投影窗口
  if (projectorWin && !projectorWin.isDestroyed()) {
    projectorWin.destroy()
    projectorWin = null
    console.log('Projector window closed on app exit')
  }
  
  closeDB()
  globalShortcut.unregisterAll()
})

ipcMain.handle('window:hide', () => {
  if (controlWin && !controlWin.isDestroyed()) {
    controlWin.hide()
  }

  destroyProjector()
})

// IPC: 查询经文
ipcMain.handle('search:query', async (e, queryText) => {
  try {
    const result = await getVersesByRef(queryText)
    console.log('查询结果:', result)
    return result
  } catch (err) {
    console.error('查询失败:', err.message)
    return { error: err.message }
  }
})

// IPC: 获取书卷建议
ipcMain.handle('search:suggestions', async (e, input) => {
  try {
    const suggestions = await getBookSuggestions(input)
    return suggestions
  } catch (err) {
    console.error('获取建议失败:', err.message)
    return []
  }
})

// IPC: 获取节数范围
ipcMain.handle('search:verse-range', async (e, py, chapter) => {
  try {
    const range = await getVerseRange(py, chapter)
    return range
  } catch (err) {
    console.error('获取节数范围失败:', err.message)
    return { maxVerse: 0 }
  }
})

// IPC: 获取下一节经文
ipcMain.handle('search:next-verse', async (e, py, chapter, currentMaxVerse) => {
  try {
    const nextVerse = currentMaxVerse + 1
    const result = await getVersesByRef(`${py} ${chapter} ${nextVerse}`)
    return result
  } catch (err) {
    console.error('获取下一节经文失败:', err.message)
    return { error: err.message }
  }
})

// IPC: 开始/关闭投影
ipcMain.handle('projector:toggle', () => {
  if (projectorWin) {
    destroyProjector()
    return { running: false }
  } else {
    showOrCreateProjector()
    return { running: true }
  }
})

// IPC: 显示器列表与选择
ipcMain.handle('display:list', () => {
  return screen.getAllDisplays().map(d => ({
    id: d.id,
    label: `${d.id} - ${d.bounds.width}x${d.bounds.height} @(${d.bounds.x},${d.bounds.y})`,
    width: d.size.width,
    height: d.size.height
  }))
})

ipcMain.handle('display:set', (e, displayId) => {
  store.set('projectorDisplayId', displayId)
  if (projectorWin) {
    destroyProjector()
    showOrCreateProjector()
  }
  return true
})

// 内容与滚动同步
ipcMain.on('preview:content', (e, payload) => {
  if (projectorWin && !projectorWin.isDestroyed() && projectorWin.webContents) {
    projectorWin.webContents.send('projector:content', payload)
    console.log('Content sent to projector:', payload.meta)
  } else {
    console.log('Projector window not available for content sync')
  }
})

ipcMain.on('preview:scroll', (e, percent) => {
  if (projectorWin && !projectorWin.isDestroyed() && projectorWin.webContents) {
    projectorWin.webContents.send('projector:scroll', percent)
  }
})

// 字体大小设置
ipcMain.on('set-font-size', (e, size) => {
  if (projectorWin && !projectorWin.isDestroyed() && projectorWin.webContents) {
    projectorWin.webContents.send('font-size-changed', size)
  }
})

// 经文高亮同步
ipcMain.on('verse:highlight', (e, verseIndex) => {
  if (projectorWin && !projectorWin.isDestroyed() && projectorWin.webContents) {
    projectorWin.webContents.send('verse:highlight', verseIndex)
  }
})

// 经文高亮动画进度同步
ipcMain.on('verse:highlight-progress', (e, progressData) => {
  if (projectorWin && !projectorWin.isDestroyed() && projectorWin.webContents) {
    projectorWin.webContents.send('verse:highlight-progress', progressData)
  }
})

// 窗口大小调整
ipcMain.handle('window:resize', async (e, width, height) => {
  try {
    if (controlWin && !controlWin.isDestroyed()) {
      // 获取当前窗口大小
      const currentSize = controlWin.getContentSize()
      
      // 只调整宽度，保持原有高度，并增加一些额外空间避免滚动条
      const adjustedWidth = width + 20 // 增加20px来补偿边距
      controlWin.setContentSize(adjustedWidth, currentSize[1])
      return true
    }
    return false
  } catch (error) {
    console.error('Failed to resize window:', error)
    return false
  }
})

// 用户设置存储（使用Store类持久化）
const userSettingsStore = new Store({
  name: 'user-settings',
  defaults: {
    fontSize: 8,
    textColor: '#ffffff',
    backgroundColor: '#000000',
    highlightBackgroundColor: '#1e90ff',
    highlightTextColor: '#ffff00',
    scrollSpeed: 0.4,
    fixedTitle: true,
    lineHeight: 1.6,
    // 快捷键设置
    keyPrevVerse: 'ArrowUp',
    keyNextVerse: 'ArrowDown',
    keyProject: 'F9',
    keyShowControl: 'Control+Space'
  }
})

// 设置处理器
ipcMain.handle('settings:set', async (e, key, value) => {
  try {
    // 保存到持久化存储
    userSettingsStore.set(key, value)
    
    // 向投影窗口发送设置变化
    if (projectorWin && !projectorWin.isDestroyed() && projectorWin.webContents) {
      projectorWin.webContents.send('settings:changed', { key, value })
    }
    
    console.log(`Setting ${key} saved to disk:`, value)
    return true
  } catch (error) {
    console.error('Failed to set setting:', error)
    return false
  }
})

ipcMain.handle('settings:get', async (e, key) => {
  try {
    if (key) {
      return userSettingsStore.get(key)
    } else {
      return userSettingsStore.data
    }
  } catch (error) {
    console.error('Failed to get setting:', error)
    return userSettingsStore.defaults
  }
})

// 批量设置更新（用于重置功能）
ipcMain.on('settings:batch-update', (e, allSettings) => {
  try {
    // 保存所有设置到store
    for (const [key, value] of Object.entries(allSettings)) {
      userSettingsStore.set(key, value)
      console.log(`Batch setting ${key} saved:`, value)
    }
    
    // 向投影窗口发送批量设置变化
    if (projectorWin && !projectorWin.isDestroyed() && projectorWin.webContents) {
      projectorWin.webContents.send('settings:changed', allSettings)
      console.log('Batch settings sent to projector')
    }
  } catch (error) {
    console.error('Failed to batch update settings:', error)
  }
})

// 清除所有设置（重置功能使用）
ipcMain.handle('settings:clear-all', async (e) => {
  try {
    // 重新创建store，只包含默认值
    const defaultSettings = {
      fontSize: 8,
      textColor: '#ffffff',
      backgroundColor: '#000000',
      highlightBackgroundColor: '#1e90ff',
      highlightTextColor: '#ffff00',
      scrollSpeed: 0.4,
      fixedTitle: true,
      lineHeight: 1.6,
      // 快捷键设置
      keyPrevVerse: 'ArrowUp',
      keyNextVerse: 'ArrowDown',
      keyProject: 'F9',
      keyShowControl: 'Control+Space'
    }
    
    // 清空store并设置为默认值
    userSettingsStore.data = { ...defaultSettings }
    
    // 写入文件
    const fs = require('fs')
    fs.writeFileSync(userSettingsStore.path, JSON.stringify(defaultSettings, null, 2))
    
    console.log('All settings cleared and reset to defaults')
    return true
  } catch (error) {
    console.error('Failed to clear all settings:', error)
    return false
  }
})
