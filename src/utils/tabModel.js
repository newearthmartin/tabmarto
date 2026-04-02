import { v4 as uuidv4 } from 'uuid'

export const STANDARD_TUNING = ['E', 'B', 'G', 'D', 'A', 'E']

export function generateId() {
  return uuidv4()
}

export function createEmptyColumns(count = 16, numStrings = 6) {
  return Array.from({ length: count }, () => Array(numStrings).fill(null))
}

export function createSection(title = '', numStrings = 6) {
  return {
    id: generateId(),
    title,
    columns: createEmptyColumns(16, numStrings),
    bars: [],
    ghosts: [],
    pageBreak: false,
  }
}

export function createNewTab(title = 'Untitled Tab') {
  return {
    id: generateId(),
    title,
    tuning: [...STANDARD_TUNING],
    tempo: 120,
    sections: [createSection()],
    createdAt: Date.now(),
  }
}

export function migrateTab(tab) {
  const base = tab.sections ? tab : {
    ...tab,
    sections: [{
      id: generateId(),
      title: '',
      columns: tab.columns ?? createEmptyColumns(),
      bars: tab.bars ?? [],
      ghosts: tab.ghosts ?? [],
      pageBreak: false,
    }],
  }

  return {
    ...base,
    tuning: (base.tuning ?? STANDARD_TUNING).map(note => note.toUpperCase()),
    sections: base.sections.map(section => ({
      ...section,
      id: section.id ?? generateId(),
      title: section.title ?? '',
      columns: section.columns ?? createEmptyColumns(16, (base.tuning ?? STANDARD_TUNING).length),
      bars: section.bars ?? [],
      ghosts: section.ghosts ?? [],
      pageBreak: section.pageBreak ?? false,
    })),
  }
}
