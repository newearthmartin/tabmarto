/**
 * Drive versions of the import integration tests.
 * These mirror import.integration.test.jsx but replace the ImportModal UI flow
 * with the Drive flow: loadFromDrive(id) → importTab(text) → loadTabDirectly({ ...parsed, driveId }).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTabEditor } from '../hooks/useTabEditor.js'
import { exportTab } from '../utils/tabFormat.js'
import { importTab } from '../utils/tabFormat.js'
import { toAscii } from '../utils/ascii.js'
import { parseAsciiTab } from '../utils/importAscii.js'
import {
  makeTab, ASCII_TAB, seedValidToken, loadDriveModule, FAKE_DRIVE_ID,
} from './helpers.js'

afterEach(() => {
  sessionStorage.clear()
  vi.restoreAllMocks()
})

// Simulate what the Sidebar's handleDriveOpen does:
// loadFromDrive(id) → importTab(text) → onDriveLoad(parsed, id) → loadTabDirectly({ ...parsed, driveId: id })
async function driveLoad(loadFromDrive, text, hook) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => text }))
  const raw = await loadFromDrive(FAKE_DRIVE_ID)
  const parsed = importTab(raw)
  act(() => hook.loadTabDirectly({ ...parsed, driveId: FAKE_DRIVE_ID }))
  return parsed
}

// ── loading a JSON tab from Drive ─────────────────────────────────────────────

describe('Drive import — load JSON tab', () => {
  it('restores title and tempo', async () => {
    seedValidToken()
    const { loadFromDrive } = await loadDriveModule()
    const { result } = renderHook(() => useTabEditor())
    await driveLoad(loadFromDrive, exportTab(makeTab()), result.current)

    expect(result.current.tab.title).toBe('Source Tab')
    expect(result.current.tab.tempo).toBe(130)
  })

  it('restores section title', async () => {
    seedValidToken()
    const { loadFromDrive } = await loadDriveModule()
    const { result } = renderHook(() => useTabEditor())
    await driveLoad(loadFromDrive, exportTab(makeTab()), result.current)

    expect(result.current.tab.sections[0].title).toBe('Chorus')
  })

  it('restores notes', async () => {
    seedValidToken()
    const { loadFromDrive } = await loadDriveModule()
    const { result } = renderHook(() => useTabEditor())
    await driveLoad(loadFromDrive, exportTab(makeTab()), result.current)

    expect(result.current.tab.sections[0].columns[0][0]).toBe(5)
    expect(result.current.tab.sections[0].columns[1][1]).toBe(7)
  })

  it('restores bar lines', async () => {
    seedValidToken()
    const { loadFromDrive } = await loadDriveModule()
    const { result } = renderHook(() => useTabEditor())
    await driveLoad(loadFromDrive, exportTab(makeTab()), result.current)

    expect(result.current.tab.sections[0].bars).toEqual([0])
  })

  it('sets the driveId on the loaded tab', async () => {
    seedValidToken()
    const { loadFromDrive } = await loadDriveModule()
    const { result } = renderHook(() => useTabEditor())
    await driveLoad(loadFromDrive, exportTab(makeTab()), result.current)

    expect(result.current.tab.driveId).toBe(FAKE_DRIVE_ID)
  })

  it('resets cursor to 0,0,0', async () => {
    seedValidToken()
    const { loadFromDrive } = await loadDriveModule()
    const { result } = renderHook(() => useTabEditor())
    act(() => result.current.setCursor({ section: 0, col: 4, string: 2 }))
    await driveLoad(loadFromDrive, exportTab(makeTab()), result.current)

    expect(result.current.cursor).toEqual({ section: 0, col: 0, string: 0 })
  })
})

// ── loading a multi-section tab from Drive ────────────────────────────────────

describe('Drive import — multi-section tab', () => {
  it('preserves all sections', async () => {
    seedValidToken()
    const { loadFromDrive } = await loadDriveModule()
    const tab = makeTab({
      sections: [
        { id: 's1', title: 'Intro',  columns: [[1,null,null,null,null,null]], bars: [], ghosts: [], pageBreak: false },
        { id: 's2', title: 'Verse',  columns: [[2,null,null,null,null,null]], bars: [], ghosts: [], pageBreak: false },
        { id: 's3', title: 'Chorus', columns: [[3,null,null,null,null,null]], bars: [], ghosts: [], pageBreak: false },
      ],
    })

    const { result } = renderHook(() => useTabEditor())
    await driveLoad(loadFromDrive, exportTab(tab), result.current)

    expect(result.current.tab.sections).toHaveLength(3)
    expect(result.current.tab.sections.map(s => s.title)).toEqual(['Intro', 'Verse', 'Chorus'])
  })

  it('preserves notes in every section', async () => {
    seedValidToken()
    const { loadFromDrive } = await loadDriveModule()
    const tab = makeTab({
      sections: [
        { id: 's1', title: 'A', columns: [[3,null,null,null,null,null]], bars: [], ghosts: [], pageBreak: false },
        { id: 's2', title: 'B', columns: [[null,null,null,null,null,9]], bars: [], ghosts: [], pageBreak: false },
      ],
    })

    const { result } = renderHook(() => useTabEditor())
    await driveLoad(loadFromDrive, exportTab(tab), result.current)

    expect(result.current.tab.sections[0].columns[0][0]).toBe(3)
    expect(result.current.tab.sections[1].columns[0][5]).toBe(9)
  })
})

// ── import into current tab from Drive ───────────────────────────────────────

describe('Drive import — append sections into current tab', () => {
  it('appendSections adds the Drive-loaded sections', async () => {
    seedValidToken()
    const { loadFromDrive } = await loadDriveModule()
    const { result } = renderHook(() => useTabEditor())
    const initialCount = result.current.tab.sections.length

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => exportTab(makeTab()) }))
    const raw = await loadFromDrive(FAKE_DRIVE_ID)
    const parsed = importTab(raw)

    act(() => result.current.appendSections(parsed.sections))

    expect(result.current.tab.sections.length).toBe(initialCount + parsed.sections.length)
  })

  it('appended sections have correct notes', async () => {
    seedValidToken()
    const { loadFromDrive } = await loadDriveModule()
    const { result } = renderHook(() => useTabEditor())

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => exportTab(makeTab()) }))
    const raw = await loadFromDrive(FAKE_DRIVE_ID)
    const parsed = importTab(raw)

    act(() => result.current.appendSections(parsed.sections))

    const added = result.current.tab.sections.at(-1)
    expect(added.columns[0][0]).toBe(5)
    expect(added.columns[1][1]).toBe(7)
  })

  it('original sections are untouched after appending from Drive', async () => {
    seedValidToken()
    const { loadFromDrive } = await loadDriveModule()
    const { result } = renderHook(() => useTabEditor())
    act(() => result.current.setNote(0, 0, 0, 3))

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => exportTab(makeTab()) }))
    const raw = await loadFromDrive(FAKE_DRIVE_ID)
    const parsed = importTab(raw)

    act(() => result.current.appendSections(parsed.sections))

    expect(result.current.tab.sections[0].columns[0][0]).toBe(3)
  })

  it('undo after appendSections reverts to original section count', async () => {
    seedValidToken()
    const { loadFromDrive } = await loadDriveModule()
    const { result } = renderHook(() => useTabEditor())
    const initialCount = result.current.tab.sections.length

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => exportTab(makeTab()) }))
    const raw = await loadFromDrive(FAKE_DRIVE_ID)
    const parsed = importTab(raw)

    act(() => result.current.appendSections(parsed.sections))
    act(() => result.current.undo())

    expect(result.current.tab.sections.length).toBe(initialCount)
  })
})

// ── Drive vs modal: same result ───────────────────────────────────────────────

describe('Drive import — same result as modal import', () => {
  it('Drive-loaded tab has same data as modal-imported tab for JSON', async () => {
    seedValidToken()
    const { loadFromDrive } = await loadDriveModule()
    const original = makeTab()
    const json = exportTab(original)

    // Modal path: importTab directly (same as ImportModal does internally)
    const modalResult = importTab(json)

    // Drive path: loadFromDrive → importTab
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => json }))
    const raw = await loadFromDrive(FAKE_DRIVE_ID)
    const driveResult = importTab(raw)

    expect(driveResult.title).toBe(modalResult.title)
    expect(driveResult.tempo).toBe(modalResult.tempo)
    expect(driveResult.sections[0].title).toBe(modalResult.sections[0].title)
    expect(driveResult.sections[0].columns[0][0]).toBe(modalResult.sections[0].columns[0][0])
    expect(driveResult.sections[0].columns[1][1]).toBe(modalResult.sections[0].columns[1][1])
    expect(driveResult.sections[0].bars).toEqual(modalResult.sections[0].bars)
  })
})
