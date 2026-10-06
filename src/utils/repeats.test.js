import { describe, it, expect } from 'vitest'
import { toAscii } from './ascii.js'
import { parseAsciiTab } from './importAscii.js'
import { nextRepeatType, remapRepeats, barGlyph } from './repeats.js'

const cols = (n) => Array.from({ length: n }, (_, i) => ['E', 'B', 'G', 'D', 'A', 'E'].map((_, s) => (s === 0 ? i : null)))

describe('repeats', () => {
  it('cycles :| → |: → :|: → plain', () => {
    expect(nextRepeatType(undefined)).toBe('end')
    expect(nextRepeatType('end')).toBe('start')
    expect(nextRepeatType('start')).toBe('both')
    expect(nextRepeatType('both')).toBeUndefined()
  })
  it('renders bar glyphs', () => {
    expect([barGlyph('end'), barGlyph('start'), barGlyph('both'), barGlyph()]).toEqual([':|', '|:', ':|:', '|'])
  })
  it('remaps and drops column keys but keeps edges', () => {
    expect(remapRepeats({ 1: 'end', 3: 'start', open: 'start' }, c => c === 1 ? null : c + 1))
      .toEqual({ 4: 'start', open: 'start' })
  })
  it('ASCII export → import round-trips repeat signs', () => {
    const tab = {
      title: 'T', tuning: ['E', 'B', 'G', 'D', 'A', 'E'],
      sections: [{ columns: cols(6), bars: [2], repeats: { open: 'start', 2: 'both', close: 'end' }, ghosts: [] }],
    }
    const text = toAscii(tab)
    expect(text).toContain('E|:')
    expect(text).toContain(':|:')
    const parsed = parseAsciiTab(text)
    expect(parsed.sections[0].repeats).toEqual({ open: 'start', 2: 'both', close: 'end' })
    expect(parsed.sections[0].columns.length).toBe(6)
  })
})

describe('closing bar', () => {
  it('merges a bar on the last column into the closing bar', async () => {
    const { closingBar } = await import('./repeats.js')
    const section = { columns: cols(4), bars: [3], repeats: { 3: 'end' } }
    expect(closingBar(section)).toEqual({ last: 3, thick: true, type: 'end' })
    expect(closingBar({ columns: cols(4), bars: [], repeats: {} })).toEqual({ last: 3, thick: false, type: undefined })
  })
  it('ASCII has a single closing bar when the last column has a bar', () => {
    const tab = { title: 'T', tuning: ['E', 'B', 'G', 'D', 'A', 'E'],
      sections: [{ columns: cols(3), bars: [2], repeats: { 2: 'end' }, ghosts: [] }] }
    const line = toAscii(tab).split('\n').find(l => l.startsWith('E|'))
    expect(line.endsWith(':|')).toBe(true)
    expect(line.match(/\|/g).length).toBe(2)
  })
})

describe('section note', () => {
  it('ASCII export → import keeps the note and does not use it as the title', () => {
    const tab = { title: 'T', tuning: ['E', 'B', 'G', 'D', 'A', 'E'],
      sections: [{ title: 'Verse', note: 'play softly\nrepeat x2', columns: cols(3), bars: [], repeats: {}, ghosts: [] }] }
    const parsed = parseAsciiTab(toAscii(tab))
    expect(parsed.sections[0].title).toBe('Verse')
    expect(parsed.sections[0].note).toBe('play softly\nrepeat x2')
  })
})

describe('copy/paste repeats', () => {
  it('copyRepeats re-keys signs inside the range and ignores the rest', async () => {
    const { copyRepeats } = await import('./repeats.js')
    expect(copyRepeats({ 1: 'end', 3: 'start', 5: 'both', open: 'start', close: 'end' }, 3, 5))
      .toEqual({ 0: 'start', 2: 'both' })
  })
})
