// control.js - Canvas版本
const quick = document.getElementById('quick')
const preview = document.getElementById('preview') // Canvas元素
const meta = document.getElementById('meta')
const btnToggle = document.getElementById('btnToggle')
const btnExit = document.getElementById('btnExit')
const selDisplay = document.getElementById('display')
const suggestions = document.getElementById('suggestions')
const fontSize = document.getElementById('fontSize')
const fontSizeValue = document.getElementById('fontSizeValue')

let projectorRunning = false
let aspect = 16/9 // 默认比例
let currentSuggestions = []
let currentData = null
let currentFontSize = 8 // 与HTML中的默认值保持一致
let previewScrollOffset = 0
let highlightedVerse = -1 // 当前高亮的经文索引，-1表示无高亮

// 动画和双击检测相关
let lastKeyPressTime = 0
let lastKeyPressed = null
let animationDuration = 300 // 动画持续时间（毫秒）
let isAnimating = false

// 平滑滚动相关
let targetScrollOffset = 0
let currentScrollOffset = 0
let scrollAnimationId = null
let isScrolling = false

// Canvas相关
let ctx // 定义为变量而不是常量

function setPreviewAspect(w, h) {
  aspect = w / h
  // 让预览高度跟随宽度计算
  const width = preview.clientWidth || 360
  const height = Math.round(width / aspect)
  preview.style.height = height + 'px'
  
  // 设置Canvas尺寸
  setupPreviewCanvas()
}

// 设置预览Canvas尺寸
function setupPreviewCanvas() {
  const rect = preview.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  
  preview.width = rect.width * dpr
  preview.height = rect.height * dpr
  
  // 重新获取context并设置缩放
  ctx = preview.getContext('2d')
  ctx.scale(dpr, dpr)
  
  // 设置与投影相同的文本渲染属性
  ctx.textRendering = 'optimizeLegibility'
  ctx.fontKerning = 'normal'
  
  renderPreviewContent()
}

// 渲染预览内容（与投影窗口相同的渲染逻辑）
function renderPreviewContent() {
  if (!currentData || !ctx) return
  
  const rect = preview.getBoundingClientRect()
  ctx.clearRect(0, 0, rect.width, rect.height)
  
  // 设置字体和颜色 - 确保与projector.js完全一致
  const fontSizePx = (currentFontSize / 100) * rect.height // 将vh转换为px
  ctx.font = `${fontSizePx}px "Microsoft YaHei", Arial, sans-serif`
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  
  const padding = rect.width * 0.06 // 6vw
  const paddingTop = rect.height * 0.04 // 4vh
  let y = paddingTop - previewScrollOffset
  
  // 渲染标题
  const { meta: metaData, verses } = currentData
  const metaText = `${metaData.book} 第${metaData.chapter}章 ${metaData.range[0]}-${metaData.range[1]}`
  
  ctx.fillStyle = '#bbbbbb'
  ctx.font = `${fontSizePx * 0.7}px "Microsoft YaHei", Arial, sans-serif`
  ctx.fillText(metaText, padding, y)
  y += fontSizePx * 0.7 * 1.6 + rect.height * 0.01 // 1vh margin
  
  // 渲染经文
  ctx.font = `${fontSizePx}px "Microsoft YaHei", Arial, sans-serif`
  
  const lineHeight = fontSizePx * 1.6
  const maxWidth = Math.floor(rect.width - padding * 2) // 向下取整确保一致性
  
  console.log(`PREVIEW: Canvas ${rect.width}x${rect.height}, fontSize=${fontSizePx}px, maxWidth=${maxWidth}`)
  
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

// 统一的文本换行函数 - 更保守的换行策略
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

// 平滑滚动到目标位置（恢复丝滑效果）
function smoothScrollTo(targetOffset) {
  // 取消任何正在进行的滚动动画
  if (isScrolling) {
    cancelAnimationFrame(scrollAnimationId)
  }
  
  isScrolling = true
  targetScrollOffset = targetOffset
  const startOffset = previewScrollOffset
  const distance = targetOffset - startOffset
  const startTime = Date.now()
  const duration = 300 // 300ms动画时间
  
  function animate() {
    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / duration, 1)
    
    // 使用easeOutCubic缓动函数，提供丝滑的感觉
    const easeOutCubic = 1 - Math.pow(1 - progress, 3)
    
    previewScrollOffset = startOffset + distance * easeOutCubic
    renderPreviewContent()
    
    // 实时同步到投影窗口
    syncScrollToProjector()
    
    if (progress < 1) {
      scrollAnimationId = requestAnimationFrame(animate)
    } else {
      isScrolling = false
      previewScrollOffset = targetOffset // 确保最终位置精确
      renderPreviewContent()
      syncScrollToProjector()
    }
  }
  
  animate()
}

