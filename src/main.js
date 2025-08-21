// main.js - 主入口文件
import { app } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import Store from './store.js'
import { initDB, closeDB, getVersesByRef } from './db.js'
import Logger from './utils/logger.js'
// 导入管理模块
import WindowManager from './managers/window-manager.js'
import SystemManager from './managers/system-manager.js'
import SettingsManager from './managers/settings-manager.js'
import IPCHandlers from './managers/ipc-handlers.js'

// ES 模块中的 __dirname 替代方案
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 应用配置
const isDev = !app.isPackaged
const store = new Store({
      name: 'settings',
      defaults: {
        projectorDisplayId: null,
        autoLaunch: true, // 是否开机自启
        fontSize: 8,  // 字体大小
        textColor: '#ffffff', // 文字颜色
        backgroundColor: '#000000', // 背景颜色
        highlightBackgroundColor: '#1e90ff', // 高亮背景颜色
        highlightTextColor: '#ffff00', // 高亮文字颜色
        scrollSpeed: 0.4, // 滚动速度
        fixedTitle: true, // 固定标题
        lineHeight: 1.6, // 行高
        keyPrevVerse: 'ArrowUp', // 上一节快捷键
        keyNextVerse: 'ArrowDown', // 下一节快捷键
        keyProject: 'F9', // 投影快捷键
        keyShowControl: 'Control+Space' // 显示控制面板快捷键
      }
    })


// 管理器实例
let windowManager
let systemManager
let settingsManager
let ipcHandlers

async function initializeApp() {
  try {
    // 初始化数据库 - 从 extraResources 目录访问
    const dbPath = isDev 
      ? path.join(__dirname, '..', 'data', 'bible.db')
      : path.join(process.resourcesPath, 'data', 'bible.db')
    
    await initDB(dbPath)
    
    // 创建管理器实例
    windowManager = new WindowManager()
    systemManager = new SystemManager(windowManager, store)
    settingsManager = new SettingsManager(windowManager, store)
    ipcHandlers = new IPCHandlers(windowManager, settingsManager, store)
    
    // 创建主窗口
    const controlWin = windowManager.createControlWindow()
    

    if(isDev) {
      // 窗口加载完成后设置默认内容
      controlWin.webContents.once('did-finish-load', async () => {
        try {
          const defaultResult = await getVersesByRef('CSJ 1 1-13')
          controlWin.webContents.send('default-content', defaultResult)
          Logger.log('默认内容已加载: 创世纪 1:1-13')
        } catch (err) {
          Logger.error('加载默认内容失败:', err.message)
        }
      })
       // 开发模式下打开开发者工具
      //controlWin.webContents.openDevTools({ mode: 'detach' })
    }
    
   
    // 创建系统托盘
    systemManager.createTray()
    // 注册全局快捷键
    systemManager.registerHotkey()
    // 设置自启动
    systemManager.setAutoLaunch(store.get('autoLaunch'))
    
    Logger.info('Application initialized successfully')
  } catch (error) {
    Logger.error('Failed to initialize application:', error)
    app.quit()
  }
}

async function startApplication() {
  if (!systemManager.setupSingleInstance()) {
    Logger.error('Another instance is already running.')
    return
  }
  
  // 设置应用事件
  systemManager.setupAppEvents()
  
  // 应用准备就绪时初始化
  app.whenReady().then(initializeApp)
}

// 应用清理
app.on('before-quit', () => {
  closeDB()
  if (systemManager) {
    systemManager.cleanup()
  }
})

// 启动应用
windowManager = new WindowManager()
systemManager = new SystemManager(windowManager, store)

startApplication()