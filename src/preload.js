// preload.js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  search: (q) => ipcRenderer.invoke('search:query', q),
  getSuggestions: (input) => ipcRenderer.invoke('search:suggestions', input),
  getVerseRange: (py, chapter) => ipcRenderer.invoke('search:verse-range', py, chapter),
  getNextVerse: (py, chapter, currentMaxVerse) => ipcRenderer.invoke('search:next-verse', py, chapter, currentMaxVerse),
  projectorToggle: () => ipcRenderer.invoke('projector:toggle'),
  displays: () => ipcRenderer.invoke('display:list'),
  setDisplay: (id) => ipcRenderer.invoke('display:set', id),
  sendContent: (payload) => ipcRenderer.send('preview:content', payload),
  sendScroll: (percent) => ipcRenderer.send('preview:scroll', percent),
  setFontSize: (size) => ipcRenderer.send('set-font-size', size),
  highlightVerse: (verseIndex) => ipcRenderer.send('verse:highlight', verseIndex),
//  highlightVerseProgress: (progressData) => ipcRenderer.send('verse:highlight-progress', progressData),
  onProjectorContent: (cb) => ipcRenderer.on('projector:content', (_e, p) => cb(p)),
  onProjectorScroll: (cb) => ipcRenderer.on('projector:scroll', (_e, p) => cb(p)),
  onProjectorClosed: (cb) => ipcRenderer.on('projector-closed', (_e) => cb()),
  onDisplayInfo: (cb) => ipcRenderer.on('display-info', (_e, d) => cb(d)),
  onFontSizeChange: (cb) => ipcRenderer.on('font-size-changed', (_e, size) => cb(size)),
  onDefaultContent: (cb) => ipcRenderer.on('default-content', (_e, content) => cb(content)),
  onVerseHighlight: (cb) => ipcRenderer.on('verse:highlight', (_e, verseIndex) => cb(verseIndex)),
  onVerseHighlightProgress: (cb) => ipcRenderer.on('verse:highlight-progress', (_e, progressData) => cb(progressData)),
  
  // 新增设置相关API
  resizeWindow: (width, height) => ipcRenderer.invoke('window:resize', width, height),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  getSetting: (key) => ipcRenderer.invoke('settings:get', key),
  onSettingsChanged: (cb) => ipcRenderer.on('settings:changed', (_e, settings) => cb(settings)),
  batchUpdateSettings: (allSettings) => ipcRenderer.send('settings:batch-update', allSettings),
  clearAllSettings: () => ipcRenderer.invoke('settings:clear-all'),
  getDefaultSettings: () => ipcRenderer.invoke('settings:get-default'),
  hide: () => ipcRenderer.invoke('window:hide')
})