// 即时滚动函数（用于鼠标滚轮等需要即时响应的场景）
function instantScrollTo(targetOffset) {
  // 取消任何正在进行的滚动动画
  if (isScrolling) {
    cancelAnimationFrame(scrollAnimationId)
    isScrolling = false
  }
  
  // 直接设置滚动位置
  previewScrollOffset = targetOffset
  renderPreviewContent()
  
  // 立即同步到投影窗口
  syncScrollToProjector()
}

// 同步滚动到投影窗口（独立函数，避免重复计算）
function syncScrollToProjector() {
  if (!currentData) return
  
  const rect = preview.getBoundingClientRect()
  const fontSizePx = (currentFontSize / 100) * rect.height
  const lineHeight = fontSizePx * 1.6
  const paddingTop = rect.height * 0.04
  const titleHeight = fontSizePx * 0.7 * 1.6 + rect.height * 0.01
  
  let contentHeight = paddingTop + titleHeight
  const maxWidth = Math.floor(rect.width - rect.width * 0.06 * 2)
  
  const tempCanvas = document.createElement('canvas')
  const tempCtx = tempCanvas.getContext('2d')
  tempCtx.font = `${fontSizePx}px "Microsoft YaHei", Arial, sans-serif`
  
  currentData.verses.forEach(verse => {
    const text = `${verse.VerseSN}. ${verse.strjw}`
    const lines = wrapText(tempCtx, text, maxWidth)
    contentHeight += lines.length * lineHeight + fontSizePx * 0.2
  })
  
  contentHeight += lineHeight * 3
  const maxScroll = Math.max(0, contentHeight - rect.height)
  const percent = maxScroll > 0 ? previewScrollOffset / maxScroll : 0
  console.log(`Control scroll: offset=${previewScrollOffset}, maxScroll=${maxScroll}, percent=${percent}`)
  window.api.sendScroll(percent)
}

function renderVerses(payload) {
  const { meta: m, verses } = payload
  meta.textContent = `${m.book} 第${m.chapter}章 ${m.range[0]}-${m.range[1]}`
  
  // 保存数据并渲染Canvas
  currentData = payload
  previewScrollOffset = 0
  highlightedVerse = -1 // 重置高亮
  renderPreviewContent()
  
  // 同步到投影端
  window.api.sendContent(payload)
}

async function doSearch(text) {
  if (!text.trim()) return
  try {
    const res = await window.api.search(text)
    renderVerses(res)
    hideSuggestions()
  } catch (e) {
    meta.textContent = '解析/查询失败：' + e.message
    ctx.clearRect(0, 0, preview.width, preview.height)
  }
}

