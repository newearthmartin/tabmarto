const LOCAL_KEY = 'tabmarto_tabs_local'
const LEGACY_KEY = 'tabmarto_tabs'
const LAST_ID_KEY = 'tabmarto_last_id'
const DRIVE_LAST_ID_KEY = 'tabmarto_drive_last_id'

function summarizeTab(tab) {
  return {
    id: tab.id,
    title: tab.title || 'Untitled',
    modifiedTime: tab.updatedAt ?? tab.createdAt ?? null,
  }
}

export class LocalStorageBackend {
  shouldSaveTab(tab) {
    return !tab.driveId
  }

  _readTabs() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY)
      if (raw) return JSON.parse(raw)

      const legacy = localStorage.getItem(LEGACY_KEY)
      if (legacy) {
        localStorage.setItem(LOCAL_KEY, legacy)
        localStorage.removeItem(LEGACY_KEY)
        return JSON.parse(legacy)
      }

      return []
    } catch {
      return []
    }
  }

  async listTabs() {
    const tabs = this._readTabs()
    return tabs.map(summarizeTab)
  }

  async loadTab(id) {
    const tabs = this._readTabs()
    return tabs.find(tab => tab.id === id) ?? null
  }

  async save(tab) {
    const tabs = this._readTabs()
    const index = tabs.findIndex(existing => existing.id === tab.id)
    const nextTab = { ...tab }

    if (index >= 0) tabs[index] = nextTab
    else tabs.unshift(nextTab)

    localStorage.setItem(LOCAL_KEY, JSON.stringify(tabs))
    return nextTab
  }

  async delete(id) {
    const tabs = this._readTabs().filter(tab => tab.id !== id)
    localStorage.setItem(LOCAL_KEY, JSON.stringify(tabs))
  }

  getLastId() {
    try {
      return localStorage.getItem(LAST_ID_KEY)
    } catch {
      return null
    }
  }

  setLastId(id) {
    try {
      localStorage.setItem(LAST_ID_KEY, id)
    } catch {
      // ignore storage failures
    }
  }
}

export class DriveBackend {
  constructor({ listDriveTabs, loadFromDrive, saveToDrive, deleteFromDrive }) {
    this.listDriveTabs = listDriveTabs
    this.loadFromDrive = loadFromDrive
    this.saveToDrive = saveToDrive
    this.deleteFromDrive = deleteFromDrive
    this._exportFn = null
    this._importFn = null
    this._driveIdByTabId = new Map()
  }

  setTabCodec({ exportTab, importTab }) {
    this._exportFn = exportTab
    this._importFn = importTab
  }

  shouldSaveTab() {
    return true
  }

  async listTabs() {
    const files = await this.listDriveTabs()
    this._driveIdByTabId = new Map()

    return files.map(file => {
      const tabId = file.appProperties?.appId || file.id
      this._driveIdByTabId.set(tabId, file.id)
      return {
        id: tabId,
        driveId: file.id,
        title: file.name.replace(/\.json$/, ''),
        modifiedTime: file.modifiedTime,
      }
    })
  }

  async loadTab(id) {
    if (!this._importFn) throw new Error('Import function not set')

    const driveId = this._driveIdByTabId.get(id) ?? id
    const text = await this.loadFromDrive(driveId)
    const parsed = this._importFn(text)
    if (!parsed) return null

    this._driveIdByTabId.set(parsed.id ?? id, driveId)

    return {
      ...parsed,
      id: parsed.id ?? id,
      driveId,
    }
  }

  async save(tab) {
    if (!this._exportFn) throw new Error('Export function not set')

    const driveId = await this.saveToDrive(tab, this._exportFn)
    this._driveIdByTabId.set(tab.id, driveId)
    return {
      ...tab,
      driveId,
    }
  }

  async delete(id) {
    const driveId = this._driveIdByTabId.get(id) ?? id
    await this.deleteFromDrive(driveId)
    this._driveIdByTabId.delete(id)
  }

  getLastId() {
    try {
      return sessionStorage.getItem(DRIVE_LAST_ID_KEY)
    } catch {
      return null
    }
  }

  setLastId(id) {
    try {
      sessionStorage.setItem(DRIVE_LAST_ID_KEY, id)
    } catch {
      // ignore storage failures
    }
  }
}

export class StorageManager {
  constructor() {
    this.backend = new LocalStorageBackend()
    this.mode = 'local'
  }

  useLocal() {
    this.backend = new LocalStorageBackend()
    this.mode = 'local'
    return this
  }

  useDrive(driveApi) {
    this.backend = new DriveBackend(driveApi)
    this.mode = 'drive'
    return this
  }

  isDrive() {
    return this.mode === 'drive'
  }

  async listTabs() {
    return this.backend.listTabs()
  }

  async loadTab(id) {
    return this.backend.loadTab(id)
  }

  async save(tab) {
    return this.backend.save(tab)
  }

  async delete(id) {
    return this.backend.delete(id)
  }

  getLastId() {
    return this.backend.getLastId()
  }

  setLastId(id) {
    return this.backend.setLastId(id)
  }

  setTabCodec(codec) {
    if (this.backend.setTabCodec) {
      this.backend.setTabCodec(codec)
    }
  }

  shouldSaveTab(tab) {
    if (this.backend.shouldSaveTab) {
      return this.backend.shouldSaveTab(tab)
    }
    return true
  }
}

export const storageManager = new StorageManager()
