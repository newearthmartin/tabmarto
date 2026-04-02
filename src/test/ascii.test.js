import { describe, it, expect } from 'vitest'
import { toAscii } from '../utils/ascii.js'

const TUNING = ['E', 'B', 'G', 'D', 'A', 'E']

function makeTab(overrides = {}) {
  return {
    title: 'Test Tab',
    tuning: TUNING,
    sections: [{
      title: '',
      columns: Array.from({ length: 4 }, () => Array(6).fill(null)),
      bars: [],
      ghosts: [],
    }],
    ...overrides,
  }
}

describe('toAscii', () => {
  it('starts with the tab title', () => {
    const out = toAscii(makeTab({ title: 'My Song' }))
    expect(out.startsWith('My Song')).toBe(true)
  })

  it('outputs one line per string', () => {
    const out = toAscii(makeTab())
    const lines = out.split('\n').filter(l => l.includes('|'))
    expect(lines).toHaveLength(6)
  })

  it('labels strings with tuning notes', () => {
    const out = toAscii(makeTab())
    expect(out).toContain('E|')
    expect(out).toContain('B|')
    expect(out).toContain('G|')
    expect(out).toContain('D|')
    expect(out).toContain('A|')
  })

  it('renders empty cells as --', () => {
    const out = toAscii(makeTab())
    expect(out).toContain('--')
  })

  it('renders single-digit frets as -N', () => {
    const tab = makeTab()
    tab.sections[0].columns[0][0] = 5
    const out = toAscii(tab)
    expect(out).toContain('-5')
  })

  it('renders double-digit frets as NN', () => {
    const tab = makeTab()
    tab.sections[0].columns[0][0] = 12
    const out = toAscii(tab)
    expect(out).toContain('12')
  })

  it('renders bar lines at the correct positions', () => {
    const tab = makeTab()
    tab.sections[0].bars = [1]
    const out = toAscii(tab)
    // Each string line should contain an inner | from the bar
    const stringLines = out.split('\n').filter(l => /^[EBGDA]\|/.test(l))
    stringLines.forEach(l => expect(l.split('|').length).toBeGreaterThan(2))
  })

  it('includes section titles when non-empty', () => {
    const tab = makeTab()
    tab.sections[0].title = 'Verse'
    const out = toAscii(tab)
    expect(out).toContain('Verse')
  })

  it('omits section title line when empty', () => {
    const tab = makeTab()
    tab.sections[0].title = ''
    const out = toAscii(tab)
    // Only the tab title on first line — no extra title line
    const lines = out.split('\n')
    expect(lines[0]).toBe('Test Tab')
    expect(lines[1]).toBe('')
  })

  it('renders ghost notes in parentheses', () => {
    const tab = makeTab()
    tab.sections[0].columns[0][0] = 7
    tab.sections[0].ghosts = ['0,0']
    const out = toAscii(tab)
    expect(out).toContain('(7)')
  })

  it('handles multiple sections', () => {
    const tab = makeTab()
    tab.sections.push({
      title: 'Chorus',
      columns: [[null, null, null, null, null, null]],
      bars: [],
      ghosts: [],
    })
    const out = toAscii(tab)
    expect(out).toContain('Chorus')
  })
})

// Helper: parse ASCII output into a map of { stringLabel -> content }
function parseStringLines(ascii) {
  const map = {}
  for (const line of ascii.split('\n')) {
    const m = line.match(/^([A-G]#?)\|(.+)/)
    if (m) map[m[1]] = (map[m[1]] ?? []).concat(m[2])
  }
  return map
}

describe('toAscii note placement', () => {
  it('places a fret on the correct string', () => {
    const tab = makeTab()
    tab.sections[0].columns[0][0] = 5  // string 0 = high E
    tab.sections[0].columns[0][2] = 7  // string 2 = G
    const strings = parseStringLines(toAscii(tab))
    expect(strings['E'][0]).toMatch(/-5/)  // high E line has the fret
    expect(strings['G'][0]).toMatch(/-7/)  // G line has the fret
    expect(strings['B'][0]).not.toMatch(/-[57]/)  // B is empty
  })

  it('places notes in the correct column order', () => {
    const tab = makeTab()
    tab.sections[0].columns[0][0] = 3
    tab.sections[0].columns[2][0] = 9
    const strings = parseStringLines(toAscii(tab))
    const eLine = strings['E'][0]
    const posOf3 = eLine.indexOf('-3')
    const posOf9 = eLine.indexOf('-9')
    expect(posOf3).toBeGreaterThanOrEqual(0)
    expect(posOf9).toBeGreaterThanOrEqual(0)
    expect(posOf3).toBeLessThan(posOf9)  // col 0 comes before col 2
  })

  it('all string lines have the same length within a section', () => {
    const tab = makeTab()
    tab.sections[0].columns[1][0] = 12  // double-digit widens the column
    const strings = parseStringLines(toAscii(tab))
    const lengths = Object.values(strings).map(lines => lines[0].length)
    expect(new Set(lengths).size).toBe(1)  // all equal
  })

  it('section titles appear before their string lines', () => {
    const tab = makeTab()
    tab.sections[0].title = 'Verse'
    tab.sections[0].columns[0][0] = 4
    const lines = toAscii(tab).split('\n')
    const titleIdx = lines.indexOf('Verse')
    const firstStringIdx = lines.findIndex(l => /^[A-G]#?\|/.test(l))
    expect(titleIdx).toBeGreaterThanOrEqual(0)
    expect(titleIdx).toBeLessThan(firstStringIdx)
  })

  it('each section outputs all 6 strings', () => {
    const tab = makeTab()
    tab.sections.push({ title: 'B', columns: [[null,null,null,null,null,null]], bars: [], ghosts: [] })
    const lines = toAscii(tab).split('\n').filter(l => /^[A-G]#?\|/.test(l))
    // 2 sections × 6 strings = 12 string lines
    expect(lines).toHaveLength(12)
  })
})