// 显示建议
async function showSuggestions(input) {
  try {
    const parts = input.split(/\s+/)
    
    if (parts.length === 1) {
      // 只有书卷拼音，显示书卷建议
      const sug = await window.api.getSuggestions(input)
      currentSuggestions = sug
      
      if (sug.length === 0) {
        hideSuggestions()
        return
      }
      
      suggestions.innerHTML = sug.map((item, index) => 
        `<div class="suggestion-item" data-index="${index}">
          <span class="suggestion-py">${item.py}</span>
          <span class="suggestion-name">${item.name}</span>
          <span class="suggestion-range">(${item.chapters}章)</span>
        </div>`
      ).join('')
      
    } else if (parts.length === 2 && parts[1] === '') {
      // 书卷名后跟空格，显示章节范围提示
      const bookSuggestions = await window.api.getSuggestions(parts[0])
      if (bookSuggestions.length > 0) {
        const book = bookSuggestions[0]
        suggestions.innerHTML = `
          <div class="suggestion-item info-only">
            <span class="suggestion-py">${book.py}</span>
            <span class="suggestion-name">${book.name}</span>
            <span class="suggestion-range">章节范围: ${book.chapters}</span>
          </div>`
      } else {
        hideSuggestions()
        return
      }
      
    } else if (parts.length === 2 && parts[1] !== '') {
      // 正在输入章节号，显示章节范围提示
      const bookSuggestions = await window.api.getSuggestions(parts[0])
      if (bookSuggestions.length > 0) {
        const book = bookSuggestions[0]
        const chapter = parseInt(parts[1])
        if (!isNaN(chapter)) {
          suggestions.innerHTML = `
            <div class="suggestion-item info-only">
              <span class="suggestion-py">${book.py} ${chapter}</span>
              <span class="suggestion-name">${book.name}</span>
              <span class="suggestion-range">章节范围: ${book.chapters}</span>
            </div>`
        } else {
          suggestions.innerHTML = `
            <div class="suggestion-item info-only">
              <span class="suggestion-py">${book.py}</span>
              <span class="suggestion-name">${book.name}</span>
              <span class="suggestion-range">章节范围: ${book.chapters}</span>
            </div>`
        }
      } else {
        hideSuggestions()
        return
      }
      
    } else if (parts.length === 3 && parts[2] === '') {
      // 书卷名 章节号 后跟空格，显示节数范围
      const py = parts[0]
      const chapter = parseInt(parts[1])
      
      if (!isNaN(chapter)) {
        try {
          const bookSuggestions = await window.api.getSuggestions(py)
          const verseRange = await window.api.getVerseRange(py, chapter)
          if (verseRange.maxVerse > 0 && bookSuggestions.length > 0) {
            const book = bookSuggestions[0]
            suggestions.innerHTML = `
              <div class="suggestion-item info-only">
                <span class="suggestion-py">${py} ${chapter}</span>
                <span class="suggestion-name">${book.name}</span>
                <span class="suggestion-range">节数范围: 1-${verseRange.maxVerse}</span>
              </div>`
          } else {
            hideSuggestions()
            return
          }
        } catch (e) {
          hideSuggestions()
          return
        }
      } else {
        hideSuggestions()
        return
      }
      
    } else if (parts.length === 3 && parts[2] !== '') {
      // 正在输入节数，显示节数范围
      const py = parts[0]
      const chapter = parseInt(parts[1])
      const verse = parseInt(parts[2])
      
      if (!isNaN(chapter)) {
        try {
          const bookSuggestions = await window.api.getSuggestions(py)
          const verseRange = await window.api.getVerseRange(py, chapter)
          if (verseRange.maxVerse > 0 && bookSuggestions.length > 0) {
            const book = bookSuggestions[0]
            let displayText = `${py} ${chapter}`
            if (!isNaN(verse)) {
              displayText += ` ${verse}`
            }
            suggestions.innerHTML = `
              <div class="suggestion-item info-only">
                <span class="suggestion-py">${displayText}</span>
                <span class="suggestion-name">${book.name}</span>
                <span class="suggestion-range">节数范围: 1-${verseRange.maxVerse}</span>
              </div>`
          } else {
            hideSuggestions()
            return
          }
        } catch (e) {
          hideSuggestions()
          return
        }
      } else {
        hideSuggestions()
        return
      }
      
    } else if (parts.length === 4 && (parts[3] === '' || parts[3] !== '')) {
      // 输入了起始节数，正在输入或已输入结束节数 (如 "CSJ 1 1 " 或 "CSJ 1 1 13")
      const py = parts[0]
      const chapter = parseInt(parts[1])
      const startVerse = parseInt(parts[2])
      const endVerse = parts[3] !== '' ? parseInt(parts[3]) : null
      
      if (!isNaN(chapter) && !isNaN(startVerse)) {
        try {
          const bookSuggestions = await window.api.getSuggestions(py)
          const verseRange = await window.api.getVerseRange(py, chapter)
          if (verseRange.maxVerse > 0 && bookSuggestions.length > 0) {
            const book = bookSuggestions[0]
            let displayText = `${py} ${chapter} ${startVerse}`
            if (endVerse !== null && !isNaN(endVerse)) {
              displayText += ` ${endVerse}`
            }
            suggestions.innerHTML = `
              <div class="suggestion-item info-only">
                <span class="suggestion-py">${displayText}</span>
                <span class="suggestion-name">${book.name}</span>
                <span class="suggestion-range">节数范围: 1-${verseRange.maxVerse} (${startVerse}${endVerse ? `-${endVerse}` : ''})</span>
              </div>`
          } else {
            hideSuggestions()
            return
          }
        } catch (e) {
          hideSuggestions()
          return
        }
      } else {
        hideSuggestions()
        return
      }
      
    } else {
      hideSuggestions()
      return
    }
    
    suggestions.style.display = 'block'
  } catch (e) {
    console.error('获取建议失败:', e)
    hideSuggestions()
  }
}

