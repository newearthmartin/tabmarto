import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTabEditor } from '../hooks/useTabEditor.js'
import { saveTab } from '../utils/storage.js'

// Reset module-level init cache between tests
beforeEach(() => {
  vi.resetModules()
})

function getHook() {
  return renderHook(() => useTabEditor())
}

// ── Initialization ────────────────────────────────────────────────────────────

describe('initialization', () => {
  it('starts with a tab', () => {
    const { result } = getHook()
    expect(result.current.tab).toBeDefined()
    expect(result.current.tab.sections).toHaveLength(1)
  })

  it('starts with standard tuning', () => {
    const { result } = getHook()
    expect(result.current.tab.tuning).toEqual(['E', 'B', 'G', 'D', 'A', 'E'])
  })

  it('starts with cursor at 0,0,0', () => {
    const { result } = getHook()
    expect(result.current.cursor).toEqual({ section: 0, col: 0, string: 0 })
  })

  it('starts with 16 empty columns', () => {
    const { result } = getHook()
    expect(result.current.tab.sections[0].columns).toHaveLength(16)
  })

  it('starts with default tempo 120', () => {
    const { result } = getHook()
    expect(result.current.tab.tempo).toBe(120)
  })
})

// ── Note entry ────────────────────────────────────────────────────────────────

describe('handleChar', () => {
  it('sets a fret at the cursor', () => {
    const { result } = getHook()
    act(() => result.current.handleChar('5'))
    expect(result.current.tab.sections[0].columns[0][0]).toBe(5)
  })

  it('ignores invalid chars', () => {
    const { result } = getHook()
    const before = result.current.tab.sections[0].columns[0][0]
    act(() => result.current.handleChar('z'))
    expect(result.current.tab.sections[0].columns[0][0]).toBe(before)
  })

  it('advances cursor right after entry', () => {
    const { result } = getHook()
    act(() => result.current.handleChar('3'))
    expect(result.current.cursor.col).toBe(1)
  })

  it('handles frets 10–24 via letter chars', () => {
    const { result } = getHook()
    act(() => result.current.handleChar('a')) // fret 10
    expect(result.current.tab.sections[0].columns[0][0]).toBe(10)
  })

  it('auto-expands columns when entering on last column', () => {
    const { result } = getHook()
    const initialLen = result.current.tab.sections[0].columns.length
    // Move to last column
    act(() => result.current.setCursor({ section: 0, col: initialLen - 1, string: 0 }))
    act(() => result.current.handleChar('1'))
    expect(result.current.tab.sections[0].columns.length).toBe(initialLen + 1)
  })

  it('sets updatedAt on the tab', () => {
    const { result } = getHook()
    act(() => result.current.handleChar('1'))
    expect(result.current.tab.updatedAt).toBeDefined()
  })
})

describe('clearNote', () => {
  it('clears the note at cursor', () => {
    const { result } = getHook()
    act(() => result.current.handleChar('5'))
    act(() => result.current.setCursor({ section: 0, col: 0, string: 0 }))
    act(() => result.current.clearNote())
    expect(result.current.tab.sections[0].columns[0][0]).toBeNull()
  })

  it('only clears the cursor cell, not others', () => {
    const { result } = getHook()
    act(() => result.current.setNote(0, 0, 0, 7))
    act(() => result.current.setNote(0, 0, 1, 3))
    act(() => result.current.setCursor({ section: 0, col: 0, string: 0 }))
    act(() => result.current.clearNote())
    expect(result.current.tab.sections[0].columns[0][0]).toBeNull()
    expect(result.current.tab.sections[0].columns[0][1]).toBe(3)
  })
})

describe('clearRange', () => {
  it('clears all notes in range', () => {
    const { result } = getHook()
    act(() => { result.current.setNote(0, 0, 0, 1); result.current.setNote(0, 1, 0, 2); result.current.setNote(0, 2, 0, 3) })
    act(() => result.current.clearRange(0, 0, 1))
    expect(result.current.tab.sections[0].columns[0][0]).toBeNull()
    expect(result.current.tab.sections[0].columns[1][0]).toBeNull()
    expect(result.current.tab.sections[0].columns[2][0]).toBe(3)
  })

  it('works with reversed start/end', () => {
    const { result } = getHook()
    act(() => { result.current.setNote(0, 0, 0, 1); result.current.setNote(0, 1, 0, 2) })
    act(() => result.current.clearRange(0, 1, 0))
    expect(result.current.tab.sections[0].columns[0][0]).toBeNull()
    expect(result.current.tab.sections[0].columns[1][0]).toBeNull()
  })
})

