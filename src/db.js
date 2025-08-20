// db.js（使用 sqlite3 模块）
import { createRequire } from 'module'
import Logger from './utils/logger.js'
const require = createRequire(import.meta.url)
const sqlite3 = require('sqlite3').verbose()
let db = null

async function initDB(dbPath) {
  Logger.info('Initializing database:', dbPath)
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, err => {
      if (err) {
        Logger.error('Failed to initialize database:', err)
        reject(err)
      } else {
        Logger.info('Database initialized successfully')
        resolve()
      }
    })
  })
}

function closeDB() {
  Logger.info('Closing database connection')
  if (db) db.close()
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
  return new Promise((resolve, reject) => {
    if (!input) {
      // 如果没有输入，返回所有书卷
      db.all(`SELECT PY, FullName, ChapterNumber FROM bibleid ORDER BY SN`, (err, rows) => {
        if (err) return reject(err)
        resolve(rows.map(row => ({
          py: row.PY,
          name: row.FullName,
          chapters: `1-${row.ChapterNumber}`
        })))
      })
    } else {
      // 根据输入的拼音前缀查找匹配的书卷
      const searchPattern = input.toUpperCase() + '%'
      db.all(`SELECT PY, FullName, ChapterNumber FROM bibleid WHERE UPPER(PY) LIKE ? ORDER BY SN`, [searchPattern], (err, rows) => {
        if (err) return reject(err)
        resolve(rows.map(row => ({
          py: row.PY,
          name: row.FullName,
          chapters: `1-${row.ChapterNumber}`
        })))
      })
    }
  })
}

// 获取指定书卷的章节范围内的节数范围
function getVerseRange(py, chapter) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT SN AS VolumeSN FROM bibleid WHERE UPPER(PY)=?`, [py.toUpperCase()], (err, bookRow) => {
      if (err) return reject(err)
      if (!bookRow) return reject(new Error('未找到书卷：' + py))
      Logger.log(`查询 ${py} ${chapter} 章的节数范围`)
      db.get(`SELECT MAX(CAST(VerseSN AS INT)) as maxVerse FROM bible WHERE VolumeSN = ? AND ChapterSN = ?`, 
        [Number.parseInt(bookRow.VolumeSN), chapter], (err, result) => {
        if (err) return reject(err)
          Logger.log(py , " Has ", result ? result.maxVerse : 0)
        resolve({
          maxVerse: result ? result.maxVerse : 0
        })
      })
    })
  })
}

function getVersesByRef(input) {
  return new Promise((resolve, reject) => {
    const ref = parseRef(input)

    Logger.log('查询经文:', ref)

    db.get(`SELECT SN AS VolumeSN, FullName, ShortName, ChapterNumber FROM bibleid WHERE UPPER(PY)=?`, [ref.py], (err, bookRow) => {
      if (err) return reject(err)
      if (!bookRow) return reject(new Error('未找到书卷：' + ref.py))
      if (ref.chapter < 1 || ref.chapter > Number(bookRow.ChapterNumber)) {
        return reject(new Error(`章节超出范围：${ref.chapter}（1-${bookRow.ChapterNumber}）`))
      }

      const vFrom = Math.max(1, ref.vFrom)
      const vTo = Math.max(vFrom, ref.vTo)
      Logger.log(`查询 ${bookRow.FullName} ${ref.chapter} 章 ${vFrom}-${vTo} 节`)
      db.all(`SELECT CAST(id AS INT) as id, VolumeSN, ChapterSN, VerseSN, strjw FROM bible
              WHERE VolumeSN = ? AND ChapterSN = ? AND (VerseSN BETWEEN ? AND ?)
              ORDER BY id ASC`,
        [Number.parseInt(bookRow.VolumeSN), ref.chapter, vFrom, vTo],
        (err, rows) => {
          Logger.log(`查询结果:`, [bookRow.VolumeSN, ref.chapter, vFrom, vTo])
          if (err) return reject(err)
          resolve({
            meta: {
              py: ref.py,
              book: bookRow.FullName,
              chapter: ref.chapter,
              range: [vFrom, vTo]
            },
            verses: rows
          })
        })
    })
  })
}

export { initDB, closeDB, getVersesByRef, getBookSuggestions, getVerseRange }
