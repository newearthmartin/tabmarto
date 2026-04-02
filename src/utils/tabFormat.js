import { generateId } from './tabModel.js'

function compressSection(section) {
  const notes = []
  section.columns.forEach((col, ci) => {
    col.forEach((fret, si) => {
      if (fret !== null) notes.push([ci, si, fret])
    })
  })

  const ghosts = (section.ghosts ?? []).map(key => {
    const [c, s] = key.split(',').map(Number)
    return [c, s]
  })

  const bars = section.bars ?? []
  const out = {}
  if (section.title)     out.title     = section.title
  out.len = section.columns.length
  out.notes = notes
  if (bars.length)       out.bars      = bars
  if (ghosts.length)     out.ghosts    = ghosts
  if (section.pageBreak) out.pageBreak = true
  return out
}

function decompressSection(s, numStrings = 6) {
  const columns = Array.from({ length: s.len }, () => Array(numStrings).fill(null))
  for (const [ci, si, fret] of (s.notes ?? [])) {
    if (columns[ci]) columns[ci][si] = fret
  }
  const ghosts = (s.ghosts ?? []).map(([c, str]) => `${c},${str}`)
  return {
    id: s.id ?? generateId(),
    title: s.title ?? '',
    columns,
    bars: s.bars ?? [],
    ghosts,
    pageBreak: s.pageBreak ?? false,
  }
}

function serialize(val, depth = 0) {
  const pad  = '  '.repeat(depth)
  const pad1 = '  '.repeat(depth + 1)
  if (val === null || typeof val !== 'object') return JSON.stringify(val)
  if (Array.isArray(val)) {
    if (val.length === 0) return '[]'
    // Keep arrays of primitives on one line
    if (val.every(v => v === null || typeof v !== 'object')) {
      return '[' + val.map(v => JSON.stringify(v)).join(', ') + ']'
    }
    return '[\n' + val.map(v => pad1 + serialize(v, depth + 1)).join(',\n') + '\n' + pad + ']'
  }
  const entries = Object.entries(val)
  if (entries.length === 0) return '{}'
  return '{\n' + entries.map(([k, v]) => `${pad1}${JSON.stringify(k)}: ${serialize(v, depth + 1)}`).join(',\n') + '\n' + pad + '}'
}

export function exportTab(tab) {
  const data = {
    id: tab.id,
    title: tab.title,
    tuning: tab.tuning,
    tempo: tab.tempo ?? 120,
    sections: tab.sections.map(compressSection),
  }
  return serialize(data)
}

export function importTab(text) {
  let parsed
  try { parsed = JSON.parse(text) } catch { return null }

  if (!parsed || !Array.isArray(parsed.sections) || !Array.isArray(parsed.tuning)) return null

  const numStrings = parsed.tuning.length

  return {
    id: parsed.id ?? generateId(),
    title: parsed.title ?? 'Imported Tab',
    tuning: parsed.tuning,
    tempo: parsed.tempo ?? 120,
    sections: parsed.sections.map(s => decompressSection(s, numStrings)),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}
