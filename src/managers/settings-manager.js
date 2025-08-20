// settings-manager.js - 设置管理模块
import fs from 'fs'
import Logger from '../utils/logger.js'

class SettingsManager {
  constructor(windowManager, store) {
    this.windowManager = windowManager
    this.userSettingsStore = store
  }

  async setSetting(key, value) {
    try {
      // 保存到持久化存储
      this.userSettingsStore.set(key, value)
      
      // 向投影窗口发送设置变化
      const projectorWin = this.windowManager.getProjectorWindow()
      if (projectorWin && !projectorWin.isDestroyed() && projectorWin.webContents) {
        projectorWin.webContents.send('settings:changed', { key, value })
      }
      
      Logger.log(`Setting ${key} saved to disk:`, value)
      return true
    } catch (error) {
      Logger.error('Failed to set setting:', error)
      return false
    }
  }

  async getSetting(key) {
    try {
      if (key) {
        return this.userSettingsStore.get(key)
      } else {
        return this.userSettingsStore.data
      }
    } catch (error) {
      Logger.error('Failed to get setting:', error)
      try {
        return this.userSettingsStore.defaults[key]
      } catch (error) {
        Logger.error('Failed to get default setting:', error)
      }
    }
  }

  batchUpdateSettings(allSettings) {
    try {
      // 保存所有设置到store
      for (const [key, value] of Object.entries(allSettings)) {
        this.userSettingsStore.set(key, value)
        Logger.log(`Batch setting ${key} saved:`, value)
      }
      
      // 向投影窗口发送批量设置变化
      const projectorWin = this.windowManager.getProjectorWindow()
      if (projectorWin && !projectorWin.isDestroyed() && projectorWin.webContents) {
        projectorWin.webContents.send('settings:changed', allSettings)
        Logger.log('Batch settings sent to projector')
      }
    } catch (error) {
      Logger.error('Failed to batch update settings:', error)
    }
  }

  async clearAllSettings() {
    try {
      if (fs.existsSync(this.userSettingsStore.path)) {
        fs.unlinkSync(this.userSettingsStore.path)
      }
      Logger.log('All settings cleared and reset to defaults')
      return true
    } catch (error) {
      Logger.error('Failed to clear all settings:', error)
      return false
    }
  }

  getDefaultSettings() {
    Logger.log("SettingsManager: get default settings", this.userSettingsStore)
    return this.userSettingsStore.defaults
  }
}

export default SettingsManager
