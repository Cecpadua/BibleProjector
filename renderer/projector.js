import { wrapText, hexToRgba, userSettings, renderCanvasContent, setupCanvas as SC } from "./common.js"

const canvas = document.getElementById('projectorCanvas')
let ctx = canvas.getContext('2d') // 使用let而不是const

let currentData = null
let fontSize = 8 // 与control.js默认值保持一致
let scrollOffset = 0
let highlightedVerse = -1 // 当前高亮的经文索引

// 动画相关变量
let isAnimating = false
let animationDuration = 300

// 平滑滚动相关变量
let targetScrollOffset = 0
let currentScrollOffset = 0
let scrollAnimationId = null
let isScrolling = false

console.log('Projector canvas initialized')


// 设置Canvas尺寸
const setupCanvas = () => SC(canvas, ctx, renderContent)
// 渲染内容
const renderContent = () => renderCanvasContent({ ctx, currentData, highlightedVerse, canvasElement: canvas, scrollOffsetValue: scrollOffset })


// 平滑滚动函数（恢复丝滑效果）
function smoothScrollTo(targetOffset) {
  // 取消任何正在进行的滚动动画
  if (isScrolling) {
    cancelAnimationFrame(scrollAnimationId)
  }
  
  isScrolling = true
  targetScrollOffset = targetOffset
  const startOffset = scrollOffset
  const distance = targetOffset - startOffset
  const startTime = Date.now()
  const duration = 300 // 300ms动画时间
  
  function animate() {
    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / duration, 1)
    
    // 使用easeOutCubic缓动函数，提供丝滑的感觉
    const easeOutCubic = 1 - Math.pow(1 - progress, 3)
    
    scrollOffset = startOffset + distance * easeOutCubic
    renderContent()
    
    if (progress < 1) {
      scrollAnimationId = requestAnimationFrame(animate)
    } else {
      isScrolling = false
      scrollOffset = targetOffset // 确保最终位置精确
      renderContent()
    }
  }
  
  animate()
}

// 即时滚动函数（用于同步控制窗口的滚动）
function instantScrollTo(targetOffset) {
  // 取消任何正在进行的滚动动画
  if (isScrolling) {
    cancelAnimationFrame(scrollAnimationId)
    isScrolling = false
  }
  
  // 直接设置滚动位置
  scrollOffset = targetOffset
  renderContent()
}

// 投影窗口滚轮滚动事件（与control.js保持一致）
canvas.addEventListener('wheel', (e) => {
  if (!currentData) return
  
  e.preventDefault()
  const rect = canvas.getBoundingClientRect()
  
  // 精确计算总内容高度
  const fontSizePx = (fontSize / 100) * rect.height
  const lineHeight = fontSizePx * 1.6
  const paddingTop = rect.height * 0.04
  
  // 计算标题高度
  const titleHeight = fontSizePx * 0.7  + rect.height * 0.01
  
  // 计算所有经文的高度
  let contentHeight = paddingTop + titleHeight
  const maxWidth = Math.floor(rect.width - rect.width * 0.06 * 2)
  
  // 临时创建canvas context来测量文本
  const tempCanvas = document.createElement('canvas')
  const tempCtx = tempCanvas.getContext('2d')
  tempCtx.font = `${fontSizePx}px "Microsoft YaHei", Arial, sans-serif`
  
  currentData.verses.forEach(verse => {
    const text = `${verse.VerseSN}. ${verse.strjw}`
    const lines = wrapText(tempCtx, text, maxWidth)
    contentHeight += lines.length * lineHeight + fontSizePx * 0.2 // verse间距
  })
  
  // 底部额外空间
  contentHeight += lineHeight * 3
  
  // 计算最大滚动距离
  const maxScroll = Math.max(0, contentHeight - rect.height)
  
  // 计算目标滚动位置（可调节滚动敏感度）
  const scrollSpeed = 0.4 // 降低滚动敏感度，减少每次偏移量 (0.1-1.0之间调节，越小越精细)
  let targetOffset = scrollOffset + e.deltaY * scrollSpeed
  targetOffset = Math.max(0, Math.min(maxScroll, targetOffset))
  
  // 使用即时滚动
  instantScrollTo(targetOffset)
})

