import { useState } from 'react'
import { parseAsciiTab } from '../utils/importAscii.js'
import { importTab } from '../utils/tabFormat.js'
import './ExportModal.css'
import './ImportModal.css'

export default function ImportModal({ onImport, onImportInto, onClose, canImportInto = true }) {
  const [text, setText] = useState('')
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(false)

  function parse() {
    const trimmed = text.trim()
    // Try native .tab format first
    const native = importTab(trimmed)
    if (native) return native
    // Fall back to ASCII
    const result = parseAsciiTab(trimmed)
    if (!result) {
      setError('Could not parse tab. Drop a .tab file or paste a valid ASCII tab.')
      return null
    }
    return result
  }

  function handleImportNew() {
    const result = parse()
    if (!result) return
    onImport(result)
    onClose()
  }

  function handleImportInto() {
    const result = parse()
    if (!result) return
    onImportInto(result)
    onClose()
  }

  function handlePaste() {
    navigator.clipboard.readText().then(t => {
      setText(t)
      setError(null)
    }).catch(() => {
      setError('Clipboard access denied. Please paste manually.')
    })
  }

  function handleDragOver(e) {
    e.preventDefault()
    setDragging(true)
  }

  function handleDragLeave() {
    setDragging(false)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => { setText(ev.target.result); setError(null) }
    reader.readAsText(file)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>Import Tab</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <textarea
          className={`modal-textarea${dragging ? ' modal-textarea--drag' : ''}`}
          value={text}
          onChange={e => { setText(e.target.value); setError(null) }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          placeholder={`Drop a .json file, or paste ASCII tab here, e.g.:\n\nSong Title\n\ne|--0--3--5--|\nB|--0--3--5--|\nG|--0--3--5--|\nD|--0--3--5--|\nA|--0--3--5--|\nE|--0--3--5--|`}
          spellCheck={false}
          autoFocus
        />
        {error && <div className="import-error">{error}</div>}
        <div className="modal-actions">
          <button className="btn btn--primary" onClick={handleImportNew}>Import as New Tab</button>
          {canImportInto && (
            <button className="btn btn--primary" onClick={handleImportInto}>Import into Current Tab</button>
          )}
          <button className="btn" onClick={handlePaste}>Paste from Clipboard</button>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
