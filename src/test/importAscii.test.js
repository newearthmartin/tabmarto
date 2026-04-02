import { describe, it, expect } from 'vitest'
import { parseAsciiTab } from '../utils/importAscii.js'
import { toAscii } from '../utils/ascii.js'

// Hand-written 6-string block. Parsing: 2-char cells.
// '--' → null, '0-' → fret 0, '-3' → fret 3
const SIMPLE = `E|--0--3--|
B|--------|
G|--------|
D|--------|
A|--------|
E|--------|`

describe('parseAsciiTab — basic structure', () => {
  it('returns null for empty input', () => expect(parseAsciiTab('')).toBeNull())
  it('returns null for plain text with no string lines', () => expect(parseAsciiTab('Hello world')).toBeNull())
  it('returns null for fewer than 6 string lines', () => {
    expect(parseAsciiTab('E|--0--|\nB|------|')).toBeNull()
  })

  it('returns a tab object for valid input', () => {
    const result = parseAsciiTab(SIMPLE)
    expect(result).not.toBeNull()
    expect(result.sections).toHaveLength(1)
    expect(result.tuning).toBeDefined()
    expect(result.tempo).toBe(120)
  })

  it('extracts tuning from string labels', () => {
    const result = parseAsciiTab(SIMPLE)
    expect(result.tuning).toEqual(['E', 'B', 'G', 'D', 'A', 'E'])
  })

  it('generates an id', () => {
    const result = parseAsciiTab(SIMPLE)
    expect(typeof result.id).toBe('string')
    expect(result.id.length).toBeGreaterThan(0)
  })
})

describe('parseAsciiTab — note parsing', () => {
  it('parses a single-digit fret', () => {
    // SIMPLE: '--0--3--' → cells: null, 0, 3, null (2-char pairs)
    const result = parseAsciiTab(SIMPLE)
    expect(result.sections[0].columns[1][0]).toBe(0)
    expect(result.sections[0].columns[2][0]).toBe(3)
  })

  it('parses fret 0 correctly (not confused with empty)', () => {
    // '-0': ch='-', nx='0' → parseInt('0') = 0, not null
    const result = parseAsciiTab(SIMPLE)
    expect(result.sections[0].columns[1][0]).toBe(0)
    expect(result.sections[0].columns[0][0]).toBeNull()
  })

  it('parses double-digit frets', () => {
    // '12': ch='1', nx='2' → both digits → parseInt('12') = 12
    const input = `E|12------|
B|--------|
G|--------|
D|--------|
A|--------|
E|--------|`
    const result = parseAsciiTab(input)
    expect(result.sections[0].columns[0][0]).toBe(12)
  })

  it('parses empty cells as null', () => {
    const result = parseAsciiTab(SIMPLE)
    expect(result.sections[0].columns[0][0]).toBeNull()
    expect(result.sections[0].columns[0][1]).toBeNull()
  })

  it('parses notes on the correct string', () => {
    // B is string index 1. Content '--5-----': null, 5, null, null
    const input = `E|--------|
B|--5-----|
G|--------|
D|--------|
A|--------|
E|--------|`
    const result = parseAsciiTab(input)
    expect(result.sections[0].columns[1][1]).toBe(5)
    expect(result.sections[0].columns[1][0]).toBeNull() // E string same col
  })
})

describe('parseAsciiTab — bar lines', () => {
  it('parses bar lines (roundtrip via toAscii)', () => {
    const tab = {
      title: 'T', tuning: ['E','B','G','D','A','E'],
      sections: [{ title: '', columns: Array.from({length:8}, () => Array(6).fill(null)), bars: [3], ghosts: [], pageBreak: false }]
    }
    const result = parseAsciiTab(toAscii(tab))
    expect(result.sections[0].bars).toContain(3)
  })
})

describe('parseAsciiTab — ghost notes', () => {
  it('parses ghost notes in parentheses', () => {
    const input = `E|(7)-----|
B|--------|
G|--------|
D|--------|
A|--------|
E|--------|`
    const result = parseAsciiTab(input)
    expect(result.sections[0].columns[0][0]).toBe(7)
    expect(result.sections[0].ghosts).toContain('0,0')
  })
})