// Canvas点击事件 - 检测点击的经文（与control.js保持一致）
canvas.addEventListener('click', (e) => {
  if (!currentData) return
  
  const rect = canvas.getBoundingClientRect()
  const clickY = e.clientY - rect.top + scrollOffset
  const fontSizePx = (fontSize / 100) * rect.height
  const lineHeight = fontSizePx * 1.6
  const paddingTop = rect.height * 0.04
  const titleHeight = fontSizePx * 0.7 + rect.height * 0.01
  
  let currentY = paddingTop + titleHeight
  const maxWidth = Math.floor(rect.width - rect.width * 0.06 * 2)
  
  // 临时创建canvas context来测量文本
  const tempCanvas = document.createElement('canvas')
  const tempCtx = tempCanvas.getContext('2d')
  tempCtx.font = `${fontSizePx}px "Microsoft YaHei", Arial, sans-serif`
  
  // 检查点击位置对应的经文
  for (let i = 0; i < currentData.verses.length; i++) {
    const verse = currentData.verses[i]
    const text = `${verse.VerseSN}. ${verse.strjw}`
    const lines = wrapText(tempCtx, text, maxWidth)
    const verseHeight = lines.length * lineHeight
    
    if (clickY >= currentY && clickY < currentY + verseHeight) {
      // 点击的是当前经文
      if (highlightedVerse === i) {
        // 如果已经高亮，取消高亮
        highlightedVerse = -1
      } else {
        // 高亮当前经文
        animateHighlight(highlightedVerse, i)
      }
      return
    }
    
    currentY += verseHeight + fontSizePx * 0.2
  }
  
  // 如果点击的不是任何经文，取消高亮
  if (highlightedVerse >= 0) {
    animateHighlight(highlightedVerse, -1)
  }
})

// 键盘导航（投影窗口专用，不包含追加功能）
document.addEventListener('keydown', (e) => {
  if (!currentData || isAnimating) return
  
  switch (e.key) {
    case 'ArrowUp':
      e.preventDefault()
      // 上键：上一节
      if (highlightedVerse > 0) {
        animateHighlight(highlightedVerse, highlightedVerse - 1)
      } else if (highlightedVerse === -1 && currentData.verses.length > 0) {
        animateHighlight(-1, currentData.verses.length - 1) // 从最后一个开始
      }
      break
      
    case 'ArrowDown':
      e.preventDefault()
      // 下键：下一节
      if (highlightedVerse < currentData.verses.length - 1) {
        animateHighlight(highlightedVerse, highlightedVerse + 1)
      } else if (highlightedVerse === -1 && currentData.verses.length > 0) {
        animateHighlight(-1, 0) // 从第一个开始
      }
      break
      
    case 'Escape':
      e.preventDefault()
      // ESC：取消高亮或关闭投影窗口
      if (highlightedVerse >= 0) {
        animateHighlight(highlightedVerse, -1) // 取消高亮
      } else {
        console.log('ESC pressed, closing projector')
        window.close() // 关闭投影窗口
      }
      break
  }
})

// ESC键退出投影（保留原有功能作为备用）
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    console.log('ESC pressed, closing projector')
    window.close()
  }
})

// 窗口大小变化时重新设置Canvas
window.addEventListener('resize', () => {
  setupCanvas()
  renderContent()
})

