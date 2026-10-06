import { forwardRef } from 'react'
import TabGrid from './TabGrid.jsx'
import './SectionView.css'

const SectionView = forwardRef(function SectionView({
  section,
  sectionIndex,
  isOnly,
  tab,          // for tuning
  cursor,       // full cursor { section, col, string }
  playingPos,   // { section, col } | null
  selection,    // { section, start, end } | null
  onCellClick,
  onColMouseDown,
  onColMouseEnter,
  onMouseUp,
  onAddSection,
  onDeleteSection,
  onUpdateTitle,
  onUpdateNote,
  onUpdateCapo,
  canSetCapo,      // only titled sections can set a capo; others continue the one above
  onTogglePageBreak,
}, ref) {
  const isActiveSec = cursor.section === sectionIndex
  const localCursor = isActiveSec
    ? { col: cursor.col, string: cursor.string }
    : { col: -1, string: -1 }

  const playingCol = playingPos?.section === sectionIndex ? playingPos.col : null

  const localSelection = selection?.section === sectionIndex
    ? { start: selection.start, end: selection.end }
    : null

  const sectionTab = { ...tab, columns: section.columns, bars: section.bars, repeats: section.repeats ?? {}, ghosts: section.ghosts ?? [] }

  return (
    <div className="section-view" data-section-index={sectionIndex}>
      <div className="section-header">
        <input
          className="section-title-input"
          value={section.title}
          placeholder={`Section ${sectionIndex + 1}`}
          onChange={e => onUpdateTitle(e.target.value)}
          size={Math.max(10, (section.title || '').length + 1)}
          spellCheck={false}
        />
        {canSetCapo && (
          <label className="section-capo" title="Capo fret (affects playback). Set it on a titled section; untitled sections continue the capo above.">
            Capo
            <input
              type="number" min={0} max={12}
              value={section.capo || ''}
              placeholder="–"
              onChange={e => onUpdateCapo(e.target.value)}
            />
          </label>
        )}
        <textarea
          className="section-note-input"
          value={section.note ?? ''}
          placeholder="Add a note…"
          rows={1}
          onChange={e => onUpdateNote(e.target.value)}
          ref={el => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` } }}
        />
      </div>

      <TabGrid
        ref={isActiveSec ? ref : null}
        tab={sectionTab}
        cursor={localCursor}
        playingCol={playingCol}
        selection={localSelection}
        onCellClick={(col, str, shiftKey) => onCellClick(sectionIndex, col, str, shiftKey)}
        onColMouseDown={(col) => onColMouseDown(sectionIndex, col)}
        onColMouseEnter={(col) => onColMouseEnter(sectionIndex, col)}
        onMouseUp={onMouseUp}
      />

      <div className="section-footer">
        <button className="section-btn section-btn--add" title="Add section below" onClick={onAddSection}>＋</button>
        {!isOnly && (
          <button className="section-btn section-btn--del" title="Delete this section" onClick={onDeleteSection}>－</button>
        )}
        <button
          className={`section-btn section-btn--break${section.pageBreak ? ' section-btn--break-on' : ''}`}
          title={section.pageBreak ? 'Remove page break after this section' : 'Insert page break after this section'}
          onClick={onTogglePageBreak}
        >⏎</button>
      </div>
    </div>
  )
})

export default SectionView
