// store.js
import path from 'path'
import fs from 'fs'
import { app } from 'electron'

class Store {
  constructor(opts) {
    const userData = process.env.PORTABLE_EXECUTABLE_DIR
      ? process.env.PORTABLE_EXECUTABLE_DIR
      : app.getPath('userData')
    this.path = path.join(userData, (opts.name || 'settings') + '.json')
    this.data = Object.assign({}, opts.defaults, this._read())
    this.defaults = opts.defaults
  }
  _read() {
    try { return JSON.parse(fs.readFileSync(this.path, 'utf-8')) } catch { return {} }
  }
  get(key) { return this.data[key] }
  set(key, val) { this.data[key] = val; fs.writeFileSync(this.path, JSON.stringify(this.data, null, 2)) }
}

export default Store
