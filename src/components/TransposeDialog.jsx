import './TransposeDialog.css'

const LIMIT = 24
const POS_LIMIT = 12

export default function TransposeDialog({ semitones, position, dropped, sectionLabel, onChange, onPosition, onAccept, onCancel }) {
  const clamp = (n) => Math.max(-LIMIT, Math.min(LIMIT, n))
  const posLabel = position > 0 ? `+${position}` : String(position)
  const label = semitones > 0 ? `+${semitones}` : String(semitones)

  return (
    <div className="transpose-dialog" role="dialog" aria-label="Transpose section">
      <div className="transpose-title">Transpose “{sectionLabel}”</div>
      <div className="transpose-stepper">
        <button className="btn" onClick={() => onChange(clamp(semitones - 1))} aria-label="Down one semitone">−</button>
        <span className="transpose-value">{label}</span>
        <button className="btn" onClick={() => onChange(clamp(semitones + 1))} aria-label="Up one semitone">+</button>
      </div>
      <div className="transpose-hint">semitones · ↑/↓ ±1 · Shift ±12</div>
      <div className="transpose-stepper transpose-stepper--small">
        <button className="btn" onClick={() => onPosition(Math.max(-POS_LIMIT, position - 1))} aria-label="Slide towards the nut">◀</button>
        <span className="transpose-value transpose-value--small">{posLabel}</span>
        <button className="btn" onClick={() => onPosition(Math.min(POS_LIMIT, position + 1))} aria-label="Slide towards the body">▶</button>
      </div>
      <div className="transpose-hint">fret position (same notes) · ←/→ · Space plays</div>
      {dropped > 0 && <div className="transpose-warning">{dropped} note{dropped !== 1 ? 's' : ''} out of range will be removed</div>}
      <div className="transpose-actions">
        <button className="btn" onClick={onCancel}>Cancel (Esc)</button>
        <button className="btn btn--primary" onClick={onAccept} disabled={semitones === 0 && position === 0}>Accept (Enter)</button>
      </div>
    </div>
  )
}
