import { useCallback, useEffect, useRef, useState } from 'react'
import { useTabEditor } from './hooks/useTabEditor.js'
import { playTab, playNote, resumeAudio } from './audio/player.js'
import { toAscii } from './utils/ascii.js'
import { charToFret } from './utils/fret.js'
import { isConnected, disconnect, listDriveTabs, saveToDrive, loadFromDrive, deleteFromDrive, fetchEmail } from './utils/googleDrive.js'
import { STANDARD_TUNING } from './hooks/useTabEditor.js'
import Toolbar from './components/Toolbar.jsx'
import SectionView from './components/SectionView.jsx'
import Sidebar from './components/Sidebar.jsx'
import ExportModal from './components/ExportModal.jsx'
import ImportModal from './components/ImportModal.jsx'
import './App.css'

export default function App() {
  const editor = useTabEditor()
  const {
    tab, cursor, setCursor,
    moveCursor, undo,
    handleChar, clearNote, setNote, clearRange,
    insertColumnAfter, deleteColumn, insertMeasureBreak,
    toggleBar, pasteColumns,
    addSection, deleteSection, updateSectionTitle, toggleSectionPageBreak, toggleGhost,
    newTab, loadTabById, importTab, deleteTabById, savedTabs,
    updateTitle, updateTuning, updateTempo, appendSections,
    switchToDrive, switchToLocal, driveSaving, tabsLoaded, loadingTabId,
  } = editor
  const visibleTab = tabsLoaded ? tab : null

  const [isDark, setIsDark] = useState(() => localStorage.getItem('tabmarto_theme') === 'dark')
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem('tabmarto_sidebar') !== 'closed')
  const [driveConnected, setDriveConnected] = useState(false)
  const [driveEmail, setDriveEmail] = useState(null)
  const [driveInitializing, setDriveInitializing] = useState(true)
  const [storageMode, setStorageMode] = useState('local')
  const [driveInitError, setDriveInitError] = useState(false)
  const driveLastSaved = null
  const hasInitializedDrive = useRef(false)

  useEffect(() => {
    if (hasInitializedDrive.current) return
    if (!isConnected()) {
      switchToLocal().then(() => {
        setStorageMode('local')
        setDriveInitError(false)
        hasInitializedDrive.current = true
      }).catch(() => {
        setStorageMode('local')
        setDriveInitError(true)
        hasInitializedDrive.current = true
      }).finally(() => {
        setDriveInitializing(false)
      })
      return
    }
    fetchEmail().then(email => {
      setDriveEmail(email)
      // Switch to Drive backend when already connected on mount
      return switchToDrive({ listDriveTabs, loadFromDrive, saveToDrive, deleteFromDrive })
    }).then(() => {
      setDriveConnected(true)
      setStorageMode('drive')
      setDriveInitError(false)
      hasInitializedDrive.current = true
    }).catch(() => {
      // Fall back to local storage on error
      return switchToLocal().finally(() => {
        setStorageMode('local')
        setDriveInitError(true)
        hasInitializedDrive.current = true
      })
    }).finally(() => {
      setDriveInitializing(false)
    })
  }, []) // eslint-disable-line

  function openSidebar() {
    setSidebarOpen(true)
    localStorage.setItem('tabmarto_sidebar', 'open')
  }

  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
    localStorage.setItem('tabmarto_theme', isDark ? 'dark' : 'light')
  }, [isDark])

  const [isPlaying, setIsPlaying] = useState(false)
  const [playingPos, setPlayingPos] = useState(null) // { section, col }
  const [showExport, setShowExport] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [selection, setSelection] = useState(null) // { section, start, end }

  const isPlayingRef = useRef(false)
  const cancelPlayRef = useRef(null)
  const playStartRef = useRef({ section: 0, col: 0 })
  const cursorRef = useRef(cursor)
  cursorRef.current = cursor
  const tabRef2 = useRef(visibleTab)
  tabRef2.current = visibleTab
  const clipboardRef = useRef(null)
  const isDraggingRef = useRef(false)
  const gridRef = useRef(null)

  // ── Selection helpers ─────────────────────────────────────────────────────
  const clearSelection = useCallback(() => setSelection(null), [])

  const getSelectionRange = useCallback(() => {
    if (!selection) return null
    return {
      section: selection.section,
      lo: Math.min(selection.start, selection.end),
      hi: Math.max(selection.start, selection.end),
    }
  }, [selection])

  // ── Playback ──────────────────────────────────────────────────────────────
  const stopPlayback = useCallback(() => {
    if (cancelPlayRef.current) { cancelPlayRef.current(); cancelPlayRef.current = null }
    isPlayingRef.current = false
    setIsPlaying(false)
    setPlayingPos(null)
  }, [])

  const startPlayback = useCallback(() => {
    if (isPlayingRef.current) return
    const t = tabRef2.current
    const cur = cursorRef.current
    const startSection = cur.section
    const startCol = cur.col

    // Play only the current section
    const section = t.sections[startSection]
    const playbackTab = { ...t, columns: section.columns }

    isPlayingRef.current = true
    playStartRef.current = { section: startSection, col: startCol }
    setIsPlaying(true)
    resumeAudio()

    cancelPlayRef.current = playTab(playbackTab, startCol, null, (col) => {
      if (col === null) {
        isPlayingRef.current = false
        setIsPlaying(false)
        setPlayingPos(null)
        cursorRef.current = { ...cursorRef.current, col: 0 }
      } else {
        setPlayingPos({ section: startSection, col })
      }
    })
  }, [])

  const togglePlayback = useCallback(() => {
    if (isPlayingRef.current) stopPlayback(); else startPlayback()
  }, [startPlayback, stopPlayback])

  useEffect(() => {
    if (visibleTab?.id) stopPlayback()
  }, [visibleTab?.id]) // eslint-disable-line

  // ── Import ────────────────────────────────────────────────────────────────
  const handleImport = useCallback((parsedTab) => {
    importTab(parsedTab)
    openSidebar()
  }, [importTab])

  const handleImportInto = useCallback((parsedTab) => {
    appendSections(parsedTab.sections)
  }, [appendSections])

  // ── Delete section with confirm ───────────────────────────────────────────
  const handleDeleteSection = useCallback((index) => {
    const section = tab?.sections?.[index]
    if (!section) return
    const isEmpty = section.columns.every(col => col.every(v => v === null))
    if (isEmpty || confirm(`Delete "${section.title || `Section ${index + 1}`}"?`)) {
      deleteSection(index)
    }
  }, [tab?.sections, deleteSection])

  // ── Cut ───────────────────────────────────────────────────────────────────
  const cutColumns = useCallback(() => {
    const range = getSelectionRange()
    const si = range ? range.section : cursor.section
    const lo = range ? range.lo : cursor.col
    const hi = range ? range.hi : cursor.col
    clipboardRef.current = tab?.sections?.[si]?.columns?.slice(lo, hi + 1) || []
    for (let ci = hi; ci >= lo; ci--) deleteColumn(si, ci)
    setSelection(null)
    setCursor(prev => ({ ...prev, section: si, col: Math.max(0, lo) }))
  }, [getSelectionRange, cursor, tab?.sections, deleteColumn, setCursor])

  // ── Keyboard handler ──────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return
    if (!tab) return
    const { key, ctrlKey, metaKey, shiftKey } = e

    if (ctrlKey || metaKey) {
      switch (key) {
        case 'a': {
          e.preventDefault()
          const sec = tab.sections[cursor.section]
          if (sec) setSelection({ section: cursor.section, start: 0, end: sec.columns.length - 1 })
          break
        }
        case 's': e.preventDefault(); break
        case 'z': e.preventDefault(); undo(); break
        case 'c': {
          e.preventDefault()
          const range = getSelectionRange()
          const si = range ? range.section : cursor.section
          const lo = range ? range.lo : cursor.col
          const hi = range ? range.hi : cursor.col
          clipboardRef.current = tab.sections[si]?.columns.slice(lo, hi + 1)
          break
        }
        case 'x': e.preventDefault(); cutColumns(); break
        case 'v': {
          e.preventDefault()
          if (clipboardRef.current) {
            pasteColumns(cursor.section, clipboardRef.current, cursor.col)
            setSelection({ section: cursor.section, start: cursor.col, end: cursor.col + clipboardRef.current.length - 1 })
          }
          break
        }
      }
      return
    }

    switch (key) {
      case 'ArrowLeft':  e.preventDefault(); clearSelection(); moveCursor(-1, 0); break
      case 'ArrowRight': e.preventDefault(); clearSelection(); moveCursor(1, 0);  break
      case 'ArrowUp':    e.preventDefault(); moveCursor(0, -1); break
      case 'ArrowDown':  e.preventDefault(); moveCursor(0, 1);  break

      case 'Delete':
      case 'Backspace': {
        e.preventDefault()
        const range = getSelectionRange()
        if (range) {
          clearRange(range.section, range.lo, range.hi)
          if (key === 'Backspace') setSelection(null)
        } else {
          clearNote()
          if (key === 'Backspace') moveCursor(-1, 0)
        }
        break
      }

      case 'Insert':
      case '+':
        e.preventDefault()
        clearSelection()
        insertColumnAfter(cursor.section, cursor.col)
        moveCursor(1, 0)
        break

      case '-':
        e.preventDefault()
        clearSelection()
        deleteColumn(cursor.section, cursor.col)
        break

      case '|':
        e.preventDefault()
        toggleBar(cursor.section, cursor.col)
        break

      case 'm': case 'M':
        e.preventDefault(); insertMeasureBreak(); break

      case ' ':
        e.preventDefault(); togglePlayback(); break

      case 'Tab':
        e.preventDefault(); clearSelection(); moveCursor(shiftKey ? -1 : 1, 0); break

      case '(':
        e.preventDefault()
        toggleGhost(cursor.section, cursor.col, cursor.string)
        break

      case 'Escape':
        clearSelection(); break

      default:
        if (/^[0-9]$/.test(key) || /^[a-oA-O]$/.test(key)) {
          e.preventDefault()
          clearSelection()
          const char = key.toLowerCase()
          handleChar(char)
          const fret = charToFret(char)
          if (fret !== null) { resumeAudio(); playNote(cursor.string, fret) }
        }
    }
  }, [cursor, selection, moveCursor, undo, clearNote, clearRange,
      insertColumnAfter, deleteColumn, insertMeasureBreak,
      toggleBar, handleChar, togglePlayback,
      getSelectionRange, clearSelection, cutColumns, pasteColumns, toggleGhost, tab?.sections])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // ── Cell click ────────────────────────────────────────────────────────────
  const handleCellClick = useCallback((sectionIdx, col, str, shiftKey) => {
    if (shiftKey) {
      if (selection && selection.section === sectionIdx) {
        setSelection(prev => ({ ...prev, end: col }))
      } else {
        setSelection({ section: sectionIdx, start: cursor.col, end: col })
      }
    } else {
      setSelection(null)
      setCursor({ section: sectionIdx, col, string: str })
      resumeAudio()
      const fret = tab?.sections?.[sectionIdx]?.columns?.[col]?.[str]
      if (fret != null) playNote(str, fret)
    }
    gridRef.current?.focus()
  }, [cursor, selection, tab?.sections, setCursor])

  // ── Drag selection ────────────────────────────────────────────────────────
  const handleColMouseDown = useCallback((sectionIdx, col) => {
    isDraggingRef.current = true
    setSelection({ section: sectionIdx, start: col, end: col })
    setCursor(prev => ({ ...prev, section: sectionIdx }))
  }, [setCursor])

  const handleColMouseEnter = useCallback((sectionIdx, col) => {
    if (isDraggingRef.current) {
      setSelection(prev => prev && prev.section === sectionIdx ? { ...prev, end: col } : prev)
    }
  }, [])

  const handleMouseUp = useCallback(() => { isDraggingRef.current = false }, [])

  // ── Progress bar ──────────────────────────────────────────────────────────
  const totalCols = tab?.sections ? tab.sections.reduce((s, sec) => s + sec.columns.length, 0) : 0
  const playedCols = playingPos && tab?.sections
    ? tab.sections.slice(0, playingPos.section).reduce((s, sec) => s + sec.columns.length, 0) + playingPos.col
    : 0
  const progressPct = isPlaying && totalCols > 0 ? Math.min(100, (playedCols / totalCols) * 100) : 0

  const selectionLabel = (() => {
    const range = getSelectionRange()
    if (!range) return null
    const count = range.hi - range.lo + 1
    return `${count} col${count !== 1 ? 's' : ''} selected`
  })()

  const curFret = tab?.sections?.[cursor.section]?.columns?.[cursor.col]?.[cursor.string]

  return (
    <div className="app">
      <Toolbar
        tab={visibleTab || { title: '', tuning: STANDARD_TUNING, tempo: 120, sections: [] }}
        isDark={isDark}
        onToggleTheme={() => setIsDark(d => !d)}
        isPlaying={isPlaying}
        onTogglePlay={togglePlayback}
        onNew={() => { newTab('Untitled Tab'); openSidebar() }}
        onExportAscii={() => setShowExport(true)}
        onImportAscii={() => setShowImport(true)}
        onInsertCol={() => { insertColumnAfter(cursor.section, cursor.col); moveCursor(1, 0) }}
        onDeleteCol={() => deleteColumn(cursor.section, cursor.col)}
        onInsertMeasure={insertMeasureBreak}
        onToggleBar={() => toggleBar(cursor.section, cursor.col)}
        onUpdateTitle={updateTitle}
        onUpdateTempo={updateTempo}
        onToggleSidebar={() => setSidebarOpen(o => {
          const next = !o
          localStorage.setItem('tabmarto_sidebar', next ? 'open' : 'closed')
          return next
        })}
        driveConnected={driveConnected}
        onDriveConnect={async () => {
          try {
            await fetchEmail()
            await switchToDrive({ listDriveTabs, loadFromDrive, saveToDrive, deleteFromDrive })
            setDriveConnected(true)
            setStorageMode('drive')
            setDriveInitError(false)
          } catch {}
        }}
        onDriveDisconnect={() => {
          disconnect()
          switchToLocal().finally(() => {
            setDriveConnected(false)
            setDriveEmail(null)
            setStorageMode('local')
            setDriveInitError(false)
          })
        }}
      />

      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${progressPct}%`, opacity: isPlaying ? 1 : 0 }} />
      </div>

      <div className="app-body">
        {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
        <Sidebar
          savedTabs={savedTabs}
          currentTabId={visibleTab?.id}
          onLoad={loadTabById}
          onDelete={deleteTabById}
          onNew={() => { newTab('Untitled Tab'); openSidebar() }}
          tab={visibleTab}
          onUpdateTuning={updateTuning}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          driveConnected={driveConnected}
          driveEmail={driveEmail}
          driveSaving={driveSaving}
          driveLastSaved={driveLastSaved}
          driveInitializing={driveInitializing}
          storageMode={storageMode}
          driveInitError={driveInitError}
          tabsLoaded={tabsLoaded}
          loadingTabId={loadingTabId}
          onScrollToSection={(index) => {
            setCursor({ section: index, col: 0, string: 0 })
            document.querySelector(`[data-section-index="${index}"]`)
              ?.scrollIntoView({ block: 'start', behavior: 'smooth' })
          }}
        />

        <main className="app-main">
          {visibleTab ? (
            <>
              <div className="status-bar">
                <span>String: <strong>{visibleTab.tuning[cursor.string]}</strong></span>
                <span>Col: <strong>{cursor.col + 1}</strong></span>
                <span>Fret: <strong>{curFret ?? '—'}</strong></span>
                {selectionLabel && <span className="status-selection">{selectionLabel}</span>}
                {isPlaying && <span className="status-playing">▶ {playingPos ? `§${playingPos.section + 1} col ${playingPos.col + 1}` : ''}</span>}
              </div>

              <div className="sections-scroll">
                <div className="sections-list">
                  {visibleTab.sections.map((section, si) => (
                    <SectionView
                      key={section.id}
                      ref={si === cursor.section ? gridRef : null}
                      section={section}
                      sectionIndex={si}
                      isOnly={visibleTab.sections.length === 1}
                      tab={visibleTab}
                      cursor={cursor}
                      playingPos={playingPos}
                      selection={selection}
                      onCellClick={handleCellClick}
                      onColMouseDown={handleColMouseDown}
                      onColMouseEnter={handleColMouseEnter}
                      onMouseUp={handleMouseUp}
                      onAddSection={() => addSection(si)}
                      onDeleteSection={() => handleDeleteSection(si)}
                      onUpdateTitle={(title) => updateSectionTitle(si, title)}
                      onTogglePageBreak={() => toggleSectionPageBreak(si)}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="status-bar">
              <span>String: <strong>—</strong></span>
              <span>Col: <strong>—</strong></span>
              <span>Fret: <strong>—</strong></span>
            </div>
          )}
        </main>
      </div>

      {visibleTab && showExport && <ExportModal ascii={toAscii(visibleTab)} title={visibleTab.title} tab={visibleTab} onClose={() => setShowExport(false)} />}
      {showImport && (
        <ImportModal
          onImport={handleImport}
          onImportInto={handleImportInto}
          onClose={() => setShowImport(false)}
          canImportInto={!!visibleTab}
        />
      )}
    </div>
  )
}
