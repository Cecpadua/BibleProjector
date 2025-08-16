// projector.js
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
function setupCanvas() {
  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  
  // 重新获取context以避免累积缩放
  ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)
  
  // 设置相同的文本渲染属性
  ctx.textRendering = 'optimizeLegibility'
  ctx.fontKerning = 'normal'
  
  console.log(`Canvas setup: ${rect.width}x${rect.height}, DPR: ${dpr}`)
}

// 渲染内容
function renderContent() {
  if (!currentData) return
  
  const rect = canvas.getBoundingClientRect()
  ctx.clearRect(0, 0, rect.width, rect.height)
  
  // 设置字体和颜色
  const fontSizePx = (fontSize / 100) * rect.height // 将vh转换为px
  ctx.font = `${fontSizePx}px "Microsoft YaHei", Arial, sans-serif`
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  
  const padding = rect.width * 0.06 // 6vw
  const paddingTop = rect.height * 0.04 // 4vh
  let y = paddingTop - scrollOffset
  
  // 渲染标题
  const { meta, verses } = currentData
  const metaText = `${meta.book} 第${meta.chapter}章 ${meta.range[0]}-${meta.range[1]}`
  
  ctx.fillStyle = '#bbbbbb'
  ctx.font = `${fontSizePx * 0.7}px "Microsoft YaHei", Arial, sans-serif`
  ctx.fillText(metaText, padding, y)
  y += fontSizePx * 0.7 * 1.6 + rect.height * 0.01 // 1vh margin
  
  // 渲染经文
  ctx.font = `${fontSizePx}px "Microsoft YaHei", Arial, sans-serif`
  
  const lineHeight = fontSizePx * 1.6
  const maxWidth = Math.floor(rect.width - padding * 2) // 向下取整确保一致性
  
  console.log(`PROJECTOR: Canvas ${rect.width}x${rect.height}, fontSize=${fontSizePx}px, maxWidth=${maxWidth}`)
  
  verses.forEach((verse, verseIndex) => {
    const text = `${verse.VerseSN}. ${verse.strjw}`
    
    // 完全统一的文本换行算法
    const lines = wrapText(ctx, text, maxWidth)
    
    // 计算当前经文的总高度
    const verseHeight = lines.length * lineHeight
    const verseStartY = y
    
    // 如果当前经文被高亮，绘制背景
    if (highlightedVerse === verseIndex) {
      ctx.fillStyle = 'rgba(30, 144, 255, 0.3)' // 蓝色半透明背景
      ctx.fillRect(padding - 5, verseStartY - 5, rect.width - padding * 2 + 10, verseHeight + 10)
    }
    
    // 设置文本颜色
    ctx.fillStyle = highlightedVerse === verseIndex ? '#ffff00' : '#ffffff' // 高亮时为黄色，否则为白色
    
    // 渲染每一行
    lines.forEach(lineText => {
      if (y >= -lineHeight && y <= rect.height) { // 只渲染可见的行
        ctx.fillText(lineText, padding, y)
      }
      y += lineHeight
    })
    
    y += fontSizePx * 0.2 // verse间距
  })
  
  // 在底部添加额外空行以确保完全显示
  y += lineHeight * 3 // 添加3行额外空间
}