// 隐藏建议
function hideSuggestions() {
  suggestions.style.display = 'none'
  currentSuggestions = []
}

// 选择建议项
function selectSuggestion(index) {
  if (index >= 0 && index < currentSuggestions.length) {
    const item = currentSuggestions[index]
    quick.value = item.py + ' '
    quick.focus()
    hideSuggestions()
  }
}

quick.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    doSearch(quick.value)
  } else if (e.key === 'Escape') {
    hideSuggestions()
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    const items = suggestions.querySelectorAll('.suggestion-item')
    if (items.length > 0) {
      items[0].click()
    }
  }
})

quick.addEventListener('input', (e) => {
  const input = e.target.value
  if (input.length > 0) {
    const parts = input.split(/\s+/)
    
    // 检查输入的不同阶段
    if (parts.length === 1 && !input.endsWith(' ')) {
      // 正在输入书卷拼音
      showSuggestions(input.trim())
    } else if (parts.length === 2 && input.endsWith(' ')) {
      // 书卷拼音后跟空格，显示章节范围
      showSuggestions(input)
    } else if (parts.length === 2 && !input.endsWith(' ')) {
      // 正在输入章节号，显示章节范围建议
      showSuggestions(input)
    } else if (parts.length === 3 && input.endsWith(' ')) {
      // 章节号后跟空格，显示节数范围
      showSuggestions(input)
    } else if (parts.length === 3 && !input.endsWith(' ')) {
      // 正在输入节数，显示节数范围建议
      showSuggestions(input)
    } else if (parts.length === 4 && input.endsWith(' ')) {
      // 输入了起始节数后跟空格，显示范围建议
      showSuggestions(input)
    } else if (parts.length === 4 && !input.endsWith(' ')) {
      // 正在输入结束节数，显示范围建议
      showSuggestions(input)
    } else if (parts.length >= 5) {
      // 输入完整范围格式或更多部分，隐藏建议
      hideSuggestions()
    }
  } else {
    hideSuggestions()
  }
})

quick.addEventListener('blur', () => {
  // 延迟隐藏，允许点击建议项
  setTimeout(hideSuggestions, 200)
})