// ── Cursor movement ───────────────────────────────────────────────────────────

describe('moveCursor', () => {
  it('moves right', () => {
    const { result } = getHook()
    act(() => result.current.moveCursor(1, 0))
    expect(result.current.cursor.col).toBe(1)
  })

  it('moves left', () => {
    const { result } = getHook()
    act(() => result.current.setCursor({ section: 0, col: 5, string: 0 }))
    act(() => result.current.moveCursor(-1, 0))
    expect(result.current.cursor.col).toBe(4)
  })

  it('clamps left at column 0 in first section', () => {
    const { result } = getHook()
    act(() => result.current.moveCursor(-1, 0))
    expect(result.current.cursor.col).toBe(0)
    expect(result.current.cursor.section).toBe(0)
  })

  it('clamps right at last column in last section', () => {
    const { result } = getHook()
    const lastCol = result.current.tab.sections[0].columns.length - 1
    act(() => result.current.setCursor({ section: 0, col: lastCol, string: 0 }))
    act(() => result.current.moveCursor(1, 0))
    expect(result.current.cursor.col).toBe(lastCol)
  })

  it('moves down to next string', () => {
    const { result } = getHook()
    act(() => result.current.moveCursor(0, 1))
    expect(result.current.cursor.string).toBe(1)
  })

  it('moves up to previous string', () => {
    const { result } = getHook()
    act(() => result.current.setCursor({ section: 0, col: 0, string: 3 }))
    act(() => result.current.moveCursor(0, -1))
    expect(result.current.cursor.string).toBe(2)
  })

  it('clamps at top string', () => {
    const { result } = getHook()
    act(() => result.current.moveCursor(0, -1))
    expect(result.current.cursor.string).toBe(0)
  })

  it('clamps at bottom string', () => {
    const { result } = getHook()
    act(() => result.current.setCursor({ section: 0, col: 0, string: 5 }))
    act(() => result.current.moveCursor(0, 1))
    expect(result.current.cursor.string).toBe(5)
  })

  it('wraps right to next section', () => {
    const { result } = getHook()
    act(() => result.current.addSection(0))
    const lastCol = result.current.tab.sections[0].columns.length - 1
    act(() => result.current.setCursor({ section: 0, col: lastCol, string: 0 }))
    act(() => result.current.moveCursor(1, 0))
    expect(result.current.cursor.section).toBe(1)
    expect(result.current.cursor.col).toBe(0)
  })

  it('wraps left to previous section', () => {
    const { result } = getHook()
    act(() => result.current.addSection(0))
    act(() => result.current.setCursor({ section: 1, col: 0, string: 0 }))
    act(() => result.current.moveCursor(-1, 0))
    expect(result.current.cursor.section).toBe(0)
    const lastCol = result.current.tab.sections[0].columns.length - 1
    expect(result.current.cursor.col).toBe(lastCol)
  })
})

// ── Column operations ─────────────────────────────────────────────────────────

describe('insertColumnAfter', () => {
  it('increases column count by 1', () => {
    const { result } = getHook()
    const before = result.current.tab.sections[0].columns.length
    act(() => result.current.insertColumnAfter(0, 0))
    expect(result.current.tab.sections[0].columns.length).toBe(before + 1)
  })

  it('inserts empty column', () => {
    const { result } = getHook()
    act(() => result.current.insertColumnAfter(0, 0))
    expect(result.current.tab.sections[0].columns[1].every(v => v === null)).toBe(true)
  })

  it('shifts bar lines forward', () => {
    const { result } = getHook()
    act(() => result.current.toggleBar(0, 2))
    act(() => result.current.insertColumnAfter(0, 1))
    expect(result.current.tab.sections[0].bars).toContain(3)
    expect(result.current.tab.sections[0].bars).not.toContain(2)
  })
})

