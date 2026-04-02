function fretToChars(fret, isGhost) {
  if (isGhost && fret !== null) return `(${fret})` // 3 or 4 chars
  if (fret === null) return '--'
  if (fret >= 10) return String(fret)
  return '-' + fret
}

function sectionToAscii(section, tuning, charsPerLine = 80) {
  const { columns, bars = [], ghosts = [] } = section
  const ghostsSet = new Set(ghosts)
  const barsSet = new Set(bars)
  const labelWidth = 2 // "E|"

  // Determine width of each column (may be wider if it contains a ghost note)
  const colWidths = columns.map((col, ci) => {
    for (let si = 0; si < col.length; si++) {
      if (ghostsSet.has(`${ci},${si}`) && col[si] !== null) {
        return col[si] >= 10 ? 4 : 3
      }
    }
    return 2
  })

  const lines = []
  let start = 0

  while (start < columns.length) {
    let end = start
    let width = labelWidth + 1 // label + opening bar
    while (end < columns.length) {
      width += colWidths[end]
      if (barsSet.has(end)) width += 1
      if (width > charsPerLine && end > start) break
      end++
    }

    const chunk = columns.slice(start, end)
    const stringLines = tuning.map((note, si) => {
      let line = note.padStart(1) + '|'
      chunk.forEach((col, i) => {
        const ci = start + i
        const fret = col[si]
        const isGhost = ghostsSet.has(`${ci},${si}`)
        const chars = fretToChars(fret, isGhost)
        // Pad to column width so all strings align
        line += chars.padEnd(colWidths[ci], '-')
        if (barsSet.has(ci)) line += '|'
      })
      line += '|'
      return line
    })
    lines.push(...stringLines, '')
    start = end
  }

  return lines.join('\n')
}

export function toAscii(tab, charsPerLine = 80) {
  const parts = [tab.title, '']
  tab.sections.forEach((section) => {
    if (section.title) parts.push(section.title)
    parts.push(sectionToAscii(section, tab.tuning, charsPerLine))
  })
  return parts.join('\n')
}
