import { wrapText, hexToRgba, userSettings, renderCanvasContent, setupCanvas as SC, resetSettings as RS } from "./common.js"
import KeyRecorder from "./libs/key-recorder.js"
// control.js - Canvas版本
const quick = document.getElementById('quick')
const preview = document.getElementById('preview') // Canvas元素
const meta = document.getElementById('meta')
const btnToggle = document.getElementById('btnToggle')
const btnExit = document.getElementById('btnExit')
const btnSettings = document.getElementById('btnSettings')
const btnCloseSettings = document.getElementById('btnCloseSettings')
const btnResetSettings = document.getElementById('btnResetSettings')
const settingsPanel = document.getElementById('settingsPanel')
const btnAbout = document.getElementById('btnAbout')
const btnCloseAbout = document.getElementById('btnCloseAbout')
const aboutPanel = document.getElementById('aboutPanel')
const aboutGithub = document.getElementById('aboutGithub')
const selDisplay = document.getElementById('display')
const suggestions = document.getElementById('suggestions')
const fontSize = document.getElementById('fontSize')
const fontSizeValue = document.getElementById('fontSizeValue')
const selHistory = document.getElementById('history')

// 设置控件引用
const settingFontSize = document.getElementById('settingFontSize')
const settingFontSizeValue = document.getElementById('settingFontSizeValue')
const settingTextColor = document.getElementById('settingTextColor')
const settingTextColorValue = document.getElementById('settingTextColorValue')
const settingBackgroundColor = document.getElementById('settingBackgroundColor')
const settingBackgroundColorValue = document.getElementById('settingBackgroundColorValue')
const settingHighlightBgColor = document.getElementById('settingHighlightBgColor')
const settingHighlightBgColorValue = document.getElementById('settingHighlightBgColorValue')
const settingHighlightTextColor = document.getElementById('settingHighlightTextColor')
const settingHighlightTextColorValue = document.getElementById('settingHighlightTextColorValue')
const settingScrollSpeed = document.getElementById('settingScrollSpeed')
const settingScrollSpeedValue = document.getElementById('settingScrollSpeedValue')
const settingFixedTitle = document.getElementById('settingFixedTitle')
const settingFixedTitleValue = document.getElementById('settingFixedTitleValue')
const settingLineHeight = document.getElementById('settingLineHeight')
const settingLineHeightValue = document.getElementById('settingLineHeightValue')

const settingPrevVerse = document.getElementById('settingPrevVerse')
const settingNextVerse = document.getElementById('settingNextVerse')
const settingSelectVerse = document.getElementById('settingSelectVerse')
const settingProject = document.getElementById('settingProject')
const settingShowControl = document.getElementById('settingShowControl')

// 右键菜单相关
const contextMenu = document.getElementById('contextMenu')
const copyText = document.getElementById('copyText')
const copyReference = document.getElementById('copyReference')
const copyAll = document.getElementById('copyAll')

// 按键记录器实例
let keyRecorder = null
let isKeyRecording = false

// 历史搜索相关
let searchHistory = []

// 右键菜单状态
let contextMenuVisible = false
let rightClickedVerse = -1 // 右键点击的经文索引


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
async function loadDisplays() {
  const arr = await window.api.displays()
  const projectorDisplayId = await window.api.getSetting('projectorDisplayId')
  let selectedDisplay = arr[0]

  // 检查 projectorDisplayId 是否有效且在列表中
  if (projectorDisplayId && arr.some(d => d.id === projectorDisplayId)) {
    selectedDisplay = arr.find(d => d.id === projectorDisplayId)
  }

  selDisplay.innerHTML = arr.map(d => `<option value="${d.id}">${d.label}</option>`).join('')
  selDisplay.value = selectedDisplay.id

  if (selectedDisplay) setPreviewAspect(selectedDisplay.width, selectedDisplay.height)
}

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
const setupPreviewCanvas = () => SC(preview, ctx, renderPreviewContent)

// 渲染预览内容（与投影窗口相同的渲染逻辑）
const renderPreviewContent = () => renderCanvasContent({ ctx, currentData, highlightedVerse, canvasElement: preview, scrollOffsetValue: previewScrollOffset })


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

// 历史搜索管理函数
async function addToSearchHistory(searchText, payload) {
  try {
    const historyItem = {
      text: searchText.trim(),
      meta: payload.meta,
      timestamp: Date.now()
    }
    
    console.log('添加到搜索历史:', historyItem)
    
    // 移除重复项（如果存在）
    searchHistory = searchHistory.filter(item => item.text !== historyItem.text)
    
    // 添加到开头
    searchHistory.unshift(historyItem)
    
    // 保持最多10个
    if (searchHistory.length > 10) {
      searchHistory = searchHistory.slice(0, 10)
    }
    
    // 保存到store
    await window.api.setSetting('searchHistory', searchHistory)
    console.log('搜索历史已保存，当前历史记录数量:', searchHistory.length)
    
    // 更新历史下拉框
    updateHistorySelect()
  } catch (error) {
    console.error('添加搜索历史失败:', error)
  }
}