describe('deleteColumn', () => {
  it('decreases column count by 1', () => {
    const { result } = getHook()
    const before = result.current.tab.sections[0].columns.length
    act(() => result.current.deleteColumn(0, 0))
    expect(result.current.tab.sections[0].columns.length).toBe(before - 1)
  })

  it('does not delete the last column', () => {
    const { result } = getHook()
    // Delete down to 1 column
    const len = result.current.tab.sections[0].columns.length
    for (let i = 0; i < len - 1; i++) {
      act(() => result.current.deleteColumn(0, 0))
    }
    act(() => result.current.deleteColumn(0, 0))
    expect(result.current.tab.sections[0].columns.length).toBe(1)
  })

  it('removes bar at deleted column', () => {
    const { result } = getHook()
    act(() => result.current.toggleBar(0, 1))
    act(() => result.current.deleteColumn(0, 1))
    expect(result.current.tab.sections[0].bars).not.toContain(1)
  })

  it('shifts bar lines back after deletion', () => {
    const { result } = getHook()
    act(() => result.current.toggleBar(0, 3))
    act(() => result.current.deleteColumn(0, 1))
    expect(result.current.tab.sections[0].bars).toContain(2)
  })
})

describe('toggleBar', () => {
  it('adds a bar', () => {
    const { result } = getHook()
    act(() => result.current.toggleBar(0, 2))
    expect(result.current.tab.sections[0].bars).toContain(2)
  })

  it('removes a bar on second toggle', () => {
    const { result } = getHook()
    act(() => result.current.toggleBar(0, 2))
    act(() => result.current.toggleBar(0, 2))
    expect(result.current.tab.sections[0].bars).not.toContain(2)
  })

  it('keeps bars sorted', () => {
    const { result } = getHook()
    act(() => { result.current.toggleBar(0, 5); result.current.toggleBar(0, 2); result.current.toggleBar(0, 8) })
    expect(result.current.tab.sections[0].bars).toEqual([2, 5, 8])
  })
})

describe('pasteColumns', () => {
  it('pastes columns at cursor', () => {
    const { result } = getHook()
    const cols = [[7, null, null, null, null, null]]
    act(() => result.current.pasteColumns(0, cols, 0))
    expect(result.current.tab.sections[0].columns[0][0]).toBe(7)
  })

  it('expands tab if paste extends beyond length', () => {
    const { result } = getHook()
    const len = result.current.tab.sections[0].columns.length
    const cols = Array(5).fill(Array(6).fill(null))
    act(() => result.current.pasteColumns(0, cols, len - 2))
    expect(result.current.tab.sections[0].columns.length).toBeGreaterThan(len)
  })
})

// ── Section management ────────────────────────────────────────────────────────

describe('addSection', () => {
  it('increases section count', () => {
    const { result } = getHook()
    act(() => result.current.addSection(0))
    expect(result.current.tab.sections).toHaveLength(2)
  })

  it('inserts after the given index', () => {
    const { result } = getHook()
    act(() => { result.current.addSection(0); result.current.addSection(0) })
    expect(result.current.tab.sections).toHaveLength(3)
    // Section 1 should be a newly created empty one
    expect(result.current.tab.sections[1].columns).toHaveLength(16)
  })

  it('moves cursor to the new section', () => {
    const { result } = getHook()
    act(() => result.current.addSection(0))
    expect(result.current.cursor.section).toBe(1)
    expect(result.current.cursor.col).toBe(0)
  })
})

describe('deleteSection', () => {
  it('decreases section count', () => {
    const { result } = getHook()
    act(() => result.current.addSection(0))
    act(() => result.current.deleteSection(1))
    expect(result.current.tab.sections).toHaveLength(1)
  })

  it('does not delete the last section', () => {
    const { result } = getHook()
    act(() => result.current.deleteSection(0))
    expect(result.current.tab.sections).toHaveLength(1)
  })
})

describe('updateSectionTitle', () => {
  it('updates the section title', () => {
    const { result } = getHook()
    act(() => result.current.updateSectionTitle(0, 'Verse'))
    expect(result.current.tab.sections[0].title).toBe('Verse')
  })
})

// ── Tab management ────────────────────────────────────────────────────────────

