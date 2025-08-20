export let userSettings = {
  fontSize: 8,
  textColor: '#ffffff',
  backgroundColor: '#000000',
  highlightBackgroundColor: '#1e90ff',
  highlightTextColor: '#ffff00',
  scrollSpeed: 0.4, // 滚轮速度 (0.1-1.0)
  fixedTitle: true ,
  lineHeight: 1.6,
  // 快捷键设置
  keyPrevVerse: 'ArrowUp',
  keyNextVerse: 'ArrowDown',
  keyProject: 'F9',
  keyShowControl: 'Control+Space'
}

export function resetSettings() {
  userSettings = {
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
}

export function renderCanvasContent({ ctx,currentData,highlightedVerse = -1, canvasElement, scrollOffsetValue }) {
  if (!currentData || !ctx || !canvasElement) return
  const rect = canvasElement.getBoundingClientRect()

  // 设置背景色
  ctx.fillStyle = userSettings.backgroundColor
  ctx.fillRect(0, 0, rect.width, rect.height)

  // 设置字体和颜色
  const fontSizePx = (userSettings.fontSize / 100) * rect.height
  ctx.font = `${fontSizePx}px "Microsoft YaHei", Arial, sans-serif`
  ctx.fillStyle = userSettings.textColor
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  const padding = rect.width * 0.06
  const paddingTop = rect.height * 0.04

  // 渲染标题
  const { meta, verses } = currentData
  const metaText = `${meta.book} 第${meta.chapter}章 ${meta.range[0]}-${meta.range[1]}`
  const titleFontSize = fontSizePx * 0.7
  const titleHeight = titleFontSize + rect.height * 0.01

  if (userSettings.fixedTitle) {
    ctx.fillStyle = userSettings.backgroundColor
    ctx.fillRect(0, 0, rect.width, paddingTop + titleHeight)

    ctx.fillStyle = '#bbbbbb'
    ctx.font = `${titleFontSize}px "Microsoft YaHei", Arial, sans-serif`
    ctx.fillText(metaText, padding, paddingTop)
  }

  // 内容起始位置
  let contentStartY = userSettings.fixedTitle ? (paddingTop + titleHeight) : paddingTop
  let y = contentStartY - scrollOffsetValue

  if (!userSettings.fixedTitle) {
    ctx.fillStyle = '#bbbbbb'
    ctx.font = `${titleFontSize}px "Microsoft YaHei", Arial, sans-serif`
    ctx.fillText(metaText, padding, y)
    y += titleHeight
  }

  // 渲染经文
  ctx.font = `${fontSizePx}px "Microsoft YaHei", Arial, sans-serif`
  const lineHeight = fontSizePx * userSettings.lineHeight
  const maxWidth = Math.floor(rect.width - padding * 2)

  console.log(`Canvas ${rect.width}x${rect.height}, fontSize=${fontSizePx}px, maxWidth=${maxWidth}, fixedTitle=${userSettings.fixedTitle}`)

  verses.forEach((verse, verseIndex) => {
    const text = `${verse.VerseSN}. ${verse.strjw}`
    const lines = wrapText(ctx, text, maxWidth)
    const verseHeight = lines.length * lineHeight
    const verseStartY = y

    // 高亮
    if (highlightedVerse === verseIndex) {
      const rgba = hexToRgba(userSettings.highlightBackgroundColor, 0.3)
      ctx.fillStyle = rgba

      const highlightStartY = userSettings.fixedTitle ? Math.max(verseStartY - verseStartY * 0.10, contentStartY - contentStartY * 0.1) : verseStartY - verseStartY * 0.1
      const highlightHeight = userSettings.fixedTitle ? Math.min(verseHeight, rect.height - highlightStartY) : verseHeight
      ctx.fillRect(padding - 5, highlightStartY, rect.width - padding * 2 + 10, highlightHeight)
    }

    // 文本颜色
    ctx.fillStyle = highlightedVerse === verseIndex ? userSettings.highlightTextColor : userSettings.textColor

    // 渲染每一行
    lines.forEach(lineText => {
      const minY = userSettings.fixedTitle ? contentStartY : -lineHeight
      if (y >= minY && y <= rect.height) {
        ctx.fillText(lineText, padding, y)
      }
      y += lineHeight
    })

    y += fontSizePx * 0.2
  })

  // 底部额外空行
  y += lineHeight * 3
}

// 设置Canvas尺寸
export function setupCanvas(canvas, ctx, callback = () => {}) {
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

  if (callback instanceof Function) callback()
}

export function wrapText(ctx, text, maxWidth) {
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


// 颜色转换函数
export function hexToRgba(hex, alpha = 1) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}