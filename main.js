// main.js
const { app, BrowserWindow, ipcMain, globalShortcut, Menu, Tray, screen } = require('electron')
const path = require('path')
const robot = require('robotjs')
const isDev = !app.isPackaged 
const { getVersesByRef, initDB, closeDB, getBookSuggestions, getVerseRange } = require('./db')
const Store = require('./store')

let controlWin = null
let projectorWin = null
let tray = null
let originalCapsState = false // 保存原始CAPS LOCK状态


const store = new Store({
  defaults: {
    dbPath: path.join( 'data', 'bible.db'), // 替换为你的实际路径
    projectorDisplayId: null,
    hotkey: 'Control+Space',
    autoLaunch: true
  }
})

// CAPS LOCK控制函数
let capsLockWasEnabled = false // 记录进入应用前的状态
let capsLockCurrentlyEnabled = false // 当前状态

function getCapsLockState() {
  try {
    // Windows API方式检测CAPS LOCK状态（通过robotjs无法直接获取）
    // 这里我们使用一个简单的方法：记住我们的操作
    return capsLockCurrentlyEnabled
  } catch (e) {
    console.error('无法获取CAPS LOCK状态:', e)
    return false
  }
}

function ensureCapsLockState(targetState) {
  try {
    const currentState = getCapsLockState()
    if (currentState !== targetState) {
      robot.keyTap('capslock')
      capsLockCurrentlyEnabled = targetState
      console.log('CAPS LOCK status changed to:', targetState ? 'ON' : 'OFF')
    }
  } catch (e) {
    console.error('Cannot set CAPS LOCK:', e)
  }
}

function enableCapsLock() {
  try {
    // 第一次聚焦时记录原始状态
    if (!controlWin.isFocused() || capsLockWasEnabled === undefined) {
      // 假设初始状态为关闭（大多数情况下）
      capsLockWasEnabled = false
      capsLockCurrentlyEnabled = false
    }
    
    // 确保CAPS LOCK开启
    ensureCapsLockState(true)
    console.log('Control window focused, CAPS LOCK enabled')
  } catch (e) {
    console.error('Cannot enable CAPS LOCK:', e)
  }
}

function restoreCapsLock() {
  try {
    // 恢复到进入应用前的状态
    ensureCapsLockState(capsLockWasEnabled)
    console.log('Control window blurred, CAPS LOCK restored to original state:', capsLockWasEnabled)
  } catch (e) {
    console.error('Cannot restore CAPS LOCK:', e)
  }
}

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
    enableCapsLock()
    
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
  
  controlWin.on('blur', () => {
    restoreCapsLock()
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
  
  controlWin.loadFile(path.join(__dirname, 'renderer', 'control.html'))
  
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
  
  projectorWin.loadFile(path.join(__dirname, 'renderer', 'projector.html'))
  
  // 确保窗口覆盖任务栏 - Windows 11兼容方法
  projectorWin.once('ready-to-show', () => {
    // 首先设置为全屏
    projectorWin.setFullScreen(true)
    // 然后设置最高优先级置顶
    projectorWin.setAlwaysOnTop(true, 'screen-saver', 1)
    // 确保在指定显示器上
    projectorWin.setBounds({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    })
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
    ? path.join(__dirname, 'icon.ico')
    : path.join(__dirname, 'icon.png'))
  const ctx = Menu.buildFromTemplate([
    { label: '显示控制窗', click: () => controlWin?.show() },
    { label: '开始投影', click: () => showOrCreateProjector() },
    { label: '关闭投影', click: () => destroyProjector() },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ])
  tray.setToolTip('投影控制')
  tray.setContextMenu(ctx)
  tray.on('click', () => controlWin?.show())
}

function registerHotkey() {
  const key = store.get('hotkey') || 'Shift+Space'
  globalShortcut.unregisterAll()
  globalShortcut.register(key, () => {
    if (!controlWin) return
    if (controlWin.isVisible()) controlWin.hide()
    else controlWin.show()
  })
}

function setAutoLaunch(enable) {
  app.setLoginItemSettings({
    openAtLogin: !!enable,
    path: process.execPath,
  })
}

app.whenReady().then(async () => {
  await initDB(store.get('dbPath'))
  createControlWindow()
  createTray()
  registerHotkey()
  setAutoLaunch(store.get('autoLaunch'))
})

app.on('window-all-closed', (e) => {
  // 常驻托盘，不退出
  e.preventDefault()
})

app.on('before-quit', () => {
  // 恢复CAPS LOCK状态
  try {
    ensureCapsLockState(capsLockWasEnabled)
    console.log('App exiting, CAPS LOCK state restored')
  } catch (e) {
    console.error('Failed to restore CAPS LOCK on exit:', e)
  }
  
  // 关闭投影窗口
  if (projectorWin && !projectorWin.isDestroyed()) {
    projectorWin.destroy()
    projectorWin = null
    console.log('Projector window closed on app exit')
  }
  
  closeDB()
  globalShortcut.unregisterAll()
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