// 建议项点击事件
suggestions.addEventListener('click', (e) => {
  const item = e.target.closest('.suggestion-item')
  if (item) {
    const index = parseInt(item.dataset.index)
    // 只有在显示书卷建议时才允许点击选择
    const input = quick.value
    const parts = input.split(/\s+/)
    
    if (parts.length === 1 && !input.endsWith(' ')) {
      // 只有在输入书卷拼音阶段才允许点击选择
      selectSuggestion(index)
    }
    // 对于章节范围和节数范围的提示，点击不做任何操作，只是显示信息
  }
})

// 预览滚动同步（平滑滚动版本）
preview.addEventListener('wheel', (e) => {
  if (!currentData) return
  
  e.preventDefault()
  const rect = preview.getBoundingClientRect()
  
  // 精确计算总内容高度
  const fontSizePx = (currentFontSize / 100) * rect.height
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
  let targetOffset = previewScrollOffset + e.deltaY * scrollSpeed
  targetOffset = Math.max(0, Math.min(maxScroll, targetOffset))
  
  // 使用平滑滚动提供丝滑体验
  smoothScrollTo(targetOffset)
})

// 投影控制
btnToggle.addEventListener('click', async () => {
  const res = await window.api.projectorToggle()
  projectorRunning = res.running
  btnToggle.textContent = projectorRunning ? '关闭投影' : '开始投影'
  
  if (projectorRunning && currentData) {
    // 投影窗口刚开启，同步当前显示的内容
    setTimeout(() => {
      window.api.sendContent(currentData)
      console.log('Synced current content to projector')
    }, 500)
  }
})

// 退出
btnExit.addEventListener('click', () => window.close())

// 显示器列表
async function loadDisplays() {
  const arr = await window.api.displays()
  selDisplay.innerHTML = arr.map(d => `<option value="${d.id}">${d.label}</option>`).join('')
  if (arr.length) setPreviewAspect(arr[0].width, arr[0].height)
}

selDisplay.addEventListener('change', async () => {
  const id = Number(selDisplay.value)
  await window.api.setDisplay(id)
})

// 主进程推送的显示信息（当开启投影时）
window.api.onDisplayInfo((d) => setPreviewAspect(d.width, d.height))

window.addEventListener('resize', () => {
  // 维持预览比例
  const width = preview.clientWidth || 360
  const height = Math.round(width / aspect)
  preview.style.height = height + 'px'
  setupPreviewCanvas()
})

// 字体大小控制
fontSize.addEventListener('input', () => {
  const size = parseFloat(fontSize.value)
  fontSizeValue.textContent = size + 'vh'
  currentFontSize = size
  
  // 重新渲染预览
  renderPreviewContent()
  
  // 发送到投影窗口
  window.api.setFontSize(size)
})

// 监听投影窗口关闭事件
window.api.onProjectorClosed(() => {
  projectorRunning = false
  btnToggle.textContent = '开始投影'
})

// 监听默认内容
window.api.onDefaultContent((content) => {
  console.log('收到默认内容:', content)
  if (content && !content.error) {
    renderVerses(content)
  }
})

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  ctx = preview.getContext('2d')
  setupPreviewCanvas()
})

// 如果DOM已经加载，立即初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    ctx = preview.getContext('2d')
    setupPreviewCanvas()
  })
} else {
  ctx = preview.getContext('2d')
  setupPreviewCanvas()
}

// 初始化
loadDisplays()
setupPreviewCanvas()

// 经文高亮函数（支持动画）
function highlightVerse(verseIndex, withAnimation = false) {
  if (!currentData || verseIndex < -1 || verseIndex >= currentData.verses.length || isAnimating) return
  
  if (withAnimation && verseIndex >= 0) {
    // 使用动画过渡
    animateHighlight(highlightedVerse, verseIndex)
  } else {
    // 立即切换
    highlightedVerse = verseIndex
    renderPreviewContent()
    
    // 同步到投影窗口
    window.api.highlightVerse(verseIndex)
    
    // 自动滚动到高亮经文
    if (verseIndex >= 0) {
      scrollToVerse(verseIndex)
    }
  }
}