describe('newTab', () => {
  it('creates a fresh tab', () => {
    const { result } = getHook()
    act(() => result.current.handleChar('5'))
    act(() => result.current.newTab('Fresh'))
    expect(result.current.tab.title).toBe('Fresh')
    expect(result.current.tab.sections[0].columns[0][0]).toBeNull()
  })

  it('resets cursor', () => {
    const { result } = getHook()
    act(() => result.current.setCursor({ section: 0, col: 5, string: 3 }))
    act(() => result.current.newTab())
    expect(result.current.cursor).toEqual({ section: 0, col: 0, string: 0 })
  })

  it('clears undo history', () => {
    const { result } = getHook()
    act(() => result.current.handleChar('5'))
    act(() => result.current.newTab())
    // undo should have nothing to revert
    const titleBefore = result.current.tab.title
    act(() => result.current.undo())
    expect(result.current.tab.title).toBe(titleBefore)
  })
})

describe('updateTitle', () => {
  it('updates the tab title', () => {
    const { result } = getHook()
    act(() => result.current.updateTitle('My Song'))
    expect(result.current.tab.title).toBe('My Song')
  })

  it('sets updatedAt', () => {
    const { result } = getHook()
    act(() => result.current.updateTitle('X'))
    expect(result.current.tab.updatedAt).toBeDefined()
  })
})

describe('updateTuning', () => {
  it('updates the tuning', () => {
    const { result } = getHook()
    const dropD = ['E', 'B', 'G', 'D', 'A', 'D']
    act(() => result.current.updateTuning(dropD))
    expect(result.current.tab.tuning).toEqual(dropD)
  })
})

describe('updateTempo', () => {
  it('updates the tempo', () => {
    const { result } = getHook()
    act(() => result.current.updateTempo(140))
    expect(result.current.tab.tempo).toBe(140)
  })

  it('coerces string to number', () => {
    const { result } = getHook()
    act(() => result.current.updateTempo('100'))
    expect(result.current.tab.tempo).toBe(100)
  })
})

// ── Undo ─────────────────────────────────────────────────────────────────────

describe('undo', () => {
  it('reverts a note entry', () => {
    const { result } = getHook()
    act(() => result.current.handleChar('5'))
    expect(result.current.tab.sections[0].columns[0][0]).toBe(5)
    act(() => result.current.undo())
    expect(result.current.tab.sections[0].columns[0][0]).toBeNull()
  })

  it('reverts multiple steps', () => {
    const { result } = getHook()
    act(() => result.current.handleChar('1'))
    act(() => result.current.handleChar('2'))
    act(() => result.current.handleChar('3'))
    act(() => result.current.undo())
    act(() => result.current.undo())
    // After 2 undos, only first char should remain (col 0 = 1, cols 1&2 cleared)
    expect(result.current.tab.sections[0].columns[0][0]).toBe(1)
    expect(result.current.tab.sections[0].columns[1][0]).toBeNull()
  })

  it('is a no-op with empty history', () => {
    const { result } = getHook()
    const before = result.current.tab.id
    act(() => result.current.undo())
    expect(result.current.tab.id).toBe(before)
  })

  it('reverts column insertion', () => {
    const { result } = getHook()
    const before = result.current.tab.sections[0].columns.length
    act(() => result.current.insertColumnAfter(0, 0))
    act(() => result.current.undo())
    expect(result.current.tab.sections[0].columns.length).toBe(before)
  })

  it('reverts tuning change', () => {
    const { result } = getHook()
    const original = [...result.current.tab.tuning]
    act(() => result.current.updateTuning(['D', 'A', 'F', 'C', 'G', 'D']))
    act(() => result.current.undo())
    expect(result.current.tab.tuning).toEqual(original)
  })
})

// ── toggleGhost ───────────────────────────────────────────────────────────────

describe('toggleGhost', () => {
  it('adds a ghost note marker', () => {
    const { result } = getHook()
    act(() => result.current.toggleGhost(0, 1, 2))
    expect(result.current.tab.sections[0].ghosts).toContain('1,2')
  })

  it('removes on second toggle', () => {
    const { result } = getHook()
    act(() => result.current.toggleGhost(0, 1, 2))
    act(() => result.current.toggleGhost(0, 1, 2))
    expect(result.current.tab.sections[0].ghosts).not.toContain('1,2')
  })
})

