import './Toolbar.css'

export default function Toolbar({
  tab, isDark, onToggleTheme,
  isPlaying, onTogglePlay,
  onNew, onExportAscii, onImportAscii,
  onInsertCol, onDeleteCol, onInsertMeasure, onToggleBar,
  onUpdateTitle, onUpdateTempo,
  onToggleSidebar,
  driveConnected, onDriveConnect, onDriveDisconnect,
}) {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <button className="toolbar-sidebar-btn" onClick={onToggleSidebar} title="Menu">☰</button>
        <span className="toolbar-logo">🎸</span>
        <input
          className="toolbar-title"
          value={tab?.title || ''}
          onChange={e => onUpdateTitle(e.target.value)}
          placeholder="Tab title..."
          spellCheck={false}
        />
      </div>

      <div className="toolbar-center">
        <div className="toolbar-group">
          <div className="theme-toggle" onClick={onToggleTheme} title="Toggle dark/light mode">
            <span className={`theme-icon${!isDark ? ' theme-icon--active' : ''}`}>☀</span>
            <div className={`theme-track${isDark ? ' theme-track--dark' : ''}`}>
              <div className="theme-thumb" />
            </div>
            <span className={`theme-icon${isDark ? ' theme-icon--active' : ''}`}>☾</span>
          </div>
        </div>

        <div className="toolbar-group">
          <div className="tempo-control">
            <label>BPM</label>
            <input
              type="number"
              className="tempo-input"
              value={tab?.tempo || 120}
              min={40} max={300}
              onChange={e => onUpdateTempo(e.target.value)}
            />
          </div>
        </div>

        <div className="toolbar-group">
          <button
            className={`btn ${isPlaying ? 'btn--stop' : 'btn--play'}`}
            title="Play / Stop (Space)"
            onClick={onTogglePlay}
          >
            {isPlaying ? '■ Stop' : '▶ Play'}
          </button>
        </div>
      </div>

      <div className="toolbar-right">
        <div className="toolbar-group">
          <button className="btn" onClick={onImportAscii}>Import</button>
          <button className="btn" onClick={onExportAscii}>Export</button>
          {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
            driveConnected
              ? <button className="btn btn--drive-on" onClick={onDriveDisconnect} title="Disconnect Google Drive">Google Drive ✓</button>
              : <button className="btn" onClick={onDriveConnect} title="Connect Google Drive">Google Drive</button>
          )}
        </div>
      </div>
    </div>
  )
}
