import { useState, useEffect } from 'react'
import './Sidebar.css'

const TUNING_PRESETS = [
  { label: 'Standard (EADGBe)',  tuning: ['E', 'B', 'G', 'D', 'A', 'E'] },
  { label: 'Drop D (DADGBe)',    tuning: ['E', 'B', 'G', 'D', 'A', 'D'] },
  { label: 'Open G (DGDGBd)',    tuning: ['D', 'B', 'G', 'D', 'G', 'D'] },
  { label: 'Open D (DADf#Ad)',   tuning: ['D', 'A', 'F#','D', 'A', 'D'] },
  { label: 'Open E (EBEg#BE)',   tuning: ['E', 'B', 'G#','E', 'B', 'E'] },
  { label: 'Open A (EAEAc#E)',   tuning: ['E', 'C#','A', 'E', 'A', 'E'] },
  { label: 'DADGAD',             tuning: ['D', 'A', 'G', 'D', 'A', 'D'] },
  { label: 'Half step down',     tuning: ['D#','A#','F#','C#','G#','D#'] },
  { label: 'Full step down',     tuning: ['D', 'A', 'F', 'C', 'G', 'D'] },
]

const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']

export default function Sidebar({
  savedTabs,
  currentTabId,
  onLoad,
  onDelete,
  onNew,
  tab,
  onUpdateTuning,
  isOpen,
  onClose,
  onScrollToSection,
  driveConnected,
  driveEmail,
  driveSaving,
  driveLastSaved,
  driveInitializing,
  storageMode,
  driveInitError,
  tabsLoaded,
  loadingTabId,
}) {
  const [driveStatus, setDriveStatus] = useState(null)
  const [unsavedTabs, setUnsavedTabs] = useState([])
  const [sectionsExpanded, setSectionsExpanded] = useState(true)

  const driveTabList = [
    ...unsavedTabs.filter(unsaved => !savedTabs.some(saved => saved.id === unsaved.id)),
    ...savedTabs,
  ]

  useEffect(() => {
    setDriveStatus(null)
  }, [driveConnected])

  // Keep newly created Drive tabs visible until the backend list contains them.
  useEffect(() => {
    if (!tab) return
    setUnsavedTabs(prev => {
      const alreadySaved = savedTabs.some(saved => saved.id === tab.id)
      const filtered = prev.filter(t => t.id !== tab.id)
      const isUnsaved = storageMode === 'drive' ? !tab.driveId : false
      if (isUnsaved && !alreadySaved) {
        return [{ id: tab.id, title: tab.title || 'Untitled', driveId: undefined }, ...filtered]
      }
      if (storageMode === 'drive' && !alreadySaved) {
        const existing = prev.find(t => t.id === tab.id)
        if (existing) {
          return [{ ...existing, title: tab.title || 'Untitled', driveId: tab.driveId }, ...filtered]
        }
      }
      return filtered
    })
  }, [tab?.id, tab?.title, tab?.driveId, savedTabs, storageMode])

  async function handleDriveOpen(fileId) {
    try {
      setDriveStatus('Loading…')
      const found = savedTabs.find(t => t.driveId === fileId || t.id === fileId)
      if (found && found._needsLoad) {
        setSectionsExpanded(true)
        await onLoad(fileId)
      } else if (found) {
        setSectionsExpanded(true)
        await onLoad(fileId)
      }
      setDriveStatus(null)
    } catch (e) {
      console.error('[Sidebar.handleDriveOpen] Error:', e)
      setDriveStatus('Load failed')
    }
  }

  async function handleLocalLoad(tabId) {
    setSectionsExpanded(true)
    await onLoad(tabId)
  }

  async function handleDriveDelete(fileId) {
    if (!confirm('Remove this file from Google Drive?')) return
    try {
      await onDelete(fileId)
      setDriveStatus('Deleted')
      setTimeout(() => setDriveStatus(null), 2000)
    } catch {
      setDriveStatus('Delete failed')
    }
  }

  async function handleUnsavedClose(tabId) {
    setUnsavedTabs(prev => prev.filter(t => t.id !== tabId))
    await onDelete(tabId)
  }

  function handlePreset(e) {
    const idx = parseInt(e.target.value, 10)
    if (isNaN(idx)) return
    onUpdateTuning([...TUNING_PRESETS[idx].tuning])
    e.target.value = ''
  }

  function handleStringNote(i, note) {
    if (!tab) return
    const tuning = [...tab.tuning]
    tuning[i] = note
    onUpdateTuning(tuning)
  }

  return (
    <aside className={`sidebar${isOpen ? ' sidebar--open' : ''}`}>
      {/* Tuning */}
      <section className="sidebar-section">
        <div className="sidebar-heading-row">
          <h3 className="sidebar-heading">Tuning</h3>
          <select className="preset-select" defaultValue="" onChange={handlePreset}>
            <option value="" disabled>Presets…</option>
            {TUNING_PRESETS.map((p, i) => (
              <option key={i} value={i}>{p.label}</option>
            ))}
          </select>
        </div>
        <div className="tuning-grid">
          {(tab?.tuning || ['E', 'B', 'G', 'D', 'A', 'E']).map((note, i) => (
            <div key={i} className="tuning-row">
              <span className="tuning-label">String {i + 1}</span>
              <select
                className="tuning-select"
                value={note}
                onChange={e => handleStringNote(i, e.target.value)}
                disabled={!tab}
              >
                {NOTES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          ))}
        </div>
      </section>

      {/* Tabs — local or Drive */}
      <section className="sidebar-section sidebar-section--flex">
        <div className="sidebar-heading-row">
          <h3 className="sidebar-heading">Your Tabs</h3>
          <div className="drive-status-inline">
            {driveSaving && <span className="drive-status drive-status--saving">Saving…</span>}
            {!tabsLoaded && <span className="drive-status drive-status--saving">Loading…</span>}
            {driveStatus && <span className="drive-status">{driveStatus}</span>}
          </div>
          {driveConnected && driveEmail && <span className="drive-email">{driveEmail}</span>}
        </div>

        {/* Drive mode: show empty or tabs */}
        {storageMode === 'drive' || driveInitializing ? (
          <>
            {!tabsLoaded ? (
              <ul className="tabs-list" />
            ) : driveTabList.length === 0 ? (
              <ul className="tabs-list">
                <li className="sidebar-empty">No tabs in Drive</li>
                <li className="tabs-list-item tabs-list-item--new">
                  <button className="tabs-list-name tabs-list-name--new" onClick={onNew}>+ new tab</button>
                </li>
              </ul>
            ) : (
              <ul className="tabs-list">
                {driveTabList.map(f => {
                  const isUnsaved = !f.driveId
                  const isActive = !!tab && f.id === tab.id
                  return (
                    <li key={f.id} className={`tabs-list-item${isActive ? ' tabs-list-item--active' : ''}`}>
                      <div className="tabs-list-row">
                        <button className="tabs-list-name" onClick={() => {
                          if (isUnsaved) {
                            if (!isActive) onLoad(f.id)
                          } else if (!isActive) {
                            handleDriveOpen(f.id)
                          }
                          else setSectionsExpanded(v => !v)
                        }} title={f.title || f.name}>
                          {(f.title || f.name || 'Untitled').replace(/\.json$/, '')}
                          {isUnsaved && <span className="unsaved-badge">*</span>}
                        </button>
                        <button
                          className="tabs-list-delete"
                          onClick={() => isUnsaved ? handleUnsavedClose(f.id) : handleDriveDelete(f.id)}
                          title={isUnsaved ? 'Close' : 'Remove from Drive'}
                        >×</button>
                      </div>
                      {tab && isActive && (() => {
                        const namedSections = tab.sections.map((s, i) => ({ title: s.title, index: i })).filter(s => s.title)
                        const hasBreakBefore = (j) => {
                          if (j === 0) return false
                          const from = namedSections[j - 1].index
                          const to = namedSections[j].index
                          return tab.sections.slice(from, to).some(s => s.pageBreak)
                        }
                        return namedSections.length > 0 && sectionsExpanded && (
                          <ul className="section-index">
                            {namedSections.map((s, j) => (
                              <li key={s.index} className={hasBreakBefore(j) ? 'section-index-break' : ''}>
                                <button className="section-index-btn" onClick={() => onScrollToSection(s.index)}>
                                  {s.title}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )
                      })()}
                    </li>
                  )
                })}
                <li className="tabs-list-item tabs-list-item--new">
                  <button className="tabs-list-name tabs-list-name--new" onClick={onNew}>+ new tab</button>
                </li>
              </ul>
            )}
          </>
        ) : storageMode === 'local' ? (
          <>
            <ul className="tabs-list">
              {/* Unsaved current tab */}
              {tab && !savedTabs.find(t => t.id === tab.id) && (
                <li className="tabs-list-item tabs-list-item--active">
                  <div className="tabs-list-row">
                    <button className="tabs-list-name" title={tab.title}>
                      {tab.title || 'Untitled'} <span className="unsaved-badge">*</span>
                    </button>
                    <button
                      className="tabs-list-delete"
                      onClick={() => {
                        const isEmpty = tab.sections?.every(s => s.columns?.every(col => col.every(v => v === null)))
                        if (isEmpty || confirm(`Delete "${tab.title || 'Untitled'}"?`)) onDelete(tab.id)
                      }}
                      title="Delete"
                    >×</button>
                  </div>
                </li>
              )}
              {/* Saved tabs */}
              {savedTabs.map(t => {
                const isActive = t.id === currentTabId
                const namedSections = isActive
                  ? tab.sections.map((s, i) => ({ title: s.title, index: i })).filter(s => s.title)
                  : []
                const hasBreakBefore = (j) => {
                  if (j === 0) return false
                  const from = namedSections[j - 1].index
                  const to = namedSections[j].index
                  return tab.sections.slice(from, to).some(s => s.pageBreak)
                }
                return (
                  <li key={t.id} className={`tabs-list-item${isActive ? ' tabs-list-item--active' : ''}`}>
                    <div className="tabs-list-row">
                      <button className="tabs-list-name" onClick={() => {
                        if (!isActive) handleLocalLoad(t.id)
                        else setSectionsExpanded(v => !v)
                      }} title={t.title}>
                        {t.title || 'Untitled'}
                      </button>
                      <button
                        className="tabs-list-delete"
                        onClick={() => {
                          const isEmpty = t.sections?.every(s => s.columns?.every(col => col.every(v => v === null)))
                          if (isEmpty || confirm(`Delete "${t.title || 'Untitled'}"?`)) onDelete(t.id)
                        }}
                        title="Delete"
                      >×</button>
                    </div>
                    {namedSections.length > 0 && sectionsExpanded && (
                      <ul className="section-index">
                        {namedSections.map((s, j) => (
                          <li key={s.index} className={hasBreakBefore(j) ? 'section-index-break' : ''}>
                            <button className="section-index-btn" onClick={() => onScrollToSection(s.index)}>
                              {s.title}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
              <li className="tabs-list-item tabs-list-item--new">
                <button className="tabs-list-name tabs-list-name--new" onClick={onNew}>+ new tab</button>
              </li>
            </ul>
            {driveInitError && (
              <div className="drive-status">Drive unavailable</div>
            )}
          </>
        ) : (
          <>
            <ul className="tabs-list">
              <li className="sidebar-empty">Loading...</li>
            </ul>
          </>
        )}
      </section>

      {/* Shortcuts */}
      <section className="sidebar-section">
        <h3 className="sidebar-heading">Shortcuts</h3>
        <div className="shortcuts-scroll">
          <table className="shortcuts-table">
            <tbody>
              {[
                ['0–9', 'Frets 0–9'],
                ['a–o', 'Frets 10–24'],
                ['(', 'Toggle ghost note'],
                ['←→↑↓', 'Navigate'],
                ['+  /  -', 'Add / remove col'],
                ['Del', 'Clear note/selection'],
                ['|', 'Toggle bar line'],
                ['Space', 'Play / Stop'],
                ['Ctrl+Z', 'Undo'],
                ['Ctrl+A', 'Select all'],
                ['Ctrl+C', 'Copy'],
                ['Ctrl+X', 'Cut'],
                ['Ctrl+V', 'Paste'],
                ['Ctrl+S', 'Save'],
              ].map(([key, desc]) => (
                <tr key={key}>
                  <td className="shortcut-key">{key}</td>
                  <td className="shortcut-desc">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="legal-links">
            <a href="/privacy/" className="legal-link">Privacy Policy</a>
            <a href="/terms/" className="legal-link">Terms of Service</a>
          </div>
        </div>
        <div className="build-number">build {__BUILD_NUMBER__}</div>
      </section>
    </aside>
  )
}
