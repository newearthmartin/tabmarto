// Transpose a section by N semitones, re-fingering notes so they stay in the
// same area of the neck (changing strings when that keeps the fret closer).

const NOTE_PCS = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 }
const STANDARD_PITCHES = [64, 59, 55, 50, 45, 40] // high E … low E (MIDI)
const STANDARD_PCS = STANDARD_PITCHES.map(p => p % 12)
const MAX_FRET = 24
const STRING_CHANGE_COST = 0.5
const FRET_DRIFT_COST = 0.05 // tie-breaker: stay near the original fret
const OPEN_STRING_BONUS = 1

// Absolute open-string pitches for a tuning (closest octave to standard tuning).
export function openPitches(tuning) {
  return tuning.map((note, i) => {
    const base = STANDARD_PITCHES[i] ?? STANDARD_PITCHES[STANDARD_PITCHES.length - 1]
    const basePc = STANDARD_PCS[i] ?? STANDARD_PCS[STANDARD_PCS.length - 1]
    const pc = NOTE_PCS[note.toUpperCase()]
    if (pc === undefined) return base
    return base + ((pc - basePc + 18) % 12) - 6
  })
}

function windowDistance(fret, [lo, hi]) {
  return fret < lo ? lo - fret : fret > hi ? fret - hi : 0
}

// The fret range the section already lives in (widened by one fret). Every note
// is re-fingered towards this range, keeping the whole section in one hand
// position instead of drifting per note.
function fretWindow(columns, position = 0) {
  let lo = Infinity, hi = -Infinity
  for (const column of columns) for (const f of column) {
    if (f === null || f === undefined) continue
    lo = Math.min(lo, f); hi = Math.max(hi, f)
  }
  if (lo === Infinity) return [0, 0]
  // `position` slides the window along the neck (same notes, different frets)
  return [Math.max(0, lo + position), Math.min(MAX_FRET, hi + 1 + position)]
}

// Best assignment of a column's notes to distinct strings (minimum total cost).
function assignColumn(notes, open, semitones, window, openBonus) {
  // notes: [{ string, fret }]
  const options = notes.map(({ string, fret }) => {
    const target = open[string] + fret + semitones
    const list = []
    open.forEach((p, s) => {
      const f = target - p
      if (f >= 0 && f <= MAX_FRET) list.push({
        string: s, fret: f,
        cost: windowDistance(f, window) + FRET_DRIFT_COST * Math.abs(f - fret)
          + STRING_CHANGE_COST * Math.abs(s - string) - (f === 0 ? openBonus : 0),
      })
    })
    list.sort((a, b) => a.cost - b.cost)
    return list
  })

  let best = null
  const chosen = new Array(notes.length).fill(null)
  const used = new Set()

  function search(i, cost, dropped) {
    // Dropped (unplayable) notes outweigh any fingering cost.
    const total = cost + dropped * 1000
    if (best && total >= best.total) return
    if (i === notes.length) { best = { total, chosen: [...chosen], dropped }; return }
    for (const opt of options[i]) {
      if (used.has(opt.string)) continue
      used.add(opt.string); chosen[i] = opt
      search(i + 1, cost + opt.cost, dropped)
      used.delete(opt.string); chosen[i] = null
    }
    search(i + 1, cost, dropped + 1) // note can't be placed
  }
  search(0, 0, 0)
  return best
}

// position: frets to slide the fret window (+ towards the body), keeping pitch.
// Returns { section, dropped } — dropped = notes that can't be played on the neck.
export function transposeSection(section, tuning, semitones, position = 0) {
  if (!semitones && !position) return { section, dropped: 0 }
  const open = openPitches(tuning)
  const numStrings = tuning.length
  const window = fretWindow(section.columns, position)
  const openBonus = position > 0 ? 0 : OPEN_STRING_BONUS
  const ghosts = new Set(section.ghosts ?? [])
  const newGhosts = []
  let dropped = 0

  const columns = section.columns.map((column, ci) => {
    const notes = []
    column.forEach((fret, string) => { if (fret !== null && fret !== undefined) notes.push({ string, fret }) })
    const next = Array(numStrings).fill(null)
    if (!notes.length) return next
    const result = assignColumn(notes, open, semitones, window, openBonus)
    result.chosen.forEach((opt, i) => {
      if (!opt) { dropped++; return }
      next[opt.string] = opt.fret
      if (ghosts.has(`${ci},${notes[i].string}`)) newGhosts.push(`${ci},${opt.string}`)
    })
    return next
  })

  return { section: { ...section, columns, ghosts: newGhosts }, dropped }
}
