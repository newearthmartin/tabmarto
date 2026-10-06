// Repeat signs live in section.repeats: { [key]: 'start' | 'end' | 'both' }.
// key = column index (the bar line after that column), or 'open' / 'close'
// for the section's first / last bar line.
//   start = |:   end = :|   both = :|:

export const hasRepeatStart = (type) => type === 'start' || type === 'both'
export const hasRepeatEnd = (type) => type === 'end' || type === 'both'

// Order the `:` key cycles through for a mid-section bar.
const CYCLE = [undefined, 'end', 'start', 'both']
export function nextRepeatType(type) {
  return CYCLE[(CYCLE.indexOf(type) + 1) % CYCLE.length]
}

// Bar text used in ASCII export.
export function barGlyph(type) {
  return (hasRepeatEnd(type) ? ':' : '') + '|' + (hasRepeatStart(type) ? ':' : '')
}

// Re-key column-indexed repeats; fn(col) returns the new column or null to drop it.
export function remapRepeats(repeats = {}, fn) {
  const out = {}
  for (const [key, type] of Object.entries(repeats)) {
    if (key === 'open' || key === 'close') { out[key] = type; continue }
    const next = fn(Number(key))
    if (next !== null) out[next] = type
  }
  return out
}

// A bar after the last column is the section's closing bar: it is drawn there
// (thicker, with any repeat dots) instead of as an extra line before it.
// Adding columns with `+` turns it back into an ordinary mid-section bar.
export function closingBar(section) {
  const last = section.columns.length - 1
  const repeats = section.repeats ?? {}
  const hasBar = (section.bars ?? []).includes(last)
  const type = repeats.close ?? (hasBar ? repeats[last] : undefined)
  return { last, thick: hasBar || !!repeats.close, type: hasRepeatEnd(type) ? 'end' : undefined }
}

// Repeat signs on bars within columns lo..hi, re-keyed relative to lo (for copy/cut).
export function copyRepeats(repeats = {}, lo, hi) {
  const out = {}
  for (const [key, type] of Object.entries(repeats ?? {})) {
    if (key === 'open' || key === 'close') continue
    const col = Number(key)
    if (col >= lo && col <= hi) out[col - lo] = type
  }
  return out
}
