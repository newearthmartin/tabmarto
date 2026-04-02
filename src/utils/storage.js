import { generateId } from './tabModel.js'
import { LocalStorageBackend } from './storageBackend.js'

const LOCAL_KEY = 'tabmarto_tabs_local'
const LEGACY_KEY = 'tabmarto_tabs'
const LAST_ID_KEY = 'tabmarto_last_id'
const LAST_DRIVE_FILE_KEY = 'tabmarto_last_drive_file'

export { generateId }

export function saveLastId(id) {
  try { localStorage.setItem(LAST_ID_KEY, id) } catch {}
}

export function loadLastId() {
  try { return localStorage.getItem(LAST_ID_KEY) } catch { return null }
}

export function saveLastDriveFileId(id) {
  try { localStorage.setItem(LAST_DRIVE_FILE_KEY, id) } catch {}
}

export function loadLastDriveFileId() {
  try { return localStorage.getItem(LAST_DRIVE_FILE_KEY) } catch { return null }
}

export function loadTabs() {
  const backend = new LocalStorageBackend()
  return backend._readTabs()
}

export function saveTab(tab) {
  const backend = new LocalStorageBackend()
  return backend.save(tab)
}

export function deleteTab(id) {
  const backend = new LocalStorageBackend()
  return backend.delete(id)
}