// 动画高亮过渡（更丝滑的过渡效果）
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
    
    // 直接在两个高亮之间平滑过渡，不消失
    const blendedIndex = fromIndex + (toIndex - fromIndex) * easedProgress
    
    // 渲染混合状态
    renderBlendedHighlight(fromIndex, toIndex, easedProgress)
    
    if (progress < 1) {
      requestAnimationFrame(animate)
    } else {
      // 动画完成
      isAnimating = false
      highlightedVerse = toIndex
      renderPreviewContent()
      
      // 同步到投影窗口
      window.api.highlightVerse(toIndex)
      
      // 自动滚动到高亮经文
      scrollToVerse(toIndex)
    }
  }
  
  animate()
}

// 渲染混合高亮状态
function renderBlendedHighlight(fromIndex, toIndex, progress) {
  if (!currentData || !ctx) return
  
  const rect = preview.getBoundingClientRect()
  ctx.clearRect(0, 0, rect.width, rect.height)
  
  // 设置字体和颜色 - 确保与projector.js完全一致
  const fontSizePx = (currentFontSize / 100) * rect.height // 将vh转换为px
  ctx.font = `${fontSizePx}px "Microsoft YaHei", Arial, sans-serif`
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  
  const padding = rect.width * 0.06 // 6vw
  const paddingTop = rect.height * 0.04 // 4vh
  let y = paddingTop - previewScrollOffset
  
  // 渲染标题
  const { meta: metaData, verses } = currentData
  const metaText = `${metaData.book} 第${metaData.chapter}章 ${metaData.range[0]}-${metaData.range[1]}`
  
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

// 滚动到指定经文
function scrollToVerse(verseIndex) {
  if (!currentData || verseIndex < 0 || verseIndex >= currentData.verses.length) return
  
  const rect = preview.getBoundingClientRect()
  const fontSizePx = (currentFontSize / 100) * rect.height
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

// Canvas点击事件 - 检测点击的经文
preview.addEventListener('click', (e) => {
  if (!currentData) return
  
  const rect = preview.getBoundingClientRect()
  const clickY = e.clientY - rect.top + previewScrollOffset
  const fontSizePx = (currentFontSize / 100) * rect.height
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
        highlightVerse(-1)
      } else {
        // 高亮当前经文
        highlightVerse(i)
      }
      return
    }
    
    currentY += verseHeight + fontSizePx * 0.2
  }
  
  // 如果点击的不是任何经文，取消高亮
  highlightVerse(-1)
})

// 键盘导航（支持双击检测和下一段跳转）
document.addEventListener('keydown', (e) => {
  if (!currentData || isAnimating) return
  
  // 只在没有焦点在输入框时处理键盘事件
  if (document.activeElement === quick) return
  
  const currentTime = Date.now()
  const isDoubleClick = (currentTime - lastKeyPressTime) < 400 && lastKeyPressed === e.key
  
  lastKeyPressTime = currentTime
  lastKeyPressed = e.key
  
  switch (e.key) {
    case 'ArrowUp':
      e.preventDefault()
      if (isDoubleClick) {
        // 双击上键：跳到上一段的开始
        jumpToPreviousParagraph()
      } else {
        // 单击上键：上一节
        if (highlightedVerse > 0) {
          highlightVerse(highlightedVerse - 1, true)
        } else if (highlightedVerse === -1 && currentData.verses.length > 0) {
          highlightVerse(currentData.verses.length - 1, true) // 从最后一个开始
        }
      }
      break
      
    case 'ArrowDown':
      e.preventDefault()
      if (isDoubleClick) {
        // 双击下键：追加下一节经文
        appendNextVerse()
      } else {
        // 单击下键：下一节
        if (highlightedVerse < currentData.verses.length - 1) {
          highlightVerse(highlightedVerse + 1, true)
        } else if (highlightedVerse === -1 && currentData.verses.length > 0) {
          highlightVerse(0, true) // 从第一个开始
        }
      }
      break
      
    case 'Escape':
      e.preventDefault()
      highlightVerse(-1) // 取消高亮
      break
  }
})

