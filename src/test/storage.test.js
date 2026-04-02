import { describe, it, expect } from 'vitest'
import { generateId, saveLastId, loadLastId, loadTabs, saveTab, deleteTab } from '../utils/storage.js'

describe('generateId', () => {
  it('returns a non-empty string', () => expect(typeof generateId()).toBe('string'))
  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 100 }, generateId))
    expect(ids.size).toBe(100)
  })
})

describe('saveLastId / loadLastId', () => {
  it('returns null when nothing saved', () => expect(loadLastId()).toBeNull())
  it('saves and loads an id', () => {
    saveLastId('abc123')
    expect(loadLastId()).toBe('abc123')
  })
})

describe('loadTabs', () => {
  it('returns empty array when nothing saved', () => expect(loadTabs()).toEqual([]))
  it('returns saved tabs', () => {
    const tab = { id: '1', title: 'Test', sections: [], tuning: ['E','B','G','D','A','E'], tempo: 120 }
    saveTab(tab)
    expect(loadTabs()).toHaveLength(1)
    expect(loadTabs()[0].id).toBe('1')
  })
  it('migrates from legacy key', () => {
    const tabs = [{ id: 'x', title: 'Legacy' }]
    localStorage.setItem('tabmarto_tabs', JSON.stringify(tabs))
    const loaded = loadTabs()
    expect(loaded[0].id).toBe('x')
    expect(localStorage.getItem('tabmarto_tabs')).toBeNull()
    expect(localStorage.getItem('tabmarto_tabs_local')).not.toBeNull()
  })
})

describe('saveTab', () => {
  it('adds a new tab', () => {
    saveTab({ id: '1', title: 'A' })
    expect(loadTabs()).toHaveLength(1)
  })
  it('updates an existing tab in place', () => {
    saveTab({ id: '1', title: 'A' })
    saveTab({ id: '1', title: 'B' })
    const tabs = loadTabs()
    expect(tabs).toHaveLength(1)
    expect(tabs[0].title).toBe('B')
  })
  it('adds new tab at the start', () => {
    saveTab({ id: '1', title: 'A' })
    saveTab({ id: '2', title: 'B' })
    expect(loadTabs()[0].id).toBe('2')
  })
})

describe('deleteTab', () => {
  it('removes a tab by id', () => {
    saveTab({ id: '1', title: 'A' })
    saveTab({ id: '2', title: 'B' })
    deleteTab('1')
    const tabs = loadTabs()
    expect(tabs).toHaveLength(1)
    expect(tabs[0].id).toBe('2')
  })
  it('is a no-op for unknown id', () => {
    saveTab({ id: '1', title: 'A' })
    deleteTab('nope')
    expect(loadTabs()).toHaveLength(1)
  })
})