describe('parseAsciiTab — titles', () => {
  it('defaults title to Imported Tab when none found', () => {
    const result = parseAsciiTab(SIMPLE)
    expect(result.title).toBe('Imported Tab')
  })

  it('text line directly before strings becomes section title (not tab title)', () => {
    // Single text line before strings → section title, tab title stays default
    const input = `My Song
E|--0--3--|
B|--------|
G|--------|
D|--------|
A|--------|
E|--------|`
    const result = parseAsciiTab(input)
    expect(result.sections[0].title).toBe('My Song')
    expect(result.title).toBe('Imported Tab')
  })

  it('picks up tab title when two text lines separated by blank precede strings', () => {
    // First text line + blank → tab title candidate. Second text line → confirms it.
    const input = `My Song

Verse
E|--0--3--|
B|--------|
G|--------|
D|--------|
A|--------|
E|--------|`
    const result = parseAsciiTab(input)
    expect(result.title).toBe('My Song')
    expect(result.sections[0].title).toBe('Verse')
  })

  it('picks up section title', () => {
    const input = `Verse
E|--0--3--|
B|--------|
G|--------|
D|--------|
A|--------|
E|--------|`
    const result = parseAsciiTab(input)
    expect(result.sections[0].title).toBe('Verse')
  })
})

describe('parseAsciiTab — multiple sections', () => {
  it('parses two 6-line blocks as two sections', () => {
    const input = `Verse
E|--0--3--|
B|--------|
G|--------|
D|--------|
A|--------|
E|--------|

Chorus
E|--5--7--|
B|--------|
G|--------|
D|--------|
A|--------|
E|--------|`
    const result = parseAsciiTab(input)
    expect(result.sections).toHaveLength(2)
    expect(result.sections[0].title).toBe('Verse')
    expect(result.sections[1].title).toBe('Chorus')
  })
})

describe('parseAsciiTab — roundtrip with toAscii', () => {
  function makeTab(overrides = {}) {
    return {
      id: 'test', title: 'Test Tab',
      tuning: ['E', 'B', 'G', 'D', 'A', 'E'],
      tempo: 120,
      sections: [{
        id: 's1', title: '',
        columns: Array.from({ length: 8 }, () => Array(6).fill(null)),
        bars: [], ghosts: [], pageBreak: false,
      }],
      ...overrides,
    }
  }

  it('preserves notes through export → import', () => {
    const tab = makeTab()
    tab.sections[0].columns[0][0] = 5
    tab.sections[0].columns[2][3] = 12
    const imported = parseAsciiTab(toAscii(tab))
    expect(imported.sections[0].columns[0][0]).toBe(5)
    expect(imported.sections[0].columns[2][3]).toBe(12)
  })

  it('preserves tuning through export → import', () => {
    const tab = makeTab({ tuning: ['E', 'B', 'G', 'D', 'A', 'D'] })
    const imported = parseAsciiTab(toAscii(tab))
    expect(imported.tuning).toEqual(['E', 'B', 'G', 'D', 'A', 'D'])
  })

  it('preserves bar lines through export → import', () => {
    const tab = makeTab()
    tab.sections[0].bars = [3]
    const imported = parseAsciiTab(toAscii(tab))
    expect(imported.sections[0].bars).toContain(3)
  })

  it('preserves section title through export → import', () => {
    const tab = makeTab()
    tab.sections[0].title = 'Verse'
    const imported = parseAsciiTab(toAscii(tab))
    expect(imported.sections[0].title).toBe('Verse')
  })

  it('preserves ghost notes through export → import', () => {
    const tab = makeTab()
    tab.sections[0].columns[1][2] = 7
    tab.sections[0].ghosts = ['1,2']
    const imported = parseAsciiTab(toAscii(tab))
    expect(imported.sections[0].columns[1][2]).toBe(7)
    expect(imported.sections[0].ghosts).toContain('1,2')
  })

  it('preserves all notes when lines wrap (wrapped blocks become separate sections)', () => {
    // 60 columns wraps across 2 lines (~38 cols per line at 80 chars width)
    // The importer treats each 6-line block as a section — notes are preserved across sections
    const tab = makeTab()
    tab.sections[0].columns = Array.from({ length: 60 }, () => Array(6).fill(null))
    tab.sections[0].columns[0][0] = 1
    tab.sections[0].columns[59][0] = 9
    const imported = parseAsciiTab(toAscii(tab))
    // First note in first section
    expect(imported.sections[0].columns[0][0]).toBe(1)
    // Last note somewhere in the last section
    const lastSection = imported.sections[imported.sections.length - 1]
    expect(lastSection.columns.some(col => col[0] === 9)).toBe(true)
  })
})