// 渲染混合高亮状态（与control.js保持一致）
function renderBlendedHighlight(fromIndex, toIndex, progress) {
  if (!currentData || !ctx) return
  
  const rect = canvas.getBoundingClientRect()
  ctx.clearRect(0, 0, rect.width, rect.height)
  
  // 设置字体和颜色
  const fontSizePx = (fontSize / 100) * rect.height // 将vh转换为px
  ctx.font = `${fontSizePx}px "Microsoft YaHei", Arial, sans-serif`
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  
  const padding = rect.width * 0.06 // 6vw
  const paddingTop = rect.height * 0.04 // 4vh
  let y = paddingTop - scrollOffset
  
  // 渲染标题
  const { meta, verses } = currentData
  const metaText = `${meta.book} 第${meta.chapter}章 ${meta.range[0]}-${meta.range[1]}`
  
  ctx.fillStyle = '#bbbbbb'
  ctx.font = `${fontSizePx * 0.7}px "Microsoft YaHei", Arial, sans-serif`
  ctx.fillText(metaText, padding, y)
  y += fontSizePx * 0.7 * 1.6 + rect.height * 0.01 // 1vh margin
  
  // 渲染经文
  ctx.font = `${fontSizePx}px "Microsoft YaHei", Arial, sans-serif`
  
  const lineHeight = fontSizePx * 1.6
  const maxWidth = Math.floor(rect.width - padding * 2) // 向下取整确保一致性
  
  verses.forEach((verse, verseIndex) => {
    const text = `${verse.VerseSN}. ${verse.strjw}`
    
    // 完全统一的文本换行算法
    const lines = wrapText(ctx, text, maxWidth)
    
    // 计算当前经文的总高度
    const verseHeight = lines.length * lineHeight
    const verseStartY = y
    
    // 计算高亮强度
    let highlightIntensity = 0
    if (verseIndex === fromIndex) {
      highlightIntensity = 1 - progress // 旧高亮淡出
    } else if (verseIndex === toIndex) {
      highlightIntensity = progress // 新高亮淡入
    }
    
    // 如果有高亮效果，绘制背景
    if (highlightIntensity > 0) {
      ctx.fillStyle = `rgba(30, 144, 255, ${0.3 * highlightIntensity})` // 根据强度调整透明度
      ctx.fillRect(padding - 5, verseStartY - 5, rect.width - padding * 2 + 10, verseHeight + 10)
    }
    
    // 设置文本颜色（平滑过渡）
    if (highlightIntensity > 0) {
      // 从白色到黄色的过渡
      const r = Math.round(255)
      const g = Math.round(255)
      const b = Math.round(255 * (1 - highlightIntensity))
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
    } else {
      ctx.fillStyle = '#ffffff'
    }
    
    // 渲染每一行
    lines.forEach(lineText => {
      if (y >= -lineHeight && y <= rect.height) { // 只渲染可见的行
        ctx.fillText(lineText, padding, y)
      }
      y += lineHeight
    })
    
    y += fontSizePx * 0.2 // verse间距
  })
  
  // 在底部添加额外空行以确保完全显示
  y += lineHeight * 3 // 添加3行额外空间
}

// 统一的文本换行函数（与control.js完全相同）- 更保守的换行策略
function wrapText(ctx, text, maxWidth) {
  const words = text.split('')
  let line = ''
  let lines = []
  
  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i]
    const metrics = ctx.measureText(testLine)
    const width = metrics.width
    
    // 使用更保守的阈值，为投影窗口预留更多空间
    if (width > (maxWidth * 0.98) && line !== '') { // 98%的宽度作为阈值
      lines.push(line)
      line = words[i]
    } else {
      line = testLine
    }
  }
  if (line !== '') {
    lines.push(line)
  }
  
  return lines
}

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
  const titleHeight = fontSizePx * 0.7 * 1.6 + rect.height * 0.01
  
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
  const titleHeight = fontSizePx * 0.7 * 1.6 + rect.height * 0.01
  
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
  const titleHeight = fontSizePx * 0.7 * 1.6 + rect.height * 0.01
  
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
  
  // 使用即时滚动 - 添加调试日志
  const targetOffset = percent * maxScroll
  console.log(`Projector scroll: percent=${percent}, maxScroll=${maxScroll}, targetOffset=${targetOffset}`)
  instantScrollTo(targetOffset)
})

// 字体大小变化处理
window.api.onFontSizeChange((size) => {
  console.log('Font size changed to:', size)
  fontSize = size
  renderContent()
})

// 经文高亮处理（支持丝滑动画但不触发额外滚动）
window.api.onVerseHighlight((verseIndex) => {
  console.log('Received verse highlight:', verseIndex)
  
  if (verseIndex !== highlightedVerse) {
    // 只更新高亮状态，不触发滚动（滚动由控制窗口的滚动同步负责）
    highlightedVerse = verseIndex
    renderContent()
    console.log('Updated highlight to verse:', verseIndex)
  }
})

// 滚动到指定经文（与control.js保持一致）
function scrollToVerse(verseIndex) {
  if (!currentData || verseIndex < 0 || verseIndex >= currentData.verses.length) return
  
  const rect = canvas.getBoundingClientRect()
  const fontSizePx = (fontSize / 100) * rect.height
  const lineHeight = fontSizePx * 1.6
  const paddingTop = rect.height * 0.04
  const titleHeight = fontSizePx * 0.7 * 1.6 + rect.height * 0.01
  
  let targetY = paddingTop + titleHeight
  
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
  
  // 设置滚动位置使目标经文在屏幕中央
  const centerOffset = rect.height / 3
  const targetScrollOffset = Math.max(0, targetY - centerOffset)
  
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
    
    // 使用更平滑的easeInOut缓动函数
    const easedProgress = progress < 0.5 
      ? 2 * progress * progress 
      : -1 + (4 - 2 * progress) * progress
    
    // 渲染混合状态
    renderBlendedHighlight(fromIndex, toIndex, easedProgress)
    
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

console.log('Projector event listeners registered')
