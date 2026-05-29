export let userSettings = {
  fontSize: 7,
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

const DUAL_LANGUAGE_FONT_SCALE = 0.58
const DUAL_LANGUAGE_LINE_HEIGHT = 1.28
const VERSE_SPACING_SCALE = 0.34

export async function resetSettings() {
userSettings = await window.api.getDefaultSettings()
}

export function getVerseText(verse, language = 'primary') {
  if (language === 'secondary') {
    return `${verse.VerseSN} ${verse.secondaryText || ''}`.trim()
  }
  return `${verse.VerseSN} ${verse.strjw}`
}

export function getDualLayoutMetrics(rect) {
  const padding = rect.width * 0.025
  const maxWidth = Math.floor(rect.width - padding * 2)
  const columnGap = Math.max(14, maxWidth * 0.025)
  const columnWidth = Math.floor((maxWidth - columnGap) / 2)
  return { padding, maxWidth, columnGap, columnWidth }
}

export function getRenderFontSize(fontSize, dualLanguage = false) {
  return dualLanguage ? fontSize * DUAL_LANGUAGE_FONT_SCALE : fontSize
}

export function getRenderLineHeight(fontSizePx, dualLanguage = false) {
  return fontSizePx * (dualLanguage ? DUAL_LANGUAGE_LINE_HEIGHT : userSettings.lineHeight)
}

export function getVerseSpacing(fontSizePx) {
  return fontSizePx * VERSE_SPACING_SCALE
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
  const displayFontSize = getRenderFontSize(fontSize, dualLanguage)
  const fontSizePx = (displayFontSize / 100) * rect.height
  const lineHeight = getRenderLineHeight(fontSizePx, dualLanguage)
  const { padding, maxWidth } = getDualLayoutMetrics(rect)
  const paddingTop = rect.height * 0.04
  const titleHeight = fontSizePx * 0.7 + rect.height * 0.01
  const previousFont = ctx.font
  ctx.font = `${fontSizePx}px "Microsoft YaHei", Arial, sans-serif`

  let contentHeight = paddingTop + titleHeight + 10
  currentData.verses.forEach(verse => {
    contentHeight += measureVerseHeight(ctx, verse, maxWidth, lineHeight, maxWidth * 0.08, dualLanguage)
    contentHeight += getVerseSpacing(fontSizePx)
  })
  contentHeight += lineHeight * 3
  ctx.font = previousFont
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
  let effectiveFontSize = userSettings.autoFit
    ? autoFitFontSize({ ctx, currentData, canvasElement })
    : userSettings.fontSize

  if (!userSettings.autoFit && currentData.verses.length <= 1) {
    const contentHeight = measureContentHeight({
      ctx,
      currentData,
      canvasElement,
      fontSize: effectiveFontSize,
      dualLanguage
    })
    if (contentHeight > rect.height * 0.96) {
      effectiveFontSize = autoFitFontSize({
        ctx,
        currentData,
        canvasElement,
        minSize: 2,
        maxSize: effectiveFontSize
      })
    }
  }
  const displayFontSize = getRenderFontSize(effectiveFontSize, dualLanguage)
  const fontSizePx = (displayFontSize / 100) * rect.height
  ctx.font = `${fontSizePx}px "Microsoft YaHei", Arial, sans-serif`
  ctx.fillStyle = userSettings.textColor
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  const { padding, maxWidth, columnGap, columnWidth } = getDualLayoutMetrics(rect)
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
  const lineHeight = getRenderLineHeight(fontSizePx, dualLanguage)

  console.log(`Canvas ${rect.width}x${rect.height}, fontSize=${fontSizePx}px, maxWidth=${maxWidth}, fixedTitle=${userSettings.fixedTitle}`)

  verses.forEach((verse, verseIndex) => {
    const activeColumnWidth = dualLanguage ? columnWidth : maxWidth
    const primaryLines = wrapText(ctx, getVerseText(verse), activeColumnWidth)
    const secondaryLines = dualLanguage ? wrapText(ctx, getVerseText(verse, 'secondary'), columnWidth) : []
    const primaryHeight = primaryLines.length * lineHeight
    const secondaryHeight = secondaryLines.length * lineHeight
    const verseHeight = dualLanguage ? Math.max(primaryHeight, secondaryHeight) : primaryHeight
    const verseStartY = y

    ctx.fillStyle = highlightedVerse === verseIndex ? userSettings.highlightTextColor : userSettings.textColor

    const primaryStartY = dualLanguage ? verseStartY + (verseHeight - primaryHeight) / 2 : verseStartY
    let primaryY = primaryStartY
    primaryLines.forEach(lineText => {
      const minY = userSettings.fixedTitle ? contentStartY : -lineHeight
      if (primaryY >= minY && primaryY <= rect.height) {
        ctx.fillText(lineText, padding, primaryY)
      }
      primaryY += lineHeight
    })

    if (dualLanguage) {
      const secondaryX = padding + columnWidth + columnGap
      let secondaryY = verseStartY + (verseHeight - secondaryHeight) / 2
      ctx.fillStyle = highlightedVerse === verseIndex ? userSettings.highlightTextColor : '#7da7ff'
      secondaryLines.forEach(lineText => {
        const minY = userSettings.fixedTitle ? contentStartY : -lineHeight
        if (secondaryY >= minY && secondaryY <= rect.height) {
          ctx.fillText(lineText, secondaryX, secondaryY)
        }
        secondaryY += lineHeight
      })
      y = verseStartY + verseHeight
    } else {
      y = primaryY
    }

    y += getVerseSpacing(fontSizePx)
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
  const hasWordSpacing = /[A-Za-zÀ-ÿ]/.test(text) && /\s/.test(text)
  if (hasWordSpacing) {
    return wrapTextByWords(ctx, text, maxWidth)
  }

  const words = text.split('')
  let line = ''
  let lines = []
  
  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i]
    const metrics = ctx.measureText(testLine)
    const width = metrics.width
    
    // 使用更保守的阈值，为投影窗口预留更多空间
    if (width > (maxWidth * 0.995) && line !== '') { // 尽量用满列宽
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

function wrapTextByWords(ctx, text, maxWidth) {
  const limit = maxWidth * 0.995
  const tokens = text.trim().split(/\s+/)
  const lines = []
  let line = ''

  tokens.forEach(token => {
    const testLine = line ? `${line} ${token}` : token
    if (ctx.measureText(testLine).width <= limit || !line) {
      if (ctx.measureText(testLine).width <= limit) {
        line = testLine
        return
      }
    }

    if (line) {
      lines.push(line)
      line = ''
    }

    if (ctx.measureText(token).width <= limit) {
      line = token
    } else {
      const split = splitLongToken(ctx, token, limit)
      lines.push(...split.slice(0, -1))
      line = split[split.length - 1] || ''
    }
  })

  if (line) lines.push(line)
  return lines
}

function splitLongToken(ctx, token, limit) {
  const lines = []
  let line = ''

  for (const char of token) {
    const testLine = line + char
    if (ctx.measureText(testLine).width > limit && line) {
      lines.push(line)
      line = char
    } else {
      line = testLine
    }
  }

  if (line) lines.push(line)
  return lines
}

// 颜色转换函数
export function hexToRgba(hex, alpha = 1) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
