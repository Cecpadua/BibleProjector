export let userSettings = {
  fontSize: 8,
  textColor: '#ffffff',
  backgroundColor: '#000000',
  highlightBackgroundColor: '#1e90ff',
  highlightTextColor: '#ffff00',
  scrollSpeed: 0.4, // 滚轮速度 (0.1-1.0)
  fixedTitle: true,
  lineHeight: 1.6,
  dualLanguage: true,
  primaryVersion: 'CUNPSS',
  secondaryVersion: 'NR06',
  // 快捷键设置
  keyPrevVerse: 'ArrowUp',
  keyNextVerse: 'ArrowDown',
  keyProject: 'F9',
  keyShowControl: 'Control+Space',
  autoFit: false // 自动适配：缩小字体让整章在屏幕内完整显示
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

/**
 * 双语言布局：
 * 做成类似截图效果：
 * - 中文在左边
 * - 第二语言在右边
 * - 中间留出明显空白
 * - 第二语言区域稍宽
 * - 不改变字体大小
 */
function getDualColumnLayout(maxWidth) {
  const columnGap = Math.max(56, maxWidth * 0.085)

  const availableWidth = maxWidth - columnGap

  const primaryWidth = Math.floor(availableWidth * 0.43)
  const secondaryWidth = Math.floor(availableWidth * 0.57)

  return {
    columnGap,
    primaryWidth,
    secondaryWidth
  }
}

export function measureVerseHeight(ctx, verse, maxWidth, lineHeight, gap = 0, dualLanguage = false) {
  if (!dualLanguage) {
    return wrapText(ctx, getVerseText(verse), maxWidth).length * lineHeight
  }

  const layout = getDualColumnLayout(maxWidth)

  const primaryLines = wrapText(
    ctx,
    getVerseText(verse),
    layout.primaryWidth
  )

  const secondaryLines = wrapText(
    ctx,
    getVerseText(verse, 'secondary'),
    layout.secondaryWidth
  )

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

  const maxWidth = dualLanguage
    ? Math.floor(rect.width - padding * 1.15)
    : Math.floor(rect.width - padding * 2)

  let contentHeight = paddingTop + titleHeight + 10

  currentData.verses.forEach(verse => {
    contentHeight += measureVerseHeight(
      ctx,
      verse,
      maxWidth,
      lineHeight,
      0,
      dualLanguage
    )
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

  let lo = minSize
  let hi = maxSize
  let best = minSize

  for (let iter = 0; iter < 20; iter++) {
    const mid = (lo + hi) / 2

    const h = measureContentHeight({
      ctx,
      currentData,
      canvasElement,
      fontSize: mid,
      dualLanguage
    })

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

export function renderCanvasContent({
  ctx,
  currentData,
  highlightedVerse = -1,
  canvasElement,
  scrollOffsetValue
}) {
  if (!currentData || !ctx || !canvasElement) return

  const rect = canvasElement.getBoundingClientRect()

  // 设置背景色
  ctx.fillStyle = userSettings.backgroundColor
  ctx.fillRect(0, 0, rect.width, rect.height)

  const dualLanguage = !!(currentData.meta.dualLanguage && currentData.meta.secondaryVersion)

  // autoFit 模式才会自动缩小字体；普通模式不改变字体大小
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
  const contentStartY = userSettings.fixedTitle
    ? paddingTop + titleHeight
    : paddingTop

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

  // 双语言模式下稍微扩大可用宽度，让右侧更像截图
  const maxWidth = dualLanguage
    ? Math.floor(rect.width - padding * 1.15)
    : Math.floor(rect.width - padding * 2)

  console.log(
    `Canvas ${rect.width}x${rect.height}, fontSize=${fontSizePx}px, maxWidth=${maxWidth}, fixedTitle=${userSettings.fixedTitle}, dualLanguage=${dualLanguage}`
  )

  verses.forEach((verse, verseIndex) => {
    const layout = dualLanguage ? getDualColumnLayout(maxWidth) : null

    const primaryWidth = dualLanguage
      ? layout.primaryWidth
      : maxWidth

    const secondaryWidth = dualLanguage
      ? layout.secondaryWidth
      : 0

    const primaryLines = wrapText(
      ctx,
      getVerseText(verse),
      primaryWidth
    )

    const secondaryLines = dualLanguage
      ? wrapText(
          ctx,
          getVerseText(verse, 'secondary'),
          secondaryWidth
        )
      : []

    const lineCount = dualLanguage
      ? Math.max(primaryLines.length, secondaryLines.length)
      : primaryLines.length

    const verseHeight = lineCount * lineHeight
    const verseStartY = y

    // 高亮背景
    if (highlightedVerse === verseIndex) {
      const rgba = hexToRgba(userSettings.highlightBackgroundColor, 0.3)
      ctx.fillStyle = rgba

      const highlightStartY = userSettings.fixedTitle
        ? verseStartY - verseStartY * 0.10
        : verseStartY - verseStartY * 0.1

      const highlightHeight = userSettings.fixedTitle
        ? Math.min(verseHeight, rect.height - highlightStartY)
        : verseHeight

      ctx.fillRect(
        padding - 5,
        highlightStartY,
        rect.width - padding * 2 + 10,
        highlightHeight
      )
    }

    // 左侧中文
    ctx.fillStyle = highlightedVerse === verseIndex
      ? userSettings.highlightTextColor
      : userSettings.textColor

    primaryLines.forEach(lineText => {
      const minY = userSettings.fixedTitle ? contentStartY : -lineHeight

      if (y >= minY && y <= rect.height) {
        ctx.fillText(lineText, padding, y)
      }

      y += lineHeight
    })

    // 右侧第二语言
    if (dualLanguage) {
      const secondaryX = padding + primaryWidth + layout.columnGap
      let secondaryY = verseStartY

      ctx.fillStyle = highlightedVerse === verseIndex
        ? userSettings.highlightTextColor
        : '#7da7ff'

      secondaryLines.forEach(lineText => {
        const minY = userSettings.fixedTitle ? contentStartY : -lineHeight

        if (secondaryY >= minY && secondaryY <= rect.height) {
          ctx.fillText(lineText, secondaryX, secondaryY)
        }

        secondaryY += lineHeight
      })

      // 每一节的高度按照两边最高的那边计算
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
  const lines = []

  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i]
    const metrics = ctx.measureText(testLine)
    const width = metrics.width

    // 使用更保守的阈值，为投影窗口预留更多空间
    if (width > maxWidth * 0.98 && line !== '') {
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