// ── Persistence ───────────────────────────────────────────────────────────────

describe('persistence', () => {
  it('saves tab when dirty after debounce', async () => {
    vi.useFakeTimers()
    const { result } = getHook()
    act(() => result.current.handleChar('5'))
    await act(async () => { vi.advanceTimersByTime(600) })
    // Load tabs from storage — should have saved
    const { loadTabs } = await import('../utils/storage.js')
    const saved = loadTabs()
    expect(saved.length).toBeGreaterThan(0)
    vi.useRealTimers()
  })

  it('loadTabById switches to the tab', async () => {
    const { result } = getHook()
    await act(async () => { await result.current.saveCurrentTab() })
    const id1 = result.current.tab.id
    act(() => result.current.newTab('Second'))
    await act(async () => { await result.current.saveCurrentTab() })
    await act(async () => { await result.current.loadTabById(id1) })
    expect(result.current.tab.id).toBe(id1)
  })

  it('deleteTabById removes the tab and switches', async () => {
    const { result } = getHook()
    await act(async () => { await result.current.saveCurrentTab() })
    act(() => result.current.newTab('ToDelete'))
    await act(async () => { await result.current.saveCurrentTab() })
    const deleteId = result.current.tab.id
    await act(async () => { await result.current.deleteTabById(deleteId) })
    expect(result.current.tab.id).not.toBe(deleteId)
  })
})

// ── loadTabDirectly ───────────────────────────────────────────────────────────

describe('loadTabDirectly', () => {
  it('loads a tab object directly without requiring it in localStorage', () => {
    const { result } = getHook()
    const foreignTab = {
      id: 'foreign-id',
      title: 'Imported',
      tuning: ['E', 'B', 'G', 'D', 'A', 'E'],
      tempo: 100,
      sections: [{
        id: 's1',
        title: '',
        columns: [[5, null, null, null, null, null]],
        bars: [],
        ghosts: [],
        pageBreak: false,
      }],
      createdAt: Date.now(),
    }
    act(() => result.current.loadTabDirectly(foreignTab))
    expect(result.current.tab.title).toBe('Imported')
    expect(result.current.tab.sections[0].columns[0][0]).toBe(5)
  })

  it('strips updatedAt so the imported tab is not immediately dirty', () => {
    const { result } = getHook()
    const foreignTab = {
      id: 'x',
      title: 'X',
      tuning: ['E', 'B', 'G', 'D', 'A', 'E'],
      tempo: 120,
      sections: [{ id: 's1', title: '', columns: [[null, null, null, null, null, null]], bars: [], ghosts: [], pageBreak: false }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    act(() => result.current.loadTabDirectly(foreignTab))
    expect(result.current.tab.updatedAt).toBeUndefined()
  })
})

describe('backend switching', () => {
  it('clears the tab list while loading the next backend', async () => {
    await saveTab({
      id: 'local-1',
      title: 'Local Tab',
      tuning: ['E', 'B', 'G', 'D', 'A', 'E'],
      tempo: 120,
      sections: [],
    })

    let resolveList
    const listDriveTabs = vi.fn().mockImplementation(() => new Promise(resolve => {
      resolveList = resolve
    }))

    const { result } = getHook()

    await act(async () => {
      await result.current.switchToLocal()
    })
    expect(result.current.savedTabs.map(t => t.title)).toEqual(['Local Tab'])

    let switchPromise
    await act(async () => {
      switchPromise = result.current.switchToDrive({
        listDriveTabs,
        loadFromDrive: vi.fn(),
        saveToDrive: vi.fn(),
        deleteFromDrive: vi.fn(),
      })
      await Promise.resolve()
    })

    expect(result.current.savedTabs).toEqual([])
    expect(result.current.tabsLoaded).toBe(false)
    expect(result.current.tab).toBeNull()

    resolveList([])
    await act(async () => {
      await switchPromise
    })

    expect(result.current.savedTabs).toEqual([])
    expect(result.current.tabsLoaded).toBe(true)
    expect(result.current.tab).toBeDefined()
    expect(result.current.tab.title).toBe('Untitled Tab')
  })
})