async function loadSearchHistory() {
  try {
    console.log('加载搜索历史...')
    const savedHistory = await window.api.getSetting('searchHistory')
    if (savedHistory && Array.isArray(savedHistory)) {
      searchHistory = savedHistory
      console.log('搜索历史已加载，记录数量:', searchHistory.length)
      updateHistorySelect()
    } else {
      console.log('没有找到保存的搜索历史')
    }
  } catch (error) {
    console.error('加载搜索历史失败:', error)
    searchHistory = []
  }
}

function updateHistorySelect() {
  console.log('更新历史选择框，历史记录数量:', searchHistory.length)
  selHistory.innerHTML = '<option value="">选择历史记录...</option>'
  
  searchHistory.forEach((item, index) => {
    const option = document.createElement('option')
    option.value = item.text
    option.textContent = `${item.meta.book} ${item.meta.chapter}:${item.meta.range[0]}-${item.meta.range[1]}`
    selHistory.appendChild(option)
    console.log(`添加历史记录 ${index + 1}: ${option.textContent}`)
  })
}

// 同步滚动到投影窗口（独立函数，避免重复计算）
function syncScrollToProjector() {
  if (!currentData) return
  
  const rect = preview.getBoundingClientRect()
  const fontSizePx = (currentFontSize / 100) * rect.height
  const lineHeight = fontSizePx * 1.6
  const paddingTop = rect.height * 0.04
  const titleHeight = fontSizePx * 0.7  + rect.height * 0.01
  
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

// 验证输入是否超出范围
async function validateInput(text) {
  if (!text.trim()) return { valid: true }
  
  try {
    const parts = text.trim().split(/\s+/)
    
    if (parts.length >= 2) {
      const bookPy = parts[0]
      const chapter = parseInt(parts[1])
      
      // 检查书卷是否存在
      const bookSuggestions = await window.api.getSuggestions(bookPy)
      if (bookSuggestions.length === 0) {
        return { valid: false, message: '未找到该书卷' }
      }
      
      const book = bookSuggestions[0]
      
      // 检查章节是否超出范围
      if (isNaN(chapter) || chapter < 1 || chapter > book.chapters) {
        return { valid: false, message: `章节超出范围 (1-${book.chapters})` }
      }
      
      // 如果有节数，检查节数范围
      if (parts.length >= 3) {
        const startVerse = parseInt(parts[2])
        
        if (!isNaN(startVerse)) {
          try {
            const verseRange = await window.api.getVerseRange(bookPy, chapter)
            if (verseRange.maxVerse > 0) {
              if (startVerse < 1 || startVerse > verseRange.maxVerse) {
                return { valid: false, message: `起始节数超出范围 (1-${verseRange.maxVerse})` }
              }
              
              // 如果有结束节数，检查结束节数范围
              if (parts.length >= 4) {
                const endVerse = parseInt(parts[3])
                if (!isNaN(endVerse)) {
                  if (endVerse < startVerse || endVerse > verseRange.maxVerse) {
                    return { valid: false, message: `结束节数超出范围 (${startVerse}-${verseRange.maxVerse})` }
                  }
                }
              }
            }
          } catch (e) {
            return { valid: false, message: '无法获取节数范围' }
          }
        }
      }
    }
    
    return { valid: true }
  } catch (e) {
    return { valid: false, message: '输入格式错误' }
  }
}

async function doSearch(text) {
  if (!text.trim()) return
  
  // 先验证输入
  const validation = await validateInput(text)
  if (!validation.valid) {
    // 显示错误状态
    quick.classList.add('error')
    meta.textContent = `输入错误：${validation.message}`
    ctx.clearRect(0, 0, preview.width, preview.height)
    
    // 3秒后自动清除错误状态
    setTimeout(() => {
      quick.classList.remove('error')
      meta.textContent = ''
    }, 3000)
    return
  }
  
  // 清除可能的错误状态
  quick.classList.remove('error')
  
  try {
    const res = await window.api.search(text)
    renderVerses(res)
    hideSuggestions()
    
    // 搜索成功后添加到历史记录
    await addToSearchHistory(text, res)
  } catch (e) {
    meta.textContent = '解析/查询失败：' + e.message
    ctx.clearRect(0, 0, preview.width, preview.height)
  }
}

// 显示错误建议
function showErrorSuggestion(errorMessage, errorType = 'error') {
  const iconMap = {
    'error': '❌',
    'warning': '⚠️',
    'info': 'ℹ️'
  }
  
  suggestions.innerHTML = `
    <div class="suggestion-item error-suggestion">
      <span class="suggestion-py">${iconMap[errorType]}</span>
      <span class="suggestion-name" style="color: #dc3545;">${errorMessage}</span>
      <span class="suggestion-range"></span>
    </div>`
  suggestions.style.display = 'block'
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
        // 显示"未找到书卷"错误
        showErrorSuggestion(`未找到书卷 "${input}"`)
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
            <span class="suggestion-range">章节范围: 1-${book.chapters}</span>
          </div>`
      } else {
        showErrorSuggestion(`未找到书卷 "${parts[0]}"`)
        return
      }
      
    } else if (parts.length === 2 && parts[1] !== '') {
      // 正在输入章节号，显示章节范围提示或错误
      const bookSuggestions = await window.api.getSuggestions(parts[0])
      if (bookSuggestions.length > 0) {
        const book = bookSuggestions[0]
        const chapter = parseInt(parts[1])
        if (!isNaN(chapter)) {
          // 检查章节范围
          if (chapter > book.chapters) {
            showErrorSuggestion(`${book.name}没有第${chapter}章 (最多${book.chapters}章)`)
            return
          } else if (chapter < 1) {
            showErrorSuggestion(`章节号不能小于1`)
            return
          }
          
          suggestions.innerHTML = `
            <div class="suggestion-item info-only">
              <span class="suggestion-py">${book.py} ${chapter}</span>
              <span class="suggestion-name">${book.name}</span>
              <span class="suggestion-range">章节范围: 1-${book.chapters}</span>
            </div>`
        } else {
          suggestions.innerHTML = `
            <div class="suggestion-item info-only">
              <span class="suggestion-py">${book.py}</span>
              <span class="suggestion-name">${book.name}</span>
              <span class="suggestion-range">章节范围: 1-${book.chapters}</span>
            </div>`
        }
      } else {
        showErrorSuggestion(`未找到书卷 "${parts[0]}"`)
        return
      }
      
    } else if (parts.length === 3 && parts[2] === '') {
      // 书卷名 章节号 后跟空格，显示节数范围
      const py = parts[0]
      const chapter = parseInt(parts[1])
      
      if (!isNaN(chapter)) {
        try {
          const bookSuggestions = await window.api.getSuggestions(py)
          if (bookSuggestions.length === 0) {
            showErrorSuggestion(`未找到书卷 "${py}"`)
            return
          }
          
          const book = bookSuggestions[0]
          if (chapter > book.chapters) {
            showErrorSuggestion(`${book.name}没有第${chapter}章 (最多${book.chapters}章)`)
            return
          } else if (chapter < 1) {
            showErrorSuggestion(`章节号不能小于1`)
            return
          }
          
          const verseRange = await window.api.getVerseRange(py, chapter)
          if (verseRange.maxVerse > 0) {
            suggestions.innerHTML = `
              <div class="suggestion-item info-only">
                <span class="suggestion-py">${py} ${chapter}</span>
                <span class="suggestion-name">${book.name}</span>
                <span class="suggestion-range">节数范围: 1-${verseRange.maxVerse}</span>
              </div>`
          } else {
            showErrorSuggestion(`无法获取${book.name}第${chapter}章的节数信息`)
            return
          }
        } catch (e) {
          showErrorSuggestion(`获取章节信息失败`)
          return
        }
      } else {
        hideSuggestions()
        return
      }
      
    } else if (parts.length === 3 && parts[2] !== '') {
      // 正在输入节数，显示节数范围或错误
      const py = parts[0]
      const chapter = parseInt(parts[1])
      const verse = parseInt(parts[2])
      
      if (!isNaN(chapter)) {
        try {
          const bookSuggestions = await window.api.getSuggestions(py)
          if (bookSuggestions.length === 0) {
            showErrorSuggestion(`未找到书卷 "${py}"`)
            return
          }
          
          const book = bookSuggestions[0]
          if (chapter > book.chapters) {
            showErrorSuggestion(`${book.name}没有第${chapter}章 (最多${book.chapters}章)`)
            return
          } else if (chapter < 1) {
            showErrorSuggestion(`章节号不能小于1`)
            return
          }
          
          const verseRange = await window.api.getVerseRange(py, chapter)
          if (verseRange.maxVerse > 0) {
            // 检查节数范围
            if (!isNaN(verse)) {
              if (verse > verseRange.maxVerse) {
                showErrorSuggestion(`${book.name}第${chapter}章没有第${verse}节 (最多${verseRange.maxVerse}节)`)
                return
              } else if (verse < 1) {
                showErrorSuggestion(`节数不能小于1`)
                return
              }
              
              let displayText = `${py} ${chapter} ${verse}`
              suggestions.innerHTML = `
                <div class="suggestion-item info-only">
                  <span class="suggestion-py">${displayText}</span>
                  <span class="suggestion-name">${book.name}</span>
                  <span class="suggestion-range">节数范围: 1-${verseRange.maxVerse}</span>
                </div>`
            } else {
              suggestions.innerHTML = `
                <div class="suggestion-item info-only">
                  <span class="suggestion-py">${py} ${chapter}</span>
                  <span class="suggestion-name">${book.name}</span>
                  <span class="suggestion-range">节数范围: 1-${verseRange.maxVerse}</span>
                </div>`
            }
          } else {
            showErrorSuggestion(`无法获取${book.name}第${chapter}章的节数信息`)
            return
          }
        } catch (e) {
          showErrorSuggestion(`获取节数信息失败`)
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
          if (bookSuggestions.length === 0) {
            showErrorSuggestion(`未找到书卷 "${py}"`)
            return
          }
          
          const book = bookSuggestions[0]
          if (chapter > book.chapters) {
            showErrorSuggestion(`${book.name}没有第${chapter}章 (最多${book.chapters}章)`)
            return
          } else if (chapter < 1) {
            showErrorSuggestion(`章节号不能小于1`)
            return
          }
          
          const verseRange = await window.api.getVerseRange(py, chapter)
          if (verseRange.maxVerse > 0) {
            // 检查起始节数
            if (startVerse > verseRange.maxVerse) {
              showErrorSuggestion(`${book.name}第${chapter}章没有第${startVerse}节 (最多${verseRange.maxVerse}节)`)
              return
            } else if (startVerse < 1) {
              showErrorSuggestion(`起始节数不能小于1`)
              return
            }
            
            // 检查结束节数（如果有）
            if (endVerse !== null && !isNaN(endVerse)) {
              if (endVerse > verseRange.maxVerse) {
                showErrorSuggestion(`${book.name}第${chapter}章没有第${endVerse}节 (最多${verseRange.maxVerse}节)`)
                return
              } else if (endVerse < startVerse) {
                showErrorSuggestion(`结束节数不能小于起始节数`)
                return
              }
            }
            
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
            showErrorSuggestion(`无法获取${book.name}第${chapter}章的节数信息`)
            return
          }
        } catch (e) {
          showErrorSuggestion(`获取节数信息失败`)
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


quick.addEventListener('input', async (e) => {
  // 检查是否正在录制按键
  if (isKeyRecording) {
    e.stopPropagation()
    e.preventDefault()
    return
  }
  
  const input = e.target.value
  
  // 清除之前的错误状态
  quick.classList.remove('error')
  
  if (input.length > 0) {
    const parts = input.split(/\s+/)
    
    // 实时验证输入（只在输入相对完整时验证）
    if (parts.length >= 2 && parts[1] !== '') {
      const validation = await validateInput(input)
      if (!validation.valid) {
        quick.classList.add('error')
        meta.textContent = `输入错误：${validation.message}`
      } else {
        meta.textContent = ''
      }
    } else {
      meta.textContent = ''
    }
    
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
    meta.textContent = ''
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
  const titleHeight = fontSizePx * 0.7 + rect.height * 0.01
  
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
  
  // 计算目标滚动位置（使用用户设置的滚轮速度）
  let targetOffset = previewScrollOffset + e.deltaY * userSettings.scrollSpeed
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
btnExit.addEventListener('click', () => window.api.hide())



selDisplay.addEventListener('change', async () => {
  const id = Number(selDisplay.value)
  await window.api.setDisplay(id)
})

// 历史记录选择事件
selHistory.addEventListener('change', async () => {
  const selectedText = selHistory.value
  if (selectedText) {
    quick.value = selectedText
    await doSearch(selectedText)
    quick.value = ''
    selHistory.value = '' // 重置选择
  }
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
loadSearchHistory()  // 加载搜索历史记录

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
  
  // 立即通知投影窗口开始动画
  window.api.highlightVerse({ fromIndex, toIndex, isAnimation: true })
  
  function animate() {
    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / animationDuration, 1)

    if (progress < 1) {
      requestAnimationFrame(animate)
    } else {
      // 动画完成
      isAnimating = false
      highlightedVerse = toIndex
      renderPreviewContent()
      
      // 通知投影窗口动画完成
      window.api.highlightVerse(toIndex)
      
      // 自动滚动到高亮经文
      scrollToVerse(toIndex)
    }
  }
  
  animate()
}

// 滚动到指定经文
function scrollToVerse(verseIndex) {
  if (!currentData || verseIndex < 0 || verseIndex >= currentData.verses.length) return
  
  const rect = preview.getBoundingClientRect()
  const fontSizePx = (userSettings.fontSize / 100) * rect.height // 使用用户设置的字体大小
  const lineHeight = fontSizePx * 1.6
  const paddingTop = rect.height * 0.04
  const titleHeight = fontSizePx * 0.7  + rect.height * 0.01
  
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

// Canvas点击事件 - 检测点击的经文
preview.addEventListener('click', (e) => {
  if (!currentData) return
  
  const rect = preview.getBoundingClientRect()
  const clickY = e.clientY - rect.top + previewScrollOffset
  const fontSizePx = (userSettings.fontSize / 100) * rect.height // 使用用户设置的字体大小
  const lineHeight = fontSizePx * 1.6
  const paddingTop = rect.height * 0.04
  const titleHeight = fontSizePx * 0.7 + rect.height * 0.01
  
  // 计算内容开始位置，根据固定标题设置
  let currentY = userSettings.fixedTitle ? (paddingTop + titleHeight) : paddingTop
  
  // 如果不是固定标题模式，需要加上标题的高度
  if (!userSettings.fixedTitle) {
    currentY += titleHeight
  }
  
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
 // highlightVerse(-1)
})

// Canvas右键菜单事件
preview.addEventListener('contextmenu', (e) => {
  e.preventDefault()
  
  if (!currentData) return
  
  const rect = preview.getBoundingClientRect()
  const clickY = e.clientY - rect.top + previewScrollOffset
  const fontSizePx = (userSettings.fontSize / 100) * rect.height
  const lineHeight = fontSizePx * 1.6
  const paddingTop = rect.height * 0.04
  const titleHeight = fontSizePx * 0.7 + rect.height * 0.01
  
  // 计算内容开始位置
  let currentY = userSettings.fixedTitle ? (paddingTop + titleHeight) : paddingTop
  if (!userSettings.fixedTitle) {
    currentY += titleHeight
  }
  
  const maxWidth = Math.floor(rect.width - rect.width * 0.06 * 2)
  const tempCanvas = document.createElement('canvas')
  const tempCtx = tempCanvas.getContext('2d')
  tempCtx.font = `${fontSizePx}px "Microsoft YaHei", Arial, sans-serif`
  
  // 检查右键点击位置对应的经文
  rightClickedVerse = highlightedVerse

  // 显示右键菜单
  showContextMenu(e.clientX, e.clientY)
})

// 键盘导航（支持双击检测和下一段跳转）
document.addEventListener('keydown', (e) => {
  // 检查是否正在录制按键
  if (isKeyRecording) {
    e.stopPropagation()
    e.preventDefault()
    return
  }
  
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
        //jumpToPreviousParagraph()
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



// 追加下一节经文
async function appendNextVerse() {
  if (!currentData) return
  
  const { meta } = currentData
  const currentMaxVerse = Math.max(...currentData.verses.map(v => v.VerseSN))
  
  try {
    console.log(`尝试获取下一节: ${meta.py} ${meta.chapter} ${currentMaxVerse + 1}`)
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



// 设置面板功能
function toggleSettingsPanel() {
  const isVisible = settingsPanel.style.display === 'block'
  
  if (isVisible) {
    // 隐藏设置面板
    settingsPanel.style.display = 'none'
    btnSettings.textContent = '设置'
    // 恢复原始窗口宽度
    window.api.resizeWindow(400, -1)
  } else {
    // 先关闭关于面板（如果打开）
    closeAboutPanel()
    
    // 显示设置面板
    settingsPanel.style.display = 'block'
    btnSettings.textContent = '隐藏'
    // 扩展窗口宽度以容纳设置面板
    window.api.resizeWindow(750, -1)
  }
}

function closeSettingsPanel() {
  settingsPanel.style.display = 'none'
  btnSettings.textContent = '设置'
  // 恢复原始窗口宽度
  window.api.resizeWindow(400, -1)
}

// 关于面板功能
function toggleAboutPanel() {
  const isVisible = aboutPanel.style.display === 'block'
  
  if (isVisible) {
    // 隐藏关于面板
    aboutPanel.style.display = 'none'
    btnAbout.textContent = '关于'
    // 恢复原始窗口宽度
    window.api.resizeWindow(400, -1)
  } else {
    // 先关闭设置面板（如果打开）
    closeSettingsPanel()
    
    // 显示关于面板
    aboutPanel.style.display = 'block'
    btnAbout.textContent = '隐藏'
    // 扩展窗口宽度以容纳关于面板
    window.api.resizeWindow(750, -1)
  }
}

function closeAboutPanel() {
  aboutPanel.style.display = 'none'
  btnAbout.textContent = '关于'
  // 恢复原始窗口宽度
  window.api.resizeWindow(400, -1)
}

// 应用设置到预览和投影
function applySetting(key, value) {
  userSettings[key] = value
  
  // 更新当前字体大小变量（向后兼容）
  if (key === 'fontSize') {
    currentFontSize = value
  }
  
  // 重新渲染预览
  renderPreviewContent()
  
  // 发送设置到投影窗口
  window.api.setSetting(key, value)
}

// 加载保存的设置
async function loadSettings() {
  try {
    const savedSettings = await window.api.getSetting()
    if (savedSettings) {
      // 更新本地设置
      Object.assign(userSettings, savedSettings)
      
      // 更新UI控件的值
      updateSettingsUI()
      
      // 更新字体大小变量（向后兼容）
      currentFontSize = userSettings.fontSize
      
      // 重新渲染预览
      renderPreviewContent()
      
      console.log('Settings loaded from disk:', savedSettings)
    }
  } catch (error) {
    console.error('Failed to load settings:', error)
  }
}

// 初始化设置控件
function initializeSettings() {
  // 字体大小
  settingFontSize.addEventListener('input', (e) => {
    const value = parseInt(e.target.value)
    settingFontSizeValue.textContent = `${value}vh`
    applySetting('fontSize', value)
  })
  
  // 文字颜色
  settingTextColor.addEventListener('input', (e) => {
    const value = e.target.value
    settingTextColorValue.textContent = value
    applySetting('textColor', value)
  })
  
  // 背景颜色
  settingBackgroundColor.addEventListener('input', (e) => {
    const value = e.target.value
    settingBackgroundColorValue.textContent = value
    applySetting('backgroundColor', value)
  })
  
  // 高亮背景颜色
  settingHighlightBgColor.addEventListener('input', (e) => {
    const value = e.target.value
    settingHighlightBgColorValue.textContent = value
    applySetting('highlightBackgroundColor', value)
  })
  
  // 高亮文字颜色
  settingHighlightTextColor.addEventListener('input', (e) => {
    const value = e.target.value
    settingHighlightTextColorValue.textContent = value
    applySetting('highlightTextColor', value)
  })
  
  // 滚轮速度
  settingScrollSpeed.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value)
    settingScrollSpeedValue.textContent = value.toFixed(1)
    applySetting('scrollSpeed', value)
  })
  
  // 固定标题设置
  settingFixedTitle.addEventListener('change', (e) => {
    const value = e.target.checked
    settingFixedTitleValue.textContent = value ? '开启' : '关闭'
    applySetting('fixedTitle', value)
  })

  // 行高设置
  settingLineHeight.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value)
    settingLineHeightValue.textContent = value.toFixed(1)
    applySetting('lineHeight', value)
  })

  // 初始化按键记录器
  initKeyRecorder()

  // 加载保存的设置
  loadSettings()
}

// 重置设置为默认值
async function resetSettings() {
  // 默认设置值

  
  // 确认对话框
  if (confirm('确定要重置所有设置为默认值吗？')) {
    RS()
    // 更新UI控件
    updateSettingsUI()
    // 先清除旧设置，再逐个保存新设置
    await clearAndSaveSettings(userSettings)
    // 应用到预览界面
    renderPreviewContent()
    
    console.log('设置已重置为默认值')
  }
}

// 清除旧设置并保存新设置
async function clearAndSaveSettings(newSettings) {
  try {
    // 首先清除所有旧设置
    await window.api.clearAllSettings()
    const defaultSettings = await window.api.getDefaultSettings()
    // 然后逐个保存新设置
    for (const [key, value] of Object.entries(defaultSettings)) {
      await window.api.setSetting(key, value)
      console.log(`Setting ${key} reset to:`, value)
    }
    
    // 批量通知投影窗口
    window.api.batchUpdateSettings(defaultSettings)
    
    console.log('所有设置已清除并重置')
  } catch (error) {
    console.error('重置设置失败:', error)
  }
}

// 逐个保存每个设置（确保持久化）
async function saveAllSettingsIndividually() {
  try {
    for (const [key, value] of Object.entries(userSettings)) {
      await window.api.setSetting(key, value)
      console.log(`Setting ${key} saved individually:`, value)
    }
    console.log('所有设置已逐个保存到store')
  } catch (error) {
    console.error('逐个保存设置失败:', error)
  }
}

// 保存所有设置到store
async function saveAllSettings() {
  try {
    // 逐个保存每个设置项到store
    for (const [key, value] of Object.entries(userSettings)) {
      await window.api.setSetting(key, value)
    }
    console.log('所有设置已保存到store')
  } catch (error) {
    console.error('保存设置失败:', error)
  }
}

// 初始化按键记录器
function initKeyRecorder() {
  keyRecorder = new KeyRecorder()
  
  // 为所有录制按钮添加事件监听
  document.querySelectorAll('.btn-record').forEach(button => {
    button.addEventListener('click', (e) => {
      const targetInputId = button.getAttribute('data-target')
      const targetInput = document.getElementById(targetInputId)
      
      if (button.classList.contains('recording')) {
        // 正在录制，停止录制
        keyRecorder.stopRecording()
        button.textContent = '录制'
        button.classList.remove('recording')
        targetInput.value = '' // 清空输入框

        isKeyRecording = false
      } else {
        // 开始录制
        button.textContent = '按键...'
        button.classList.add('recording')

        isKeyRecording = true
        // 禁用输入框
        quick.disabled = true
        
        keyRecorder.startRecording((combination) => {
          // 录制完成回调
          targetInput.value = combination
          button.textContent = '录制'
          button.classList.remove('recording')
          isKeyRecording = false
          // 重新启用输入框
          quick.disabled = false

          // 保存设置
          const settingKey = getSettingKeyFromInputId(targetInputId)
          if (settingKey) {
            applySetting(settingKey, combination)
          }
        })
      }
    })
  })
}

// 根据输入框ID获取对应的设置键名
function getSettingKeyFromInputId(inputId) {
  const mapping = {
    'settingPrevVerse': 'keyPrevVerse',
    'settingNextVerse': 'keyNextVerse', 
    'settingProject': 'keyProject',
    'settingShowControl': 'keyShowControl'
  }
  return mapping[inputId]
}

// 检查按键是否匹配快捷键
function isKeyMatch(event, shortcut) {
  if (!shortcut) return false
  
  const keys = shortcut.split('+')
  const pressedKeys = []
  
  // 收集当前按下的修饰键
  if (event.ctrlKey) pressedKeys.push('Control')
  if (event.altKey) pressedKeys.push('Alt')
  if (event.shiftKey) pressedKeys.push('Shift')
  if (event.metaKey) pressedKeys.push('Meta')
  
  // 添加主键
  if (event.key && !['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) {
    if (event.key.startsWith('F') && /^F\d+$/.test(event.key)) {
      pressedKeys.push(event.key)
    } else if (event.key.startsWith('Arrow')) {
      pressedKeys.push(event.key)
    } else if (event.key === ' ') {
      pressedKeys.push('Space')
    } else if (event.key.length === 1) {
      pressedKeys.push(event.key.toUpperCase())
    } else {
      pressedKeys.push(event.key)
    }
  }
  
  // 比较按键组合
  const currentShortcut = pressedKeys.join('+')
  return currentShortcut === shortcut
}
function updateSettingsUI() {
  // 更新字体大小
  settingFontSize.value = userSettings.fontSize
  settingFontSizeValue.textContent = userSettings.fontSize + 'vh'
  
  // 更新文字颜色
  settingTextColor.value = userSettings.textColor
  settingTextColorValue.textContent = userSettings.textColor
  
  // 更新背景颜色
  settingBackgroundColor.value = userSettings.backgroundColor
  settingBackgroundColorValue.textContent = userSettings.backgroundColor
  
  // 更新高亮背景颜色
  settingHighlightBgColor.value = userSettings.highlightBackgroundColor
  settingHighlightBgColorValue.textContent = userSettings.highlightBackgroundColor
  
  // 更新高亮文字颜色
  settingHighlightTextColor.value = userSettings.highlightTextColor
  settingHighlightTextColorValue.textContent = userSettings.highlightTextColor
  
  // 更新滚轮速度
  settingScrollSpeed.value = userSettings.scrollSpeed
  settingScrollSpeedValue.textContent = userSettings.scrollSpeed.toFixed(1)
  
  // 更新固定标题
  settingFixedTitle.checked = userSettings.fixedTitle
  settingFixedTitleValue.textContent = userSettings.fixedTitle ? '开启' : '关闭'

  // 更新行高
  settingLineHeight.value = userSettings.lineHeight
  settingLineHeightValue.textContent = userSettings.lineHeight.toFixed(2)
  
  // 更新快捷键设置
  settingPrevVerse.value = userSettings.keyPrevVerse || 'ArrowUp'
  settingNextVerse.value = userSettings.keyNextVerse || 'ArrowDown'
  settingProject.value = userSettings.keyProject || 'F9'
  settingShowControl.value = userSettings.keyShowControl || 'Control+Space'
}

// 设置按钮事件监听
btnSettings.addEventListener('click', toggleSettingsPanel)
btnCloseSettings.addEventListener('click', closeSettingsPanel)
btnResetSettings.addEventListener('click', resetSettings)

// 关于按钮事件监听
btnAbout.addEventListener('click', toggleAboutPanel)
btnCloseAbout.addEventListener('click', closeAboutPanel)
aboutGithub.addEventListener('click', (e) => {
  e.preventDefault()
  window.api.openExternal('https://github.com/cecpadua/BibleProjector')
})

// 右键菜单事件监听
copyText.addEventListener('click', () => {
  if (highlightedVerse >= 0 && !copyText.classList.contains('disabled')) {
    const text = getVerseText(highlightedVerse)
    copyToClipboard(text)
  }
  hideContextMenu()
})

copyReference.addEventListener('click', () => {
  if (rightClickedVerse >= 0 && !copyReference.classList.contains('disabled')) {
    const reference = getVerseReference(rightClickedVerse)
    copyToClipboard(reference)
  }
  hideContextMenu()
})

copyAll.addEventListener('click', () => {
  if (!copyAll.classList.contains('disabled')) {
    const allText = getAllText()
    copyToClipboard(allText)
  }
  hideContextMenu()
})

// 点击其他地方隐藏右键菜单
document.addEventListener('click', (e) => {
  if (contextMenuVisible && !contextMenu.contains(e.target)) {
    hideContextMenu()
  }
})

// 初始化设置
initializeSettings()
// 右键菜单相关函数
function showContextMenu(x, y) {
  // 隐藏任何现有的菜单
  hideContextMenu()
  
  // 设置菜单位置
  contextMenu.style.left = x + 'px'
  contextMenu.style.top = y + 'px'
  
  // 检查菜单是否会超出屏幕边界
  const menuRect = contextMenu.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  
  if (x + menuRect.width > viewportWidth) {
    contextMenu.style.left = (x - menuRect.width) + 'px'
  }
  
  if (y + menuRect.height > viewportHeight) {
    contextMenu.style.top = (y - menuRect.height) + 'px'
  }
  
  // 显示菜单
  contextMenu.style.display = 'block'
  contextMenuVisible = true
  
  // 根据选中的经文更新菜单项状态
  updateContextMenuItems()
}

function hideContextMenu() {
  contextMenu.style.display = 'none'
  contextMenuVisible = false
  rightClickedVerse = -1
}

function updateContextMenuItems() {
  if (!currentData) {
    copyText.classList.add('disabled')
    copyReference.classList.add('disabled')
    copyAll.classList.add('disabled')
    return
  }
  
  // 如果点击了具体经文
  if (highlightedVerse >= 0) {
    copyText.classList.remove('disabled')
    copyReference.classList.remove('disabled')
  } else {
    copyText.classList.add('disabled')
    copyReference.classList.add('disabled')
  }
  
  // 复制全部总是可用（如果有数据）
  copyAll.classList.remove('disabled')
}

// 复制到剪贴板功能
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    // 简单的成功提示
    meta.textContent = '已复制到剪贴板'
    setTimeout(() => {
      if (currentData) {
        const { meta: m } = currentData
        meta.textContent = `${m.book} 第${m.chapter}章 ${m.range[0]}-${m.range[1]}`
      } else {
        meta.textContent = ''
      }
    }, 1500)
  } catch (err) {
    console.error('复制失败:', err)
    meta.textContent = '复制失败'
    setTimeout(() => {
      if (currentData) {
        const { meta: m } = currentData
        meta.textContent = `${m.book} 第${m.chapter}章 ${m.range[0]}-${m.range[1]}`
      } else {
        meta.textContent = ''
      }
    }, 1500)
  }
}

function getVerseText(verseIndex) {
  if (!currentData || verseIndex < 0 || verseIndex >= currentData.verses.length) {
    return ''
  }
  
  const verse = currentData.verses[verseIndex]
  return `${verse.VerseSN}. ${verse.strjw}`
}

function getVerseReference(verseIndex) {
  if (!currentData || verseIndex < 0 || verseIndex >= currentData.verses.length) {
    return ''
  }
  
  const verse = currentData.verses[verseIndex]
  const { meta: m } = currentData
  return `${m.book} ${m.chapter}:${verse.VerseSN}`
}

function getAllText() {
  if (!currentData) return ''
  
  const { meta: m, verses } = currentData
  const title = `${m.book} 第${m.chapter}章 ${m.range[0]}-${m.range[1]}\n\n`
  const content = verses.map(verse => `${verse.VerseSN}. ${verse.strjw}`).join('\n')
  
  return title + content
}

// 全局键盘事件监听
document.addEventListener('keydown', (e) => {

  // 检查是否正在录制按键
  if (isKeyRecording) {
    e.stopPropagation()
    e.preventDefault()
    return
  }

  // 检查是否匹配用户自定义的快捷键
  if (isKeyMatch(e, userSettings.keyProject)) {
    e.preventDefault()
    btnToggle.click() // 切换投影状态
    return
  }

  // 检查上一个经文快捷键
  if (isKeyMatch(e, userSettings.keyPrevVerse)) {
    e.preventDefault()
    if (currentData && highlightedVerse > 0) {
      highlightVerse(highlightedVerse - 1, true)
    } else if (currentData && highlightedVerse === -1 && currentData.verses.length > 0) {
      highlightVerse(currentData.verses.length - 1, true)
    }
    return
  }

  // 检查下一个经文快捷键  
  if (isKeyMatch(e, userSettings.keyNextVerse)) {
    e.preventDefault()
    if (currentData && highlightedVerse < currentData.verses.length - 1) {
      highlightVerse(highlightedVerse + 1, true)
    } else if (currentData && highlightedVerse === -1 && currentData.verses.length > 0) {
      highlightVerse(0, true)
    }
    return
  }

  console.log('Key pressed:', e.key)

  // 如果不是 字母 数字 空格 减号，则屏蔽
  if (!/^[a-zA-Z0-9 -]$/.test(e.key)) {
    e.preventDefault()
  }

  // 处理特殊按键
  if (e.key === 'Enter') {
    e.preventDefault()
    if (quick.value.trim()) {
      // 检查输入框是否有错误状态
      if (quick.classList.contains('error')) {
        // 如果有错误状态，不执行搜索，只显示提示
        meta.textContent = '请修正输入错误后再搜索'
        return
      }
      doSearch(quick.value)
      quick.value = '' // 清空输入框
    }
    return
  }
  
  if (e.key === 'Escape') {
    e.preventDefault()
    quick.value = '' // 清空输入框
    quick.classList.remove('error') // 清除错误状态
    meta.textContent = '' // 清除错误信息
    return
  }
  
  if (e.key === 'Backspace') {
    e.preventDefault()
    // 删除最后一个字符
    quick.value = quick.value.slice(0, -1)
    // 触发input事件来更新建议
    quick.dispatchEvent(new Event('input', { bubbles: true }))
    return
  }
  
  // 只处理可打印字符（字母、数字、空格、标点符号等）
  if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault()
    
    // 如果是小写字母，转换为大写（配合自动大写功能）
    let charToAdd = e.key.toUpperCase()

    // 添加字符到输入框
    quick.value += charToAdd
    
    // 触发input事件来更新建议
    quick.dispatchEvent(new Event('input', { bubbles: true }))
  }
})
