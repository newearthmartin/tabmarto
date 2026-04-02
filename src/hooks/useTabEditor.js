import { useState, useCallback, useEffect, useRef } from 'react'
import { storageManager } from '../utils/storageBackend.js'
import {
  STANDARD_TUNING,
  createEmptyColumns,
  createNewTab,
  createSection,
  generateId,
  migrateTab,
} from '../utils/tabModel.js'
import { charToFret } from '../utils/fret.js'
import { importTab as parseTab, exportTab as serializeTab } from '../utils/tabFormat.js'

export { STANDARD_TUNING, generateId }

const MAX_HISTORY = 100

function updateSection(prev, si, updater) {
  return {
    ...prev,
    sections: prev.sections.map((section, index) => index === si ? { ...updater(section) } : section),
    updatedAt: Date.now(),
  }
}

function shiftBarsInsert(bars, afterCol) {
  return bars.map(bar => bar > afterCol ? bar + 1 : bar)
}

function shiftBarsDelete(bars, col) {
  return bars.filter(bar => bar !== col).map(bar => bar > col ? bar - 1 : bar)
}

function stripDirty(tab) {
  if (!tab) return tab
  const { updatedAt, ...rest } = tab
  return rest
}

function getStorageTabId(tab) {
  return tab?.id ?? null
}

function matchesTabIdentity(tab, id) {
  return !!tab && (tab.id === id || tab.driveId === id)
}

function replaceTabRecord(prev, oldId, nextTab) {
  const next = { ...prev }

  if (oldId !== nextTab.id) {
    delete next[oldId]
  }

  next[nextTab.id] = nextTab

  const dirty = new Set(prev._dirty ?? [])
  dirty.delete(oldId)
  dirty.delete(nextTab.id)
  next._dirty = dirty

  return next
}

function mergeSavedTab(prev, oldId, savedTab, sourceUpdatedAt) {
  const current = prev[oldId] ?? prev[savedTab.id]
  if (!current) return replaceTabRecord(prev, oldId, savedTab)

  const next = { ...prev }
  const dirty = new Set(prev._dirty ?? [])
  const hasNewerEdits = current.updatedAt && current.updatedAt !== sourceUpdatedAt

  if (hasNewerEdits) {
    next[current.id] = {
      ...current,
      driveId: savedTab.driveId ?? current.driveId,
    }
    dirty.add(current.id)
  } else {
    if (oldId !== savedTab.id) {
      delete next[oldId]
    }
    next[savedTab.id] = savedTab
    dirty.delete(oldId)
    dirty.delete(savedTab.id)
  }

  next._dirty = dirty
  return next
}