// 接收内容数据
window.api.onProjectorContent((payload) => {
  console.log('Received content in projector:', payload)
  
  // 检测是否是追加操作（新内容包含了之前的内容）
  const isAppendOperation = currentData && 
    currentData.meta.py === payload.meta.py &&
    currentData.meta.chapter === payload.meta.chapter &&
    currentData.meta.range[0] === payload.meta.range[0] &&
    payload.verses.length > currentData.verses.length &&
    payload.meta.range[1] > currentData.meta.range[1]
  
  if (isAppendOperation) {
    // 追加操作：保持当前滚动位置和高亮状态
    console.log('Detected append operation, maintaining scroll position')
    const oldVerseCount = currentData.verses.length
    currentData = payload
    
    // 如果有高亮的经文，可能需要高亮新追加的经文
    if (highlightedVerse >= 0) {
      // 保持当前高亮，或者可以选择高亮新添加的经文
      const newVerseIndex = payload.verses.length - 1
      animateHighlight(highlightedVerse, newVerseIndex)
    }
  } else {
    // 全新内容：重置所有状态
    currentData = payload
    scrollOffset = 0
    targetScrollOffset = 0
    currentScrollOffset = 0
    highlightedVerse = -1 // 重置高亮
  }
  
  renderContent()
})

// 接收滚动数据
window.api.onProjectorScroll((percent) => {
  console.log('Received scroll in projector:', percent)
  if (!currentData) return
  
  // 使用实际的Canvas逻辑尺寸而不是getBoundingClientRect
  const rect = canvas.getBoundingClientRect()
  
  // 精确计算总内容高度（与control.js保持一致）
  const fontSizePx = (fontSize / 100) * rect.height
  const lineHeight = fontSizePx * 1.6
  const paddingTop = rect.height * 0.04
  
  // 计算标题高度
  const titleHeight = fontSizePx * 0.7 + rect.height * 0.01
  
  // 计算所有经文的高度 - 使用相同的逻辑
  let contentHeight = paddingTop + titleHeight
  const maxWidth = Math.floor(rect.width - rect.width * 0.06 * 2)
  
  // 创建临时Canvas进行文本测量，确保与控制窗口一致
  const tempCanvas = document.createElement('canvas')
  const tempCtx = tempCanvas.getContext('2d')
  tempCtx.font = `${fontSizePx}px "Microsoft YaHei", Arial, sans-serif`
  
  currentData.verses.forEach(verse => {
    const text = `${verse.VerseSN}. ${verse.strjw}`
    const lines = wrapText(tempCtx, text, maxWidth)
    contentHeight += lines.length * lineHeight + fontSizePx * 0.2 // verse间距
  })
  
  // 底部额外空间
  contentHeight += lineHeight * 3
  
  // 计算最大滚动距离
  const maxScroll = Math.max(0, contentHeight - rect.height)
  
  // 使用平滑滚动 - 添加调试日志
  const targetOffset = percent * maxScroll
  console.log(`Projector scroll: percent=${percent}, maxScroll=${maxScroll}, targetOffset=${targetOffset}`)
  smoothScrollTo(targetOffset)
})

// 字体大小变化处理
window.api.onFontSizeChange((size) => {
  console.log('Font size changed to:', size)
  fontSize = size
  renderContent()
})

// 经文高亮处理（与控制窗口同步动画）
window.api.onVerseHighlight((verseData) => {
  console.log('Received verse highlight:', verseData)
  
  if (typeof verseData === 'number') {
    // 旧式接口：直接设置高亮
    if (verseData !== highlightedVerse) {
      highlightedVerse = verseData
      renderContent()
      console.log('Updated highlight to verse:', verseData)
    }
  } else if (verseData && typeof verseData === 'object') {
    // 新式接口：支持动画
    const { fromIndex, toIndex, isAnimation } = verseData
    if (isAnimation) {
      console.log('Starting highlight animation:', fromIndex, '->', toIndex)
      animateHighlight(fromIndex, toIndex)
    } else {
      // 立即切换
      highlightedVerse = toIndex
      renderContent()
    }
  }
})

// 高亮动画进度处理（实时同步）
window.api.onVerseHighlightProgress((progressData) => {
  if (!progressData) return
  
  const { fromIndex, toIndex, progress } = progressData
  console.log('Received highlight progress:', fromIndex, '->', toIndex, 'progress:', progress)
  
})

