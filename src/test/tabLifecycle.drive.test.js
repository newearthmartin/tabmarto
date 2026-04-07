/**
 * Drive versions of the tab lifecycle tests.
 * These mirror tabLifecycle.test.js but replace localStorage persistence
 * with Google Drive API calls (mocked via fetch).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTabEditor } from '../hooks/useTabEditor.js'
import { exportTab, importTab } from '../utils/tabFormat.js'
import { DriveBackend } from '../utils/storageBackend.js'
import { loadTabs, saveTab } from '../utils/storage.js'
import {
  makeTab, seedValidToken, loadDriveModule, mockDriveFetch,
  FAKE_TOKEN, FAKE_DRIVE_ID,
} from './helpers.js'

afterEach(() => {
  sessionStorage.clear()
  vi.restoreAllMocks()
})

// ── save ──────────────────────────────────────────────────────────────────────

describe('tab lifecycle — Drive save', () => {
  it('saveToDrive POSTs the tab JSON when there is no existing driveId', async () => {
    seedValidToken()
    const { saveToDrive } = await loadDriveModule()
    const fetchMock = mockDriveFetch()

    const tab = makeTab()
    const id = await saveToDrive(tab, exportTab)

    const [url, opts] = fetchMock.mock.calls[0]
    expect(opts.method).toBe('POST')
    expect(url).toContain('upload/drive/v3/files')
    expect(id).toBe(FAKE_DRIVE_ID)
  })

  it('saveToDrive PATCHes when the tab already has a driveId', async () => {
    seedValidToken()
    const { saveToDrive } = await loadDriveModule()
    const fetchMock = mockDriveFetch()

    const tab = makeTab({ driveId: FAKE_DRIVE_ID })
    await saveToDrive(tab, exportTab)

    const [url, opts] = fetchMock.mock.calls[0]
    expect(opts.method).toBe('PATCH')
    expect(url).toContain(FAKE_DRIVE_ID)
  })

  it('the body sent to Drive contains the exportTab JSON', async () => {
    seedValidToken()
    const { saveToDrive } = await loadDriveModule()
    const fetchMock = mockDriveFetch()

    const tab = makeTab()
    await saveToDrive(tab, exportTab)

    const body = fetchMock.mock.calls[0][1].body
    expect(body).toContain(exportTab(tab))
  })

  it('keeps the local tab id stable on first Drive save and attaches driveId', async () => {
    const backend = new DriveBackend({
      listDriveTabs: vi.fn(),
      loadFromDrive: vi.fn(),
      saveToDrive: vi.fn().mockResolvedValue(FAKE_DRIVE_ID),
      deleteFromDrive: vi.fn(),
    })
    backend.setTabCodec({ exportTab, importTab })

    const tab = makeTab({ id: 'local-temp-id', driveId: undefined })
    const saved = await backend.save(tab)

    expect(saved.id).toBe('local-temp-id')
    expect(saved.driveId).toBe(FAKE_DRIVE_ID)
  })

  it('uses app internal ids from Drive metadata when listing tabs', async () => {
    const backend = new DriveBackend({
      listDriveTabs: vi.fn().mockResolvedValue([
        {
          id: FAKE_DRIVE_ID,
          name: 'Source Tab.json',
          modifiedTime: '2024-01-01T00:00:00Z',
          appProperties: { appId: 'internal-tab-id' },
        },
      ]),
      loadFromDrive: vi.fn(),
      saveToDrive: vi.fn(),
      deleteFromDrive: vi.fn(),
    })

    const tabs = await backend.listTabs()

    expect(tabs).toEqual([{
      id: 'internal-tab-id',
      driveId: FAKE_DRIVE_ID,
      title: 'Source Tab',
      modifiedTime: '2024-01-01T00:00:00Z',
    }])
  })

  it('preserves edits made while the first Drive save is in flight', async () => {
    vi.useFakeTimers()

    const saveResolvers = []
    const saveToDrive = vi.fn().mockImplementation(() => new Promise(resolve => {
      saveResolvers.push(resolve)
    }))

    const { result } = renderHook(() => useTabEditor())

    await act(async () => {
      await result.current.switchToDrive({
        listDriveTabs: vi.fn().mockResolvedValue([]),
        loadFromDrive: vi.fn(),
        saveToDrive,
        deleteFromDrive: vi.fn(),
      })
    })

    act(() => result.current.newTab('In Flight'))

    const originalId = result.current.tab.id

    act(() => result.current.updateTitle('In Flight'))
    await act(async () => {
      vi.advanceTimersByTime(600)
    })

    act(() => result.current.setNote(0, 0, 0, 7))

    saveResolvers.shift()(FAKE_DRIVE_ID)
    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      vi.advanceTimersByTime(600)
    })

    saveResolvers.shift()(FAKE_DRIVE_ID)
    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.tab.id).toBe(originalId)
    expect(result.current.tab.driveId).toBe(FAKE_DRIVE_ID)
    expect(result.current.tab.sections[0].columns[0][0]).toBe(7)
    expect(result.current.tab.updatedAt).toBeUndefined()

    vi.useRealTimers()
  })

  it('renaming an already-saved Drive tab saves once and clears the dirty state', async () => {
    vi.useFakeTimers()

    let currentName = 'Source Tab.json'
    const listDriveTabs = vi.fn().mockImplementation(async () => [{
      id: FAKE_DRIVE_ID,
      name: currentName,
      modifiedTime: '2024-01-01T00:00:00Z',
      appProperties: { appId: 'src' },
    }])
    const loadFromDrive = vi.fn().mockResolvedValue(exportTab(makeTab({ id: 'src', title: 'Source Tab' })))
    const saveToDrive = vi.fn().mockImplementation(async (tab) => {
      currentName = `${tab.title}.json`
      return FAKE_DRIVE_ID
    })

    const { result } = renderHook(() => useTabEditor())

    await act(async () => {
      await result.current.switchToDrive({
        listDriveTabs,
        loadFromDrive,
        saveToDrive,
        deleteFromDrive: vi.fn(),
      })
    })

    expect(result.current.tab.title).toBe('Source Tab')
    expect(result.current.tab.driveId).toBe(FAKE_DRIVE_ID)

    act(() => result.current.updateTitle('Renamed Tab'))
    await act(async () => {
      vi.advanceTimersByTime(600)
      await Promise.resolve()
    })

    await act(async () => {
      vi.advanceTimersByTime(1000)
      await Promise.resolve()
    })

    expect(saveToDrive).toHaveBeenCalledTimes(1)
    expect(result.current.tab.title).toBe('Renamed Tab')
    expect(result.current.tab.driveId).toBe(FAKE_DRIVE_ID)
    expect(result.current.tab.updatedAt).toBeUndefined()
    expect(result.current.savedTabs[0].title).toBe('Renamed Tab')

    vi.useRealTimers()
  })

  it('Drive tabs (with driveId) are NOT saved to localStorage when flushed', () => {
    const { result } = renderHook(() => useTabEditor())

    // Edit the tab so it becomes dirty
    act(() => result.current.updateTitle('Drive Only'))
    act(() => result.current.setNote(0, 0, 0, 5))

    // Simulate what App.jsx does after saveToDrive resolves
    const tabId = result.current.tab.id
    act(() => result.current.setDriveId(tabId, FAKE_DRIVE_ID))

    // Switching tabs flushes dirty tabs — Drive tab must be skipped
    act(() => result.current.newTab('Local Tab'))

    const saved = loadTabs()
    expect(saved.find(t => t.title === 'Drive Only')).toBeUndefined()
  })

  it('deleting an unsaved Drive tab removes it without calling Drive delete', async () => {
    const deleteFromDrive = vi.fn()
    const { result } = renderHook(() => useTabEditor())

    await act(async () => {
      await result.current.switchToDrive({
        listDriveTabs: vi.fn().mockResolvedValue([]),
        loadFromDrive: vi.fn(),
        saveToDrive: vi.fn(),
        deleteFromDrive,
      })
    })

    act(() => result.current.newTab('Unsaved Drive Tab'))
    const id = result.current.tab.id

    await act(async () => {
      await result.current.deleteTabById(id)
    })

    expect(deleteFromDrive).not.toHaveBeenCalled()
    expect(result.current.tab).toBeDefined()
    expect(result.current.tab.id).not.toBe(id)
    expect(result.current.savedTabs).toEqual([])
  })
})

// ── load ──────────────────────────────────────────────────────────────────────

describe('tab lifecycle — Drive load', () => {
  it('loadFromDrive returns the raw file content', async () => {
    seedValidToken()
    const { loadFromDrive } = await loadDriveModule()
    const content = exportTab(makeTab())
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => content,
    }))

    const text = await loadFromDrive(FAKE_DRIVE_ID)
    expect(text).toBe(content)
  })

  it('importTab on Drive content restores title, tempo, and sections', async () => {
    seedValidToken()
    const { loadFromDrive } = await loadDriveModule()
    const original = makeTab()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => exportTab(original),
    }))

    const text = await loadFromDrive(FAKE_DRIVE_ID)
    const parsed = importTab(text)

    expect(parsed.title).toBe(original.title)
    expect(parsed.tempo).toBe(original.tempo)
    expect(parsed.sections[0].title).toBe(original.sections[0].title)
  })

  it('importTab on Drive content restores notes', async () => {
    seedValidToken()
    const { loadFromDrive } = await loadDriveModule()
    const original = makeTab()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => exportTab(original),
    }))

    const text = await loadFromDrive(FAKE_DRIVE_ID)
    const parsed = importTab(text)

    expect(parsed.sections[0].columns[0][0]).toBe(5)
    expect(parsed.sections[0].columns[1][1]).toBe(7)
  })

  it('loadTabDirectly with driveId makes the tab active with driveId set', async () => {
    seedValidToken()
    const { loadFromDrive } = await loadDriveModule()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => exportTab(makeTab()),
    }))

    const { result } = renderHook(() => useTabEditor())
    const text = await loadFromDrive(FAKE_DRIVE_ID)
    const parsed = importTab(text)

    act(() => result.current.loadTabDirectly({ ...parsed, driveId: FAKE_DRIVE_ID }))

    expect(result.current.tab.title).toBe('Source Tab')
    expect(result.current.tab.driveId).toBe(FAKE_DRIVE_ID)
  })

  it('cursor resets to 0,0,0 after loading from Drive', async () => {
    seedValidToken()
    const { loadFromDrive } = await loadDriveModule()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => exportTab(makeTab()),
    }))

    const { result } = renderHook(() => useTabEditor())
    act(() => result.current.setCursor({ section: 0, col: 5, string: 3 }))

    const text = await loadFromDrive(FAKE_DRIVE_ID)
    const parsed = importTab(text)
    act(() => result.current.loadTabDirectly({ ...parsed, driveId: FAKE_DRIVE_ID }))

    expect(result.current.cursor).toEqual({ section: 0, col: 0, string: 0 })
  })
})

// ── roundtrip ─────────────────────────────────────────────────────────────────

describe('tab lifecycle — Drive roundtrip', () => {
  it('notes survive a full save → load cycle', async () => {
    // Step 1: export and "save" to Drive (capture the body)
    seedValidToken()
    const { saveToDrive, loadFromDrive } = await loadDriveModule()

    let savedContent = null
    const fetchMock = vi.fn().mockImplementation(async (url, opts) => {
      if (opts?.method === 'POST' || opts?.method === 'PATCH') {
        // Intercept the save: extract the tab JSON from the multipart body
        savedContent = opts.body
        return { ok: true, json: async () => ({ id: FAKE_DRIVE_ID }) }
      }
      // Intercept the load: return what was saved
      return { ok: true, text: async () => savedContent }
    })
    vi.stubGlobal('fetch', fetchMock)

    const original = makeTab()
    await saveToDrive(original, exportTab)

    // The multipart body contains the exportTab JSON — extract it
    const exportedJson = exportTab(original)
    expect(savedContent).toContain(exportedJson)

    // Step 2: "load" from Drive — return the saved JSON directly
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => exportedJson,
    }))

    const text = await loadFromDrive(FAKE_DRIVE_ID)
    const restored = importTab(text)

    expect(restored.title).toBe(original.title)
    expect(restored.sections[0].columns[0][0]).toBe(5)
    expect(restored.sections[0].columns[1][1]).toBe(7)
    expect(restored.sections[0].bars).toEqual([0])
  })

  it('multiple sections survive a Drive roundtrip', async () => {
    seedValidToken()
    const { saveToDrive } = await loadDriveModule()

    const tab = makeTab({
      sections: [
        { id: 's1', title: 'Verse',  columns: [[3,null,null,null,null,null]], bars: [], ghosts: [], pageBreak: false },
        { id: 's2', title: 'Chorus', columns: [[null,null,null,null,null,7]], bars: [0], ghosts: [], pageBreak: false },
      ],
    })

    let exportedJson = null
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_, opts) => {
      exportedJson = exportTab(tab) // capture what would be sent
      return { ok: true, json: async () => ({ id: FAKE_DRIVE_ID }) }
    }))

    await saveToDrive(tab, exportTab)

    const restored = importTab(exportedJson)
    expect(restored.sections).toHaveLength(2)
    expect(restored.sections[0].title).toBe('Verse')
    expect(restored.sections[1].title).toBe('Chorus')
    expect(restored.sections[0].columns[0][0]).toBe(3)
    expect(restored.sections[1].columns[0][5]).toBe(7)
  })
})

// ── delete ────────────────────────────────────────────────────────────────────

describe('tab lifecycle — Drive delete', () => {
  it('deleteFromDrive sends a DELETE request', async () => {
    seedValidToken()
    const { deleteFromDrive } = await loadDriveModule()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '' })
    vi.stubGlobal('fetch', fetchMock)

    await deleteFromDrive(FAKE_DRIVE_ID)

    const [url, opts] = fetchMock.mock.calls[0]
    expect(opts.method).toBe('DELETE')
    expect(url).toContain(FAKE_DRIVE_ID)
    expect(opts.headers.Authorization).toBe(`Bearer ${FAKE_TOKEN}`)
  })

  it('deleting a Drive tab does not affect local tabs', async () => {
    seedValidToken()
    const { deleteFromDrive } = await loadDriveModule()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => '' }))

    await saveTab({ id: 'local-1', title: 'Local Tab', sections: [] })

    await deleteFromDrive(FAKE_DRIVE_ID)

    // Local tab is unaffected
    expect(loadTabs().find(t => t.title === 'Local Tab')).toBeDefined()
  })
})