export function useTabEditor() {
  const initialTabRef = useRef(null)
  if (!initialTabRef.current) initialTabRef.current = createNewTab()
  const initialTab = initialTabRef.current

  const [tabsMap, setTabsMap] = useState(() => ({ [initialTab.id]: initialTab, _dirty: new Set() }))
  const [currentId, setCurrentId] = useState(initialTab.id)
  const [savedTabs, setSavedTabs] = useState([])
  const [cursor, setCursor] = useState({ section: 0, col: 0, string: 0 })
  const [driveSaving, setDriveSaving] = useState(false)
  const [tabsLoaded, setTabsLoaded] = useState(false)
  const [loadingTabId, setLoadingTabId] = useState(null)

  const tab = tabsMap[currentId] ?? null
  const tabRef = useRef(tab)
  const tabsMapRef = useRef(tabsMap)
  const currentIdRef = useRef(currentId)
  const historyRef = useRef([])
  const backendLoadRef = useRef(0)

  tabRef.current = tab
  tabsMapRef.current = tabsMap
  currentIdRef.current = currentId

  function pushHistory() {
    if (!tabRef.current) return
    historyRef.current = [...historyRef.current.slice(-(MAX_HISTORY - 1)), tabRef.current]
  }

  const refreshSavedTabs = useCallback(async () => {
    const summaries = await storageManager.listTabs()
    setSavedTabs(summaries)
    return summaries
  }, [])

  const setTab = useCallback((updater) => {
    setTabsMap(prev => {
      const current = prev[currentIdRef.current]
      if (!current) return prev

      const nextTab = typeof updater === 'function' ? updater(current) : updater
      if (nextTab === current) return prev

      const dirty = new Set(prev._dirty ?? [])
      if (nextTab.updatedAt) dirty.add(nextTab.id)

      return { ...prev, [nextTab.id]: nextTab, _dirty: dirty }
    })
  }, [])

  const applyLoadedTab = useCallback((rawTab) => {
    if (!rawTab) return null

    historyRef.current = []
    const migrated = migrateTab(stripDirty(rawTab))

    setTabsMap(prev => ({ ...prev, [migrated.id]: migrated }))
    setCurrentId(migrated.id)
    setCursor({ section: 0, col: 0, string: 0 })

    return migrated
  }, [])

  const clearBackendState = useCallback(() => {
    historyRef.current = []
    setSavedTabs([])
    setTabsLoaded(false)
    setLoadingTabId(null)
    setTabsMap({ _dirty: new Set() })
    setCurrentId(null)
    setCursor({ section: 0, col: 0, string: 0 })
  }, [])

  const flushAllDirty = useCallback(async () => {
    const snapshot = tabsMapRef.current
    const dirtyIds = Array.from(snapshot._dirty ?? [])
    if (!dirtyIds.length) return

    setDriveSaving(true)

    const savedEntries = []
    const failedIds = new Set()

    for (const id of dirtyIds) {
      const dirtyTab = snapshot[id]
      if (!dirtyTab?.updatedAt) continue
      if (!storageManager.shouldSaveTab(dirtyTab)) continue

      try {
        const savedTab = await storageManager.save(dirtyTab)
        storageManager.setLastId(getStorageTabId(savedTab))
        savedEntries.push({
          oldId: id,
          tab: stripDirty(savedTab),
          sourceUpdatedAt: dirtyTab.updatedAt,
        })
      } catch (error) {
        console.error('Failed to save tab:', error)
        failedIds.add(id)
      }
    }

    if (savedEntries.length || failedIds.size !== dirtyIds.length) {
      let nextCurrentId = currentIdRef.current

      setTabsMap(prev => {
        let next = { ...prev, _dirty: new Set(failedIds) }
        for (const entry of savedEntries) {
          next = mergeSavedTab(next, entry.oldId, entry.tab, entry.sourceUpdatedAt)
          if (nextCurrentId === entry.oldId) nextCurrentId = entry.tab.id
        }
        return next
      })

      if (nextCurrentId !== currentIdRef.current) {
        setCurrentId(nextCurrentId)
      }
    }

    await refreshSavedTabs()
    setDriveSaving(false)
  }, [refreshSavedTabs])

  const persistCurrentTab = useCallback(async (rawTab) => {
    if (!rawTab) return null
    if (!storageManager.shouldSaveTab(rawTab)) return stripDirty(rawTab)

    setDriveSaving(true)

    try {
      const savedTab = stripDirty(await storageManager.save(rawTab))
      storageManager.setLastId(getStorageTabId(savedTab))

      setTabsMap(prev => mergeSavedTab(prev, rawTab.id, savedTab, rawTab.updatedAt))
      if (currentIdRef.current === rawTab.id && rawTab.id !== savedTab.id) {
        setCurrentId(savedTab.id)
      }

      await refreshSavedTabs()
      return savedTab
    } finally {
      setDriveSaving(false)
    }
  }, [refreshSavedTabs])

  const mountedRef = useRef(false)
  const debounceTimer = useRef(null)
  const flushPromiseRef = useRef(null)

  const scheduleFlush = useCallback((delay = 500) => {
    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      flushPromiseRef.current = flushAllDirty()
      flushPromiseRef.current.finally(() => {
        flushPromiseRef.current = null
        if ((tabsMapRef.current._dirty?.size ?? 0) > 0) {
          scheduleFlush()
        }
      })
    }, delay)
  }, [flushAllDirty])

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }

    if (!tab?.updatedAt || flushPromiseRef.current) return

    scheduleFlush()

    return () => clearTimeout(debounceTimer.current)
  }, [tab?.updatedAt, scheduleFlush])

  const numStrings = tab?.tuning?.length || 6

  const undo = useCallback(() => {
    const history = historyRef.current
    if (!history.length) return
    historyRef.current = history.slice(0, -1)
    setTab(history[history.length - 1])
  }, [setTab])

  const moveCursor = useCallback((dCol, dStr) => {
    setCursor(prev => {
      const sections = tabRef.current?.sections
      if (!sections) return prev

      let { section: si, col, string } = prev

      col += dCol
      if (dCol < 0 && col < 0) {
        if (si > 0) {
          si -= 1
          col = sections[si].columns.length - 1
        } else {
          col = 0
        }
      } else if (dCol > 0 && col >= sections[si].columns.length) {
        if (si < sections.length - 1) {
          si += 1
          col = 0
        } else {
          col = sections[si].columns.length - 1
        }
      }

      const nextString = string + dStr
      if (dStr > 0 && nextString >= numStrings) {
        if (si < sections.length - 1) {
          si += 1
          col = Math.min(col, sections[si].columns.length - 1)
          string = 0
        }
      } else if (dStr < 0 && nextString < 0) {
        if (si > 0) {
          si -= 1
          col = Math.min(col, sections[si].columns.length - 1)
          string = numStrings - 1
        }
      } else {
        string = Math.max(0, Math.min(numStrings - 1, nextString))
      }

      return { section: si, col, string }
    })
  }, [numStrings])

  const handleChar = useCallback((char) => {
    const fret = charToFret(char)
    if (fret === null) return

    pushHistory()
    setTab(prev => updateSection(prev, cursor.section, section => {
      const columns = section.columns.map((column, colIndex) =>
        colIndex === cursor.col ? column.map((value, stringIndex) => stringIndex === cursor.string ? fret : value) : column
      )
      const expanded = cursor.col >= columns.length - 1
        ? [...columns, Array(numStrings).fill(null)]
        : columns
      return { ...section, columns: expanded }
    }))
    setCursor(prev => ({ ...prev, col: prev.col + 1 }))
  }, [cursor.section, cursor.col, cursor.string, numStrings, setTab])

  const clearNote = useCallback(() => {
    pushHistory()
    setTab(prev => updateSection(prev, cursor.section, section => ({
      ...section,
      columns: section.columns.map((column, colIndex) =>
        colIndex === cursor.col ? column.map((value, stringIndex) => stringIndex === cursor.string ? null : value) : column
      ),
    })))
  }, [cursor.section, cursor.col, cursor.string, setTab])

  const setNote = useCallback((sectionIdx, col, string, value) => {
    pushHistory()
    setTab(prev => updateSection(prev, sectionIdx, section => ({
      ...section,
      columns: section.columns.map((column, colIndex) =>
        colIndex === col ? column.map((cell, stringIndex) => stringIndex === string ? value : cell) : column
      ),
    })))
  }, [setTab])

  const clearRange = useCallback((sectionIdx, startCol, endCol) => {
    pushHistory()
    const lo = Math.min(startCol, endCol)
    const hi = Math.max(startCol, endCol)
    setTab(prev => updateSection(prev, sectionIdx, section => ({
      ...section,
      columns: section.columns.map((column, colIndex) => colIndex >= lo && colIndex <= hi ? Array(numStrings).fill(null) : column),
    })))
  }, [numStrings, setTab])

  const insertColumnAfter = useCallback((sectionIdx, col) => {
    pushHistory()
    setTab(prev => updateSection(prev, sectionIdx, section => ({
      ...section,
      columns: [...section.columns.slice(0, col + 1), Array(numStrings).fill(null), ...section.columns.slice(col + 1)],
      bars: shiftBarsInsert(section.bars, col),
    })))
  }, [numStrings, setTab])

  const deleteColumn = useCallback((sectionIdx, col) => {
    pushHistory()
    setTab(prev => updateSection(prev, sectionIdx, section => {
      if (section.columns.length <= 1) return section
      return {
        ...section,
        columns: section.columns.filter((_, index) => index !== col),
        bars: shiftBarsDelete(section.bars, col),
      }
    }))
    setCursor(prev => ({
      ...prev,
      col: Math.max(0, Math.min(prev.col, (tabRef.current?.sections[sectionIdx]?.columns.length ?? 2) - 2)),
    }))
  }, [setTab])

  const insertMeasureBreak = useCallback(() => {
    pushHistory()
    setTab(prev => updateSection(prev, cursor.section, section => ({
      ...section,
      columns: [
        ...section.columns.slice(0, cursor.col + 1),
        ...createEmptyColumns(4, numStrings),
        ...section.columns.slice(cursor.col + 1),
      ],
      bars: shiftBarsInsert(
        shiftBarsInsert(
          shiftBarsInsert(
            shiftBarsInsert(section.bars, cursor.col),
            cursor.col,
          ),
          cursor.col,
        ),
        cursor.col,
      ),
    })))
    setCursor(prev => ({ ...prev, col: prev.col + 1 }))
  }, [cursor.section, cursor.col, numStrings, setTab])

  const toggleBar = useCallback((sectionIdx, col) => {
    pushHistory()
    setTab(prev => updateSection(prev, sectionIdx, section => ({
      ...section,
      bars: section.bars.includes(col)
        ? section.bars.filter(bar => bar !== col)
        : [...section.bars, col].sort((a, b) => a - b),
    })))
  }, [setTab])

  const pasteColumns = useCallback((sectionIdx, cols, atCol) => {
    if (!cols?.length) return

    pushHistory()
    setTab(prev => updateSection(prev, sectionIdx, section => {
      const needed = atCol + cols.length
      const extra = needed > section.columns.length ? createEmptyColumns(needed - section.columns.length, numStrings) : []
      const columns = [...section.columns, ...extra]
      cols.forEach((column, index) => {
        columns[atCol + index] = [...column]
      })
      return { ...section, columns }
    }))
  }, [numStrings, setTab])

  const addSection = useCallback((afterIndex) => {
    pushHistory()
    setTab(prev => {
      const sections = [
        ...prev.sections.slice(0, afterIndex + 1),
        createSection('', prev.tuning.length),
        ...prev.sections.slice(afterIndex + 1),
      ]
      return { ...prev, sections, updatedAt: Date.now() }
    })
    setCursor({ section: afterIndex + 1, col: 0, string: 0 })
  }, [setTab])

  const deleteSection = useCallback((index) => {
    pushHistory()
    setTab(prev => {
      if (prev.sections.length <= 1) return prev
      return { ...prev, sections: prev.sections.filter((_, sectionIndex) => sectionIndex !== index), updatedAt: Date.now() }
    })
    setCursor(prev => ({
      section: Math.max(0, Math.min(prev.section, (tabRef.current?.sections.length ?? 1) - 2)),
      col: 0,
      string: 0,
    }))
  }, [setTab])

  const updateSectionTitle = useCallback((index, title) => {
    setTab(prev => updateSection(prev, index, section => ({ ...section, title })))
  }, [setTab])

  const toggleSectionPageBreak = useCallback((index) => {
    setTab(prev => updateSection(prev, index, section => ({ ...section, pageBreak: !section.pageBreak })))
  }, [setTab])

  const toggleGhost = useCallback((sectionIdx, col, string) => {
    setTab(prev => updateSection(prev, sectionIdx, section => {
      const key = `${col},${string}`
      const ghosts = section.ghosts ?? []
      return {
        ...section,
        ghosts: ghosts.includes(key) ? ghosts.filter(value => value !== key) : [...ghosts, key],
      }
    }))
  }, [setTab])

  const appendSections = useCallback((sections) => {
    pushHistory()
    setTab(prev => ({ ...prev, sections: [...prev.sections, ...sections], updatedAt: Date.now() }))
  }, [setTab])

  const newTab = useCallback((title = 'Untitled Tab') => {
    void flushAllDirty()
    historyRef.current = []
    const nextTab = createNewTab(title)
    setTabsMap(prev => ({ ...prev, [nextTab.id]: nextTab }))
    setCurrentId(nextTab.id)
    setCursor({ section: 0, col: 0, string: 0 })
  }, [flushAllDirty])

  const saveCurrentTab = useCallback(async () => {
    const current = tabRef.current
    if (!current) return
    await persistCurrentTab(current)
  }, [persistCurrentTab])

  const loadTabById = useCallback(async (id) => {
    if (id === currentIdRef.current) return

    await flushAllDirty()
    setLoadingTabId(id)

    try {
      const existing = tabsMapRef.current[id]
      if (existing) {
        const applied = applyLoadedTab(existing)
        if (applied) storageManager.setLastId(applied.id)
        return
      }

      const loaded = await storageManager.loadTab(id)
      const applied = applyLoadedTab(loaded)
      if (applied) storageManager.setLastId(id)
    } finally {
      setLoadingTabId(null)
    }
  }, [applyLoadedTab, flushAllDirty])

  const loadTabDirectly = useCallback((tabData) => {
    void flushAllDirty()
    applyLoadedTab(tabData)
  }, [applyLoadedTab, flushAllDirty])

  const importTab = useCallback(async (tabData) => {
    await flushAllDirty()
    historyRef.current = []
    const migrated = migrateTab(stripDirty(tabData))
    const saved = await persistCurrentTab({ ...migrated, updatedAt: Date.now() })
    if (!saved) return
    setCurrentId(saved.id)
    setCursor({ section: 0, col: 0, string: 0 })
  }, [flushAllDirty, persistCurrentTab])

  const deleteTabById = useCallback(async (id) => {
    const existingTab = Object.values(tabsMapRef.current).find(value => value && value !== tabsMapRef.current._dirty && matchesTabIdentity(value, id))
    const needsBackendDelete = !(storageManager.isDrive() && existingTab && !existingTab.driveId)

    if (needsBackendDelete) {
      await storageManager.delete(id)
    }

    setTabsMap(prev => {
      const next = { ...prev }
      const matchingId = Object.keys(prev).find(key => key !== '_dirty' && matchesTabIdentity(prev[key], id))
      if (matchingId) delete next[matchingId]
      const dirty = new Set(prev._dirty ?? [])
      dirty.delete(id)
      if (matchingId) dirty.delete(matchingId)
      next._dirty = dirty
      return next
    })

    const summaries = await refreshSavedTabs()

    if (!matchesTabIdentity(tabRef.current, id)) return

    if (summaries.length > 0) {
      const loaded = await storageManager.loadTab(summaries[0].id)
      applyLoadedTab(loaded)
    } else {
      historyRef.current = []
      const freshTab = createNewTab()
      setTabsMap({ [freshTab.id]: freshTab, _dirty: new Set() })
      setCurrentId(freshTab.id)
      setCursor({ section: 0, col: 0, string: 0 })
    }
  }, [applyLoadedTab, refreshSavedTabs])

  const updateTitle = useCallback((title) => {
    setTab(prev => ({ ...prev, title, updatedAt: Date.now() }))
  }, [setTab])

  const updateTuning = useCallback((tuning) => {
    pushHistory()
    setTab(prev => ({ ...prev, tuning, updatedAt: Date.now() }))
  }, [setTab])

  const updateTempo = useCallback((tempo) => {
    setTab(prev => ({ ...prev, tempo: Number(tempo), updatedAt: Date.now() }))
  }, [setTab])

  const setDriveId = useCallback((tabId, driveId) => {
    setTabsMap(prev => {
      const current = prev[tabId]
      if (!current || current.driveId === driveId) return prev
      return { ...prev, [tabId]: { ...current, driveId } }
    })
  }, [])

  const clearUpdatedAt = useCallback(() => {
    setTab(prev => prev.updatedAt ? { ...prev, updatedAt: undefined } : prev)
  }, [setTab])

  const switchBackend = useCallback(async (mode, driveApi = null) => {
    const loadToken = backendLoadRef.current + 1
    backendLoadRef.current = loadToken
    clearBackendState()

    if (mode === 'drive') {
      storageManager.useDrive(driveApi)
      storageManager.setTabCodec({ exportTab: serializeTab, importTab: parseTab })
    } else {
      storageManager.useLocal()
    }

    const summaries = await storageManager.listTabs()
    if (backendLoadRef.current !== loadToken) return
    setSavedTabs(summaries)

    if (summaries.length > 0) {
      const lastId = storageManager.getLastId()
      const startId = summaries.find(tabSummary => tabSummary.id === lastId)?.id ?? summaries[0].id
      const loaded = await storageManager.loadTab(startId)
      if (backendLoadRef.current !== loadToken) return
      applyLoadedTab(loaded)
    } else {
      const freshTab = createNewTab()
      historyRef.current = []
      setTabsMap({ [freshTab.id]: freshTab, _dirty: new Set() })
      setCurrentId(freshTab.id)
      setCursor({ section: 0, col: 0, string: 0 })
    }

    if (backendLoadRef.current !== loadToken) return
    setTabsLoaded(true)
  }, [applyLoadedTab, clearBackendState])

  const switchToDrive = useCallback(async (driveApi) => {
    await switchBackend('drive', driveApi)
  }, [switchBackend])

  const switchToLocal = useCallback(async () => {
    await switchBackend('local')
  }, [switchBackend])

  return {
    tab,
    cursor,
    setCursor,
    moveCursor,
    undo,
    handleChar,
    clearNote,
    setNote,
    clearRange,
    insertColumnAfter,
    deleteColumn,
    insertMeasureBreak,
    toggleBar,
    pasteColumns,
    addSection,
    deleteSection,
    updateSectionTitle,
    toggleSectionPageBreak,
    toggleGhost,
    newTab,
    saveCurrentTab,
    loadTabById,
    loadTabDirectly,
    importTab,
    deleteTabById,
    savedTabs,
    updateTitle,
    updateTuning,
    updateTempo,
    appendSections,
    setDriveId,
    clearUpdatedAt,
    switchToDrive,
    switchToLocal,
    driveSaving,
    tabsLoaded,
    loadingTabId,
  }
}
