import { describe, it, expect } from 'vitest'
import { exportTab, importTab } from '../utils/tabFormat.js'

function makeSection(overrides = {}) {
  return {
    id: 's1',
    title: '',
    columns: [
      [0, null, null, null, null, null],
      [null, 5, null, null, null, null],
    ],
    bars: [],
    ghosts: [],
    pageBreak: false,
    ...overrides,
  }
}

function makeTab(overrides = {}) {
  return {
    id: 'tab1',
    title: 'My Tab',
    tuning: ['E', 'B', 'G', 'D', 'A', 'E'],
    tempo: 120,
    sections: [makeSection()],
    createdAt: 1000,
    ...overrides,
  }
}

describe('exportTab / importTab roundtrip', () => {
  it('preserves title, tuning, tempo', () => {
    const tab = makeTab()
    const result = importTab(exportTab(tab))
    expect(result.title).toBe('My Tab')
    expect(result.tuning).toEqual(['E', 'B', 'G', 'D', 'A', 'E'])
    expect(result.tempo).toBe(120)
  })

  it('preserves note data', () => {
    const tab = makeTab()
    const result = importTab(exportTab(tab))
    expect(result.sections[0].columns[0][0]).toBe(0)
    expect(result.sections[0].columns[1][1]).toBe(5)
    expect(result.sections[0].columns[0][1]).toBeNull()
  })

  it('preserves bars', () => {
    const tab = makeTab({ sections: [makeSection({ bars: [1] })] })
    const result = importTab(exportTab(tab))
    expect(result.sections[0].bars).toEqual([1])
  })

  it('preserves ghost notes', () => {
    const tab = makeTab({ sections: [makeSection({ ghosts: ['0,0', '1,2'] })] })
    const result = importTab(exportTab(tab))
    expect(result.sections[0].ghosts).toContain('0,0')
    expect(result.sections[0].ghosts).toContain('1,2')
  })

  it('preserves section title', () => {
    const tab = makeTab({ sections: [makeSection({ title: 'Chorus' })] })
    const result = importTab(exportTab(tab))
    expect(result.sections[0].title).toBe('Chorus')
  })

  it('preserves column count', () => {
    const tab = makeTab()
    const result = importTab(exportTab(tab))
    expect(result.sections[0].columns).toHaveLength(2)
  })

  it('preserves the exported tab id on import', () => {
    const tab = makeTab()
    const result = importTab(exportTab(tab))
    expect(result.id).toBe('tab1')
  })
})

describe('importTab', () => {
  it('returns null for invalid JSON', () => expect(importTab('not json')).toBeNull())
  it('returns null when sections missing', () => expect(importTab(JSON.stringify({ tuning: [] }))).toBeNull())
  it('returns null when tuning missing', () => expect(importTab(JSON.stringify({ sections: [] }))).toBeNull())
  it('assigns a new tab id when importing legacy data without one', () => {
    const result = importTab(JSON.stringify({ sections: [], tuning: ['E','B','G','D','A','E'] }))
    expect(typeof result.id).toBe('string')
    expect(result.id.length).toBeGreaterThan(0)
  })
  it('defaults title to Imported Tab', () => {
    const result = importTab(JSON.stringify({ sections: [], tuning: ['E','B','G','D','A','E'] }))
    expect(result.title).toBe('Imported Tab')
  })
  it('defaults tempo to 120', () => {
    const result = importTab(JSON.stringify({ sections: [], tuning: ['E','B','G','D','A','E'] }))
    expect(result.tempo).toBe(120)
  })
})
