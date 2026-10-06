import { describe, it, expect } from 'vitest'
import { transposeSection, openPitches } from './transpose.js'

const STD = ['E', 'B', 'G', 'D', 'A', 'E']
const sec = (columns) => ({ columns, bars: [], ghosts: [] })
const empty = () => Array(6).fill(null)

describe('transpose', () => {
  it('computes open pitches', () => {
    expect(openPitches(STD)).toEqual([64, 59, 55, 50, 45, 40])
    expect(openPitches(['D', 'A', 'F#', 'D', 'A', 'D'])).toEqual([62, 57, 54, 50, 45, 38])
  })
  it('small shifts stay on the same string', () => {
    const c = empty(); c[2] = 5
    expect(transposeSection(sec([c]), STD, 1).section.columns[0]).toEqual([null, null, 6, null, null, null])
  })
  it('large shifts change strings instead of running up the neck', () => {
    const c = empty(); c[2] = 5
    const out = transposeSection(sec([c]), STD, 5).section.columns[0]
    expect(out[1]).toBe(6) // C+5 = F: B string fret 6 beats G string fret 10
  })
  it('keeps pitch and avoids string collisions in chords', () => {
    const c = empty(); c[4] = 3; c[3] = 2; c[2] = 0
    const out = transposeSection(sec([c]), STD, 7).section.columns[0]
    const open = openPitches(STD)
    const pitches = out.map((f, s) => f === null ? null : open[s] + f).filter(p => p !== null).sort()
    expect(pitches).toEqual([55 + 7, 52 + 7, 48 + 7].sort((a, b) => a - b))
  })
  it('keeps a whole section in the same fret window (+12 stays within 0-5)', () => {
    // [string, fret] notes from a 0-4 position, one per column
    const notes = [[4,0],[4,0],[4,4],[2,2],[3,2],[2,2],[2,2],[2,1],[3,4],[3,2],[4,4],[4,2],[3,0],[3,0],[4,4],[4,2],[4,0]]
    const cols = notes.map(([s, f]) => { const c = empty(); c[s] = f; return c })
    const out = transposeSection(sec(cols), STD, 12).section.columns.flat().filter(f => f !== null)
    expect(Math.min(...out)).toBe(0)
    expect(Math.max(...out)).toBeLessThanOrEqual(5)
  })
  it('drops out-of-range notes and counts them', () => {
    const c = empty(); c[0] = 24
    const r = transposeSection(sec([c]), STD, 5)
    expect(r.dropped).toBe(1)
  })
  it('moves ghost flags with their notes', () => {
    const c = empty(); c[2] = 5
    const r = transposeSection({ ...sec([c]), ghosts: ['0,2'] }, STD, 5)
    expect(r.section.ghosts).toEqual(['0,1'])
  })
  it('keeps a whole section in a compact fret window', () => {
    const mk = (s, f) => { const c = empty(); c[s] = f; return c }
    const cols = [mk(4, 0), mk(4, 4), mk(3, 4), mk(3, 2), mk(3, 0), mk(2, 2), mk(2, 1)]
    const out = transposeSection(sec(cols), STD, 12).section.columns
    const frets = out.flat().filter(f => f !== null)
    expect(Math.max(...frets) - Math.min(...frets)).toBeLessThanOrEqual(5)
  })
  it('position slides the same notes along the neck', () => {
    const c = empty(); c[0] = 5; c[1] = 5
    const open = openPitches(STD)
    const pitches = (cols) => cols[0].map((f, s) => f === null ? null : open[s] + f).filter(p => p !== null).sort()
    const base = sec([c])
    const r = transposeSection(base, STD, 0, 5).section.columns
    expect(pitches(r)).toEqual(pitches(base.columns))
    expect(r[0]).not.toEqual(c)
  })
})
