// db.js（使用 better-sqlite3 模块）
import { createRequire } from 'module'
import fs from 'fs'
import Logger from './utils/logger.js'
const require = createRequire(import.meta.url)
const Database = require('better-sqlite3')
let db = null
const translations = new Map()

const builtInVersions = [
  {
    id: 'CUNPSS',
    name: '和合本（默）',
    language: 'zh',
    source: 'sqlite'
  }
]

async function initDB(dbPath) {
  Logger.info('Initializing database:', dbPath)
  try {
    db = new Database(dbPath, { readonly: true })
    Logger.info('Database initialized successfully')
  } catch (err) {
    Logger.error('Failed to initialize database:', err)
    throw err
  }
}

function closeDB() {
  Logger.info('Closing database connection')
  if (db) {
    db.close()
    db = null
  }
}

async function initTranslations(files = []) {
  translations.clear()

  for (const file of files) {
    try {
      if (!fs.existsSync(file.path)) {
        Logger.warn('Translation file not found:', file.path)
        continue
      }

      const data = JSON.parse(fs.readFileSync(file.path, 'utf-8'))
      translations.set(file.id, {
        id: file.id,
        name: file.name,
        language: file.language,
        data
      })
      Logger.info(`Translation loaded: ${file.id}`)
    } catch (err) {
      Logger.error(`Failed to load translation ${file.id}:`, err.message)
    }
  }
}

function getAvailableVersions() {
  return [
    ...builtInVersions,
    ...Array.from(translations.values()).map(({ id, name, language }) => ({ id, name, language, source: 'json' }))
  ]
}

