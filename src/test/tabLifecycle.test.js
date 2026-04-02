import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTabEditor } from '../hooks/useTabEditor.js'
import { loadTabs } from '../utils/storage.js'

describe('tab lifecycle — create, edit, persist', () => {
  it('new tab starts empty', () => {
    const { result } = renderHook(() => useTabEditor())
    act(() => result.current.newTab('My Tab'))
    expect(result.current.tab.title).toBe('My Tab')
    expect(result.current.tab.sections[0].columns.every(col => col.every(v => v === null))).toBe(true)
  })

  it('edits persist after auto-save debounce', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useTabEditor())
    act(() => result.current.updateTitle('Persisted'))
    act(() => result.current.setNote(0, 0, 0, 7))
    await act(async () => vi.advanceTimersByTime(600))
    const saved = loadTabs()
    const found = saved.find(t => t.title === 'Persisted')
    expect(found).toBeDefined()
    expect(found.sections[0].columns[0][0]).toBe(7)
    vi.useRealTimers()
  })

  it('edits persist when switching tabs before debounce fires', () => {
    const { result } = renderHook(() => useTabEditor())
    act(() => result.current.updateTitle('Tab A'))
    act(() => result.current.setNote(0, 2, 1, 5))
    // Switch away immediately (before 500ms debounce)
    act(() => result.current.newTab('Tab B'))
    // Tab A should be in localStorage now (flushed on switch)
    const saved = loadTabs()
    const tabA = saved.find(t => t.title === 'Tab A')
    expect(tabA).toBeDefined()
    expect(tabA.sections[0].columns[2][1]).toBe(5)
  })

  it('loading a saved tab restores its notes', async () => {
    const { result } = renderHook(() => useTabEditor())
    act(() => result.current.updateTitle('With Notes'))
    act(() => result.current.setNote(0, 3, 2, 9))
    await act(async () => { await result.current.saveCurrentTab() })
    const id = result.current.tab.id
    act(() => result.current.newTab('Other'))
    await act(async () => { await result.current.loadTabById(id) })
    expect(result.current.tab.title).toBe('With Notes')
    expect(result.current.tab.sections[0].columns[3][2]).toBe(9)
  })

  it('loading the same tab twice is a no-op', async () => {
    const { result } = renderHook(() => useTabEditor())
    await act(async () => { await result.current.saveCurrentTab() })
    const id = result.current.tab.id
    act(() => result.current.setCursor({ section: 0, col: 3, string: 2 }))
    await act(async () => { await result.current.loadTabById(id) })
    // cursor should NOT reset (no-op because same tab)
    expect(result.current.cursor).toEqual({ section: 0, col: 3, string: 2 })
  })

  it('cursor resets to 0,0,0 when loading a different tab', async () => {
    const { result } = renderHook(() => useTabEditor())
    await act(async () => { await result.current.saveCurrentTab() })
    const id1 = result.current.tab.id
    act(() => result.current.setCursor({ section: 0, col: 5, string: 3 }))
    act(() => result.current.newTab('Other'))
    await act(async () => { await result.current.saveCurrentTab() })
    await act(async () => { await result.current.loadTabById(id1) })
    expect(result.current.cursor).toEqual({ section: 0, col: 0, string: 0 })
  })
})

describe('tab lifecycle — delete', () => {
  it('deleting a tab removes it from savedTabs', async () => {
    const { result } = renderHook(() => useTabEditor())
    await act(async () => { await result.current.saveCurrentTab() })
    const id = result.current.tab.id
    act(() => result.current.newTab('Other'))
    await act(async () => { await result.current.saveCurrentTab() })
    await act(async () => { await result.current.deleteTabById(id) })
    expect(result.current.savedTabs.find(t => t.id === id)).toBeUndefined()
  })

  it('deleting current tab switches to another', async () => {
    const { result } = renderHook(() => useTabEditor())
    await act(async () => { await result.current.saveCurrentTab() })
    act(() => result.current.newTab('Other'))
    await act(async () => { await result.current.saveCurrentTab() })
    const deleteId = result.current.tab.id
    await act(async () => { await result.current.deleteTabById(deleteId) })
    expect(result.current.tab.id).not.toBe(deleteId)
  })

  it('deleting last tab creates a fresh one', async () => {
    const { result } = renderHook(() => useTabEditor())
    // Delete all but current, then delete current
    const id = result.current.tab.id
    await act(async () => { await result.current.deleteTabById(id) })
    expect(result.current.tab).toBeDefined()
    expect(result.current.tab.sections).toHaveLength(1)
  })

  it('undo history is cleared when switching tabs', async () => {
    const { result } = renderHook(() => useTabEditor())
    act(() => result.current.setNote(0, 0, 0, 5))
    await act(async () => { await result.current.saveCurrentTab() })
    const id1 = result.current.tab.id
    act(() => result.current.newTab('Other'))
    await act(async () => { await result.current.saveCurrentTab() })
    await act(async () => { await result.current.loadTabById(id1) })
    // undo should not bring back the previous tab's history
    const titleBefore = result.current.tab.title
    act(() => result.current.undo())
    expect(result.current.tab.title).toBe(titleBefore)
  })
})

describe('tab lifecycle — multiple tabs', () => {
  it('maintains independent state for each tab', async () => {
    const { result } = renderHook(() => useTabEditor())
    act(() => result.current.updateTitle('Tab A'))
    act(() => result.current.setNote(0, 0, 0, 1))
    await act(async () => { await result.current.saveCurrentTab() })
    const idA = result.current.tab.id

    act(() => result.current.newTab('Tab B'))
    act(() => result.current.setNote(0, 0, 0, 9))
    await act(async () => { await result.current.saveCurrentTab() })

    await act(async () => { await result.current.loadTabById(idA) })
    expect(result.current.tab.sections[0].columns[0][0]).toBe(1)
  })
})
