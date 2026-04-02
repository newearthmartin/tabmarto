import { useEffect, useRef, useCallback, forwardRef } from 'react'
import './TabGrid.css'

function fretDisplay(fret, isGhost) {
  if (fret === null) return { text: '-', wide: false, ghost: false }
  return { text: String(fret), wide: fret >= 10, ghost: isGhost }
}

const TabGrid = forwardRef(function TabGrid({
  tab,
  cursor,
  playingCol,
  selection,       // { start, end } | null
  onCellClick,     // (col, str, shiftKey) => void
  onColMouseDown,  // (col) => void  — drag-select start
  onColMouseEnter, // (col) => void  — drag-select extend
  onMouseUp,       // () => void     — drag-select end
}, ref) {
  const gridRef = useRef(null)
  const { columns, tuning, bars = [], ghosts = [] } = tab
  const barsSet = new Set(bars)
  const ghostsSet = new Set(ghosts)

  // Auto-scroll cursor into view
  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const cell = el.querySelector(`[data-col="${cursor.col}"][data-str="${cursor.string}"]`)
    if (cell) cell.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [cursor.col, cursor.string])

  const selLo = selection ? Math.min(selection.start, selection.end) : -1
  const selHi = selection ? Math.max(selection.start, selection.end) : -1

  return (
    <div
      className="tab-grid-wrapper"
      ref={(el) => {
        gridRef.current = el
        if (typeof ref === 'function') ref(el)
        else if (ref) ref.current = el
      }}
      tabIndex={0}
      onMouseLeave={onMouseUp}
      onMouseUp={onMouseUp}
    >
      <div className="tab-grid">
        <div className="tab-labels">
          {tuning.map((note, si) => (
            <div key={si} className="tab-label">{note}</div>
          ))}
        </div>

        <div className="tab-bar tab-bar--open" />

        <div className="tab-columns">
          {columns.map((col, ci) => {
            const isPlaying = playingCol === ci
            const inSelection = ci >= selLo && ci <= selHi

            return (
              <div
                key={ci}
                className={[
                  'tab-column-group',
                  isPlaying ? 'tab-column-group--playing' : '',
                  inSelection ? 'tab-column-group--selected' : '',
                ].join(' ')}
                onMouseDown={() => onColMouseDown(ci)}
                onMouseEnter={() => onColMouseEnter(ci)}
              >
                <div className="tab-column">
                  {col.map((fret, si) => {
                    const isActive = cursor.col === ci && cursor.string === si
                    const isGhost = ghostsSet.has(`${ci},${si}`)
                    const { text, wide, ghost } = fretDisplay(fret, isGhost)
                    return (
                      <div
                        key={si}
                        className={[
                          'tab-cell',
                          isActive ? 'tab-cell--selected' : '',
                          isPlaying ? 'tab-cell--playing' : '',
                          fret !== null ? 'tab-cell--note' : '',
                          ghost ? 'tab-cell--ghost' : '',
                        ].join(' ')}
                        data-col={ci}
                        data-str={si}
                        onClick={(e) => onCellClick(ci, si, e.shiftKey)}
                      >
                        <span className={`tab-cell-dash${wide ? ' tab-cell-dash--wide' : ''}${ghost ? ' tab-cell-dash--ghost' : ''}`}>{text}</span>
                      </div>
                    )
                  })}
                </div>
                {barsSet.has(ci) && <div className="tab-bar tab-bar--measure" />}
              </div>
            )
          })}
        </div>

        <div className="tab-bar tab-bar--close" />
      </div>
    </div>
  )
})

export default TabGrid