function parseRef(input) {
  // 支持多种分隔符：空格、点号、逗号、中文逗号
  const s = input.replace(/[，,\.]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase()
  
  // 尝试匹配格式：PY CHAPTER VERSE[-VERSE] 或 PY CHAPTER VERSE VERSE
  const m = s.match(/^([A-Z]+)\s*(\d+)\s*(\d+)(?:[-\s](\d+))?$/)
  if (m) {
    return {
      py: m[1],
      chapter: Number(m[2]),
      vFrom: Number(m[3]),
      vTo: m[4] ? Number(m[4]) : Number(m[3])
    }
  }
  
  // 尝试格式：PYCHAPTER VERSE[-VERSE] 或 PYCHAPTER VERSE VERSE
  const m2 = s.match(/^([A-Z]+)(\d+)\s*(\d+)(?:[-\s](\d+))?$/)
  if (m2) {
    return {
      py: m2[1],
      chapter: Number(m2[2]),
      vFrom: Number(m2[3]),
      vTo: m2[4] ? Number(m2[4]) : Number(m2[3])
    }
  }
  
  // 尝试格式：PY CHAPTER:VERSE[-VERSE] 或 PY CHAPTER:VERSE VERSE
  const m3 = s.match(/^([A-Z]+)\s*(\d+)\s*[:\s]+(\d+)(?:[-\s](\d+))?$/)
  if (m3) {
    return {
      py: m3[1],
      chapter: Number(m3[2]),
      vFrom: Number(m3[3]),
      vTo: m3[4] ? Number(m3[4]) : Number(m3[3])
    }
  }
  
  throw new Error('指令格式不正确')
}

// 获取书卷提示信息
function getBookSuggestions(input) {
  try {
    if (!input) {
      // 如果没有输入，返回所有书卷
      const stmt = db.prepare(`SELECT PY, FullName, ChapterNumber FROM bibleid ORDER BY SN`)
      const rows = stmt.all()
      return Promise.resolve(rows.map(row => ({
        py: row.PY,
        name: row.FullName,
        chapters: `1-${row.ChapterNumber}`
      })))
    } else {
      // 根据输入的拼音前缀查找匹配的书卷
      const searchPattern = input.toUpperCase() + '%'
      const stmt = db.prepare(`SELECT PY, FullName, ChapterNumber FROM bibleid WHERE UPPER(PY) LIKE ? ORDER BY SN`)
      const rows = stmt.all(searchPattern)
      return Promise.resolve(rows.map(row => ({
        py: row.PY,
        name: row.FullName,
        chapters: `1-${row.ChapterNumber}`
      })))
    }
  } catch (err) {
    return Promise.reject(err)
  }
}

// 获取指定书卷的章节范围内的节数范围
function getVerseRange(py, chapter) {
  try {
    const bookStmt = db.prepare(`SELECT SN AS VolumeSN FROM bibleid WHERE UPPER(PY)=?`)
    const bookRow = bookStmt.get(py.toUpperCase())
    
    if (!bookRow) {
      return Promise.reject(new Error('未找到书卷：' + py))
    }
    
    Logger.log(`查询 ${py} ${chapter} 章的节数范围`)
    const verseStmt = db.prepare(`SELECT MAX(CAST(VerseSN AS INT)) as maxVerse FROM bible WHERE VolumeSN = ? AND ChapterSN = ?`)
    const result = verseStmt.get(Number.parseInt(bookRow.VolumeSN), chapter)
    
    Logger.log(py, " Has ", result ? result.maxVerse : 0)
    return Promise.resolve({
      maxVerse: result ? result.maxVerse : 0
    })
  } catch (err) {
    return Promise.reject(err)
  }
}

function attachTranslation(rows, volumeSN, chapter, versionId) {
  if (!versionId || versionId === 'CUNPSS') return rows

  const translation = translations.get(versionId)
  if (!translation) return rows

  const book = translation.data?.[String(volumeSN)]
  const chapterData = book?.[String(chapter)]
  if (!chapterData) return rows

  return rows.map(row => ({
    ...row,
    secondaryVersion: versionId,
    secondaryText: chapterData[String(row.VerseSN)] || ''
  }))
}

function getVersesByRef(input, options = {}) {
  try {
    const ref = parseRef(input)
    Logger.log('查询经文:', ref)

    const bookStmt = db.prepare(`SELECT SN AS VolumeSN, FullName, ShortName, ChapterNumber FROM bibleid WHERE UPPER(PY)=?`)
    const bookRow = bookStmt.get(ref.py)
    
    if (!bookRow) {
      return Promise.reject(new Error('未找到书卷：' + ref.py))
    }
    
    if (ref.chapter < 1 || ref.chapter > Number(bookRow.ChapterNumber)) {
      return Promise.reject(new Error(`章节超出范围：${ref.chapter}（1-${bookRow.ChapterNumber}）`))
    }

    const vFrom = Math.max(1, ref.vFrom)
    const vTo = Math.max(vFrom, ref.vTo)
    Logger.log(`查询 ${bookRow.FullName} ${ref.chapter} 章 ${vFrom}-${vTo} 节`)
    
    const verseStmt = db.prepare(`SELECT CAST(id AS INT) as id, VolumeSN, ChapterSN, VerseSN, strjw FROM bible
            WHERE VolumeSN = ? AND ChapterSN = ? AND (VerseSN BETWEEN ? AND ?)
            ORDER BY id ASC`)
    const volumeSN = Number.parseInt(bookRow.VolumeSN)
    const rows = verseStmt.all(volumeSN, ref.chapter, vFrom, vTo)
    const secondaryVersion = options.dualLanguage ? (options.secondaryVersion || 'NR06') : null
    const verses = attachTranslation(rows, volumeSN, ref.chapter, secondaryVersion)
    
    Logger.log(`查询结果:`, [bookRow.VolumeSN, ref.chapter, vFrom, vTo])
    
    return Promise.resolve({
      meta: {
        py: ref.py,
        book: bookRow.FullName,
        chapter: ref.chapter,
        range: [vFrom, vTo],
        primaryVersion: 'CUNPSS',
        secondaryVersion,
        dualLanguage: !!options.dualLanguage
      },
      versions: getAvailableVersions(),
      verses
    })
  } catch (err) {
    return Promise.reject(err)
  }
}

export { initDB, initTranslations, closeDB, getVersesByRef, getBookSuggestions, getVerseRange, getAvailableVersions }