// 滚动到指定经文（与control.js保持一致）
function scrollToVerse(verseIndex) {
  if (!currentData || verseIndex < 0 || verseIndex >= currentData.verses.length) return
  
  const rect = canvas.getBoundingClientRect()
  const fontSizePx = (fontSize / 100) * rect.height
  const lineHeight = fontSizePx * 1.6
  const paddingTop = rect.height * 0.04
  const titleHeight = fontSizePx * 0.7 + rect.height * 0.01
  
  // 计算内容开始位置，根据固定标题设置
  let targetY = userSettings.fixedTitle ? (paddingTop + titleHeight) : paddingTop
  
  // 如果不是固定标题模式，需要加上标题的高度
  if (!userSettings.fixedTitle) {
    targetY += titleHeight
  }
  
  // 计算到目标经文的距离
  for (let i = 0; i < verseIndex; i++) {
    const verse = currentData.verses[i]
    const text = `${verse.VerseSN}. ${verse.strjw}`
    const maxWidth = Math.floor(rect.width - rect.width * 0.06 * 2)
    
    // 临时创建canvas context来测量文本
    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')
    tempCtx.font = `${fontSizePx}px "Microsoft YaHei", Arial, sans-serif`
    
    const lines = wrapText(tempCtx, text, maxWidth)
    targetY += lines.length * lineHeight + fontSizePx * 0.2
  }
  
  // 设置滚动位置使目标经文在可见区域的合适位置
  // 如果是固定标题模式，要确保不滚动到标题区域之上
  const contentStartY = userSettings.fixedTitle ? (paddingTop + titleHeight) : 0
  const availableHeight = userSettings.fixedTitle ? (rect.height - contentStartY) : rect.height
  const centerOffset = availableHeight / 3
  
  const targetScrollOffset = Math.max(0, targetY - contentStartY - centerOffset)
  
  // 使用平滑滚动提供丝滑体验
  smoothScrollTo(targetScrollOffset)
}

// 动画高亮过渡（与control.js保持一致）
function animateHighlight(fromIndex, toIndex) {
  if (isAnimating) return
  
  isAnimating = true
  const startTime = Date.now()
  
  function animate() {
    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / animationDuration, 1)

    
    if (progress < 1) {
      requestAnimationFrame(animate)
    } else {
      // 动画完成
      isAnimating = false
      highlightedVerse = toIndex
      renderContent()
      
      // 自动滚动到高亮经文
      if (toIndex >= 0) {
        scrollToVerse(toIndex)
      }
    }
  }
  
  animate()
}

// 初始化
setupCanvas()

// 显示初始提示
currentData = {
  meta: { book: '等待投影内容', chapter: '', range: ['', ''] },
  verses: [{ VerseSN: '', strjw: '请在控制面板中输入经文查询' }]
}
renderContent()

// 设置变化监听器
window.api.onSettingsChanged((settingsChange) => {
  console.log('Projector received settings change:', settingsChange)
  
  if (settingsChange.key && settingsChange.value !== undefined) {
    // 单个设置变化
    userSettings[settingsChange.key] = settingsChange.value
    
    // 如果是字体大小变化，同时更新旧的fontSize变量（向后兼容）
    if (settingsChange.key === 'fontSize') {
      fontSize = settingsChange.value
    }
    
    // 重新渲染内容以应用新设置
    renderContent()
  } else if (typeof settingsChange === 'object' && !settingsChange.key) {
    // 批量设置更新（重置功能使用）
    console.log('Projector received batch settings update:', settingsChange)
    Object.assign(userSettings, settingsChange)
    
    // 同时更新旧的fontSize变量（向后兼容）
    fontSize = userSettings.fontSize
    
    // 重新渲染内容以应用新设置
    renderContent()
  }
})

// 启动时加载保存的设置
async function loadSavedSettings() {
  try {
    const savedSettings = await window.api.getSetting()
    if (savedSettings) {
      console.log('Projector loading saved settings:', savedSettings)
      // 更新设置对象
      Object.assign(userSettings, savedSettings)
      // 更新旧的fontSize变量（向后兼容）
      fontSize = userSettings.fontSize
      renderContent()
    }
  } catch (error) {
    console.error('Failed to load settings in projector:', error)
  }
}

// 在页面加载完成后加载设置
document.addEventListener('DOMContentLoaded', () => {
  loadSavedSettings()
})

console.log('Projector event listeners registered')