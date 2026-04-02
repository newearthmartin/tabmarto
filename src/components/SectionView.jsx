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

  const sectionTab = { ...tab, columns: section.columns, bars: section.bars, ghosts: section.ghosts ?? [] }

  return (
    <div className="section-view" data-section-index={sectionIndex}>
      <div className="section-header">
        <input
          className="section-title-input"
          value={section.title}
          placeholder={`Section ${sectionIndex + 1}`}
          onChange={e => onUpdateTitle(e.target.value)}
          spellCheck={false}
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