// 跳到下一段的开始
function jumpToNextParagraph() {
  if (!currentData || highlightedVerse === -1) return
  
  const currentVerse = highlightedVerse
  let nextParagraphStart = -1
  
  // 查找下一段的开始（通常以诗篇的分段或章节的自然分段）
  // 这里简化为每10节为一段，你可以根据实际需要调整
  const currentParagraph = Math.floor(currentVerse / 10)
  const nextParagraph = currentParagraph + 1
  nextParagraphStart = nextParagraph * 10
  
  // 确保不超出范围
  if (nextParagraphStart < currentData.verses.length) {
    highlightVerse(nextParagraphStart, true)
  }
}

// 跳到上一段的开始
function jumpToPreviousParagraph() {
  if (!currentData || highlightedVerse === -1) return
  
  const currentVerse = highlightedVerse
  let previousParagraphStart = -1
  
  // 查找上一段的开始
  const currentParagraph = Math.floor(currentVerse / 10)
  const previousParagraph = Math.max(0, currentParagraph - 1)
  previousParagraphStart = previousParagraph * 10
  
  // 如果已经在段落开始，跳到更前面的段落
  if (previousParagraphStart === currentVerse && previousParagraph > 0) {
    previousParagraphStart = (previousParagraph - 1) * 10
  }
  
  highlightVerse(previousParagraphStart, true)
}

// 追加下一节经文
async function appendNextVerse() {
  if (!currentData) return
  
  const { meta } = currentData
  const currentMaxVerse = Math.max(...currentData.verses.map(v => v.VerseSN))
  
  try {
    console.log(`尝试获取下一节: ${meta.py} ${meta.chapter} ${currentMaxVerse + 1}`)
    
    // 获取下一节经文
    const nextVerseResult = await window.api.getNextVerse(meta.py, meta.chapter, currentMaxVerse)
    
    if (nextVerseResult.error) {
      console.log('已经是本章最后一节，不追加')
      return
    }
    
    if (nextVerseResult.verses && nextVerseResult.verses.length > 0) {
      // 记录当前最后一节的索引（追加前）
      const lastVerseIndex = currentData.verses.length - 1
      
      // 追加新经文到当前数据
      const newVerse = nextVerseResult.verses[0]
      currentData.verses.push(newVerse)
      
      // 更新范围信息
      currentData.meta.range[1] = newVerse.VerseSN
      
      // 更新显示
      const { meta: m } = currentData
      meta.textContent = `${m.book} 第${m.chapter}章 ${m.range[0]}-${m.range[1]}`
      
      // 重新渲染
      renderPreviewContent()
      
      // 新追加的经文索引
      const newVerseIndex = currentData.verses.length - 1
      
      // 如果有高亮的经文，从当前高亮经文平滑过渡到新经文
      if (highlightedVerse >= 0) {
        // 使用动画从当前高亮经文过渡到新经文
        animateHighlight(highlightedVerse, newVerseIndex)
      } else {
        // 如果没有高亮经文，直接高亮新经文并平滑滚动到它
        highlightedVerse = newVerseIndex
        renderPreviewContent()
        window.api.highlightVerse(newVerseIndex)
        
        // 平滑滚动到新经文
        scrollToVerse(newVerseIndex)
      }
      
      // 同步到投影窗口
      window.api.sendContent(currentData)
      
      console.log(`成功追加第${newVerse.VerseSN}节`)
    }
  } catch (error) {
    console.error('追加下一节失败:', error)
  }
}
