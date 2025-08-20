// key-recorder.js - 按键组合记录器
class KeyRecorder {
  constructor() {
    this.recording = false
    this.pressedKeys = new Set()
    this.onKeyRecorded = null
    this.currentCombination = []
    
    this.init()
  }
  
  init() {
    // 监听按键按下
    document.addEventListener('keydown', (e) => {
      if (!this.recording) return
      
      e.preventDefault()
      e.stopPropagation()
      
      // 记录按下的键
      const keyString = this.getKeyString(e)
      if (keyString && !this.pressedKeys.has(keyString)) {
        this.pressedKeys.add(keyString)
        this.updateCombination()
      }
    })
    
    // 监听按键释放
    document.addEventListener('keyup', (e) => {
      if (!this.recording) return
      
      e.preventDefault()
      e.stopPropagation()
      
      const keyString = this.getKeyString(e)
      if (keyString) {
        this.pressedKeys.delete(keyString)
        
        // 如果所有键都释放了，完成记录
        if (this.pressedKeys.size === 0 && this.currentCombination.length > 0) {
          this.completeRecording()
        }
      }
    })
  }
  
  // 开始记录
  startRecording(callback) {
    this.recording = true
    this.pressedKeys.clear()
    this.currentCombination = []
    this.onKeyRecorded = callback
    
    console.log('开始记录按键组合...')
    return this
  }
  
  // 停止记录
  stopRecording() {
    this.recording = false
    this.pressedKeys.clear()
    this.currentCombination = []
    this.onKeyRecorded = null
    
    console.log('停止记录按键组合')
    return this
  }
  
  // 完成记录
  completeRecording() {
    if (this.currentCombination.length > 0) {
      const combination = this.formatCombination(this.currentCombination)
      console.log('记录到按键组合:', combination)
      
      if (this.onKeyRecorded) {
        this.onKeyRecorded(combination)
      }
    }
    
    this.stopRecording()
  }
  
  // 更新当前组合
  updateCombination() {
    this.currentCombination = Array.from(this.pressedKeys).sort((a, b) => {
      // 修饰键优先级: Ctrl, Alt, Shift, Meta, 然后是其他键
      const order = ['Control', 'Alt', 'Shift', 'Meta']
      const aIndex = order.indexOf(a)
      const bIndex = order.indexOf(b)
      
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
      if (aIndex !== -1) return -1
      if (bIndex !== -1) return 1
      return a.localeCompare(b)
    })
  }
  
  // 获取按键字符串
  getKeyString(event) {
    const key = event.key
    const code = event.code
    
    // 修饰键映射
    const modifierMap = {
      'Control': 'Control',
      'Alt': 'Alt', 
      'Shift': 'Shift',
      'Meta': 'Meta', // Windows键/Cmd键
      'ControlLeft': 'Control',
      'ControlRight': 'Control',
      'AltLeft': 'Alt',
      'AltRight': 'Alt',
      'ShiftLeft': 'Shift',
      'ShiftRight': 'Shift',
      'MetaLeft': 'Meta',
      'MetaRight': 'Meta'
    }
    
    // 如果是修饰键
    if (modifierMap[key] || modifierMap[code]) {
      return modifierMap[key] || modifierMap[code]
    }
    
    // 特殊键映射
    const specialKeys = {
      ' ': 'Space',
      'Enter': 'Enter',
      'Escape': 'Escape',
      'Tab': 'Tab',
      'Backspace': 'Backspace',
      'Delete': 'Delete',
      'ArrowUp': 'ArrowUp',
      'ArrowDown': 'ArrowDown',
      'ArrowLeft': 'ArrowLeft',
      'ArrowRight': 'ArrowRight',
      'Home': 'Home',
      'End': 'End',
      'PageUp': 'PageUp',
      'PageDown': 'PageDown',
      'Insert': 'Insert'
    }
    
    if (specialKeys[key]) {
      return specialKeys[key]
    }
    
    // F键
    if (key.startsWith('F') && /^F\d+$/.test(key)) {
      return key
    }
    
    // 数字和字母
    if (/^[a-zA-Z0-9]$/.test(key)) {
      return key.toUpperCase()
    }
    
    // 标点符号等其他键
    if (key.length === 1) {
      return key
    }
    
    return null
  }
  
  // 格式化组合键字符串
  formatCombination(keys) {
    // 将按键数组转换为标准的快捷键字符串
    const modifiers = []
    const mainKeys = []
    
    keys.forEach(key => {
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
        modifiers.push(key)
      } else {
        mainKeys.push(key)
      }
    })
    
    // 组合修饰键和主键
    return [...modifiers, ...mainKeys].join('+')
  }
  
  // 获取当前正在记录的组合键预览
  getCurrentPreview() {
    if (this.currentCombination.length === 0) return ''
    return this.formatCombination(this.currentCombination)
  }
  
  // 验证快捷键是否有效
  isValidCombination(combination) {
    if (!combination || combination.length === 0) return false
    
    // 至少需要一个非修饰键
    const nonModifiers = combination.filter(key => 
      !['Control', 'Alt', 'Shift', 'Meta'].includes(key)
    )
    
    return nonModifiers.length > 0
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = KeyRecorder
} else {
  window.KeyRecorder = KeyRecorder
}
