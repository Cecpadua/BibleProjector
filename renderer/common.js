export let userSettings = {
  fontSize: 8,
  textColor: '#ffffff',
  backgroundColor: '#000000',
  highlightBackgroundColor: '#1e90ff',
  highlightTextColor: '#ffff00',
  scrollSpeed: 0.4, // 滚轮速度 (0.1-1.0)
  fixedTitle: true ,
  lineHeight: 1.6,
  dualLanguage: true,
  primaryVersion: 'CUNPSS',
  secondaryVersion: 'NR06',
  // 快捷键设置
  keyPrevVerse: 'ArrowUp',
  keyNextVerse: 'ArrowDown',
  keyProject: 'F9',
  keyShowControl: 'Control+Space',
  autoFit: false  // 自动适配：缩小字体让整章在屏幕内完整显示
}

export async function resetSettings() {
userSettings = await window.api.getDefaultSettings()
}

export function getVerseText(verse, language = 'primary') {
  if (language === 'secondary') {
    return `${verse.VerseSN}  ${verse.secondaryText || ''}`.trim()
  }
  return `${verse.VerseSN}. ${verse.strjw}`
}

export function measureVerseHeight(ctx, verse, maxWidth, lineHeight, gap = 0, dualLanguage = false) {
  if (!dualLanguage) {
    return wrapText(ctx, getVerseText(verse), maxWidth).length * lineHeight
  }

  const columnGap = gap || Math.max(18, maxWidth * 0.04)
  const columnWidth = Math.max(40, (maxWidth - columnGap) / 2)
  const primaryLines = wrapText(ctx, getVerseText(verse), columnWidth)
  const secondaryLines = wrapText(ctx, getVerseText(verse, 'secondary'), columnWidth)
  return Math.max(primaryLines.length, secondaryLines.length) * lineHeight
}

export function measureContentHeight({ ctx, currentData, canvasElement, fontSize, dualLanguage }) {
  if (!currentData || !ctx || !canvasElement) return 0

  const rect = canvasElement.getBoundingClientRect()
  const fontSizePx = (fontSize / 100) * rect.height
  const lineHeight = fontSizePx * userSettings.lineHeight
  const padding = rect.width * 0.06
  const paddingTop = rect.height * 0.04
  const titleHeight = fontSizePx * 0.7 + rect.height * 0.01
  const maxWidth = Math.floor(rect.width - padding * 2)

  let contentHeight = paddingTop + titleHeight + 10
  currentData.verses.forEach(verse => {
    contentHeight += measureVerseHeight(ctx, verse, maxWidth, lineHeight, maxWidth * 0.05, dualLanguage)
    contentHeight += fontSizePx * 0.32
  })
  contentHeight += lineHeight * 3
  return contentHeight
}

/**
 * 自动计算能让全部内容显示在画布内（不滚动）的字体大小。
 * 使用二分法在 minSize ~ maxSize 之间搜索。
 * 返回合适的 fontSize（单位：相对于画布高度的百分比，与 userSettings.fontSize 单位一致）。
 */
export function autoFitFontSize({ ctx, currentData, canvasElement, minSize = 2, maxSize = 12 }) {
  if (!currentData || !ctx || !canvasElement) return userSettings.fontSize
  const rect = canvasElement.getBoundingClientRect()
  const dualLanguage = !!(currentData.meta.dualLanguage && currentData.meta.secondaryVersion)

  let lo = minSize, hi = maxSize, best = minSize
  for (let iter = 0; iter < 20; iter++) {
    const mid = (lo + hi) / 2
    const h = measureContentHeight({ ctx, currentData, canvasElement, fontSize: mid, dualLanguage })
    if (h <= rect.height) {
      best = mid
      lo = mid
    } else {
      hi = mid
    }
    if (hi - lo < 0.05) break
  }
  return best
}

export function renderCanvasContent({ ctx,currentData,highlightedVerse = -1, canvasElement, scrollOffsetValue }) {
  if (!currentData || !ctx || !canvasElement) return
  const rect = canvasElement.getBoundingClientRect()

  // 设置背景色
  ctx.fillStyle = userSettings.backgroundColor
  ctx.fillRect(0, 0, rect.width, rect.height)

  // 设置字体和颜色
  // autoFit 模式：自动缩小字体让整章内容完整显示（不滚动），忽略 scrollOffsetValue
  const dualLanguage = !!(currentData.meta.dualLanguage && currentData.meta.secondaryVersion)
  const effectiveFontSize = userSettings.autoFit
    ? autoFitFontSize({ ctx, currentData, canvasElement })
    : userSettings.fontSize
  const fontSizePx = (effectiveFontSize / 100) * rect.height
  ctx.font = `${fontSizePx}px "Microsoft YaHei", Arial, sans-serif`
  ctx.fillStyle = userSettings.textColor
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  const padding = rect.width * 0.06
  const paddingTop = rect.height * 0.04

  // 渲染标题
  const { meta, verses } = currentData
  const metaText = `${meta.book} 第${meta.chapter}章 ${meta.range[0]}-${meta.range[1]}`
  // dualLanguage already declared above
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
  const effectiveScroll = userSettings.autoFit ? 0 : scrollOffsetValue
  let y = contentStartY + 10 - effectiveScroll

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
    const columnGap = Math.max(18, maxWidth * 0.05)
    const columnWidth = dualLanguage ? Math.floor((maxWidth - columnGap) / 2) : maxWidth
    const primaryLines = wrapText(ctx, getVerseText(verse), columnWidth)
    const secondaryLines = dualLanguage ? wrapText(ctx, getVerseText(verse, 'secondary'), columnWidth) : []
    const lineCount = dualLanguage ? Math.max(primaryLines.length, secondaryLines.length) : primaryLines.length
    const verseHeight = lineCount * lineHeight
    const verseStartY = y

    // 高亮
    if (highlightedVerse === verseIndex) {
      const rgba = hexToRgba(userSettings.highlightBackgroundColor, 0.3)
      ctx.fillStyle = rgba

      const highlightStartY = userSettings.fixedTitle ? (verseStartY - verseStartY * 0.10) : verseStartY - verseStartY * 0.1
      const highlightHeight = userSettings.fixedTitle ? Math.min(verseHeight, rect.height - highlightStartY) : verseHeight
      ctx.fillRect(padding - 5, highlightStartY, rect.width - padding * 2 + 10, highlightHeight)
    }

    ctx.fillStyle = highlightedVerse === verseIndex ? userSettings.highlightTextColor : userSettings.textColor

    primaryLines.forEach(lineText => {
      const minY = userSettings.fixedTitle ? contentStartY : -lineHeight
      if (y >= minY && y <= rect.height) {
        ctx.fillText(lineText, padding, y)
      }
      y += lineHeight
    })

    if (dualLanguage) {
      const secondaryX = padding + columnWidth + columnGap
      let secondaryY = verseStartY
      ctx.fillStyle = highlightedVerse === verseIndex ? userSettings.highlightTextColor : '#7da7ff'
      secondaryLines.forEach(lineText => {
        const minY = userSettings.fixedTitle ? contentStartY : -lineHeight
        if (secondaryY >= minY && secondaryY <= rect.height) {
          ctx.fillText(lineText, secondaryX, secondaryY)
        }
        secondaryY += lineHeight
      })
      y = verseStartY + verseHeight
    }

    y += fontSizePx * 0.32
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
