import { generateId } from './tabModel.js'

function parseBlock(stringLines) {
  const parsedLines = stringLines.map(line => {
    const m = line.match(/^\s*([A-Ga-g][b#]?)\s*\|(.*)/)
    if (!m) return null
    return { note: m[1].toUpperCase(), content: m[2] }
  })
  if (parsedLines.some(l => !l)) return null

  const tuning = parsedLines.map(l => l.note)
  const repeats = {}
  let contents = parsedLines.map(l => {
    let c = l.content
    if (c.endsWith('|')) c = c.slice(0, -1)
    return c
  })
  // |: at the start of the line, :| at the end
  if (contents.some(c => c.startsWith(':'))) {
    repeats.open = 'start'
    contents = contents.map(c => c.startsWith(':') ? c.slice(1) : c)
  }
  if (contents.some(c => c.endsWith(':'))) {
    repeats.close = 'end'
    contents = contents.map(c => c.endsWith(':') ? c.slice(0, -1) : c)
  }

  const maxLen = Math.max(...contents.map(c => c.length))
  const columns = []
  const bars = []
  const ghosts = []
  let i = 0
  let pendingEnd = false

  while (i < maxLen) {
    const chars = contents.map(c => (i < c.length ? c[i] : '-'))

    // Repeat end dots (:|) — the bar itself follows on the next char
    if (contents.some(c => c[i] === ':' && c[i + 1] === '|')) {
      pendingEnd = true
      i++
      continue
    }

    // Bar line: 1 char, optionally followed by repeat start dots (|:)
    if (chars.some(ch => ch === '|')) {
      const isStart = contents.some(c => c[i] === '|' && c[i + 1] === ':')
      if (columns.length > 0) {
        const ci = columns.length - 1
        bars.push(ci)
        if (pendingEnd && isStart) repeats[ci] = 'both'
        else if (pendingEnd) repeats[ci] = 'end'
        else if (isStart) repeats[ci] = 'start'
      }
      pendingEnd = false
      i += isStart ? 2 : 1
      continue
    }

    // Ghost note column: any string starts with '('
    if (chars.some(ch => ch === '(')) {
      // Find advance: max length of any ghost token (X) or (XX)
      let advance = 2
      for (const c of contents) {
        if (i < c.length && c[i] === '(') {
          const close = c.indexOf(')', i)
          if (close !== -1) advance = Math.max(advance, close - i + 1)
        }
      }
      const col = chars.map((ch, si) => {
        const c = contents[si]
        if (i < c.length && c[i] === '(') {
          const close = c.indexOf(')', i)
          if (close !== -1) {
            const inner = c.slice(i + 1, close).replace(/-/g, '')
            if (/^\d+$/.test(inner)) return Math.min(24, parseInt(inner, 10))
          }
        }
        // non-ghost cell in a ghost column: read 2 chars normally
        const nx = i + 1 < c.length ? c[i + 1] : '-'
        if (/\d/.test(ch) && /\d/.test(nx)) return Math.min(24, parseInt(ch + nx, 10))
        if (/\d/.test(ch)) return parseInt(ch, 10)
        if (/\d/.test(nx)) return parseInt(nx, 10)
        return null
      })
      const ci = columns.length
      col.forEach((fret, si) => {
        if (fret !== null && i < contents[si].length && contents[si][i] === '(') {
          ghosts.push(`${ci},${si}`)
        }
      })
      columns.push(col)
      i += advance
      continue
    }

    // 2-char mode: '--'=null, '-N'=N, 'N-'=N, 'NN'=NN
    const next = contents.map(c => (i + 1 < c.length ? c[i + 1] : '-'))
    const col = chars.map((ch, si) => {
      const nx = next[si]
      if (/\d/.test(ch) && /\d/.test(nx)) return Math.min(24, parseInt(ch + nx, 10))
      if (/\d/.test(ch)) return parseInt(ch, 10)
      if (/\d/.test(nx)) return parseInt(nx, 10)
      return null
    })
    columns.push(col)
    i += 2
  }

  return { tuning, columns, bars: bars.sort((a, b) => a - b), repeats, ghosts }
}

export function parseAsciiTab(text) {
  const lines = text.split('\n').map(l => l.trimEnd())
  const isStringLine = l => /^\s*[A-Ga-g][b#]?\s*\|/.test(l)

  const PAGE_BREAK_RE = /^---\s*page break\s*---$/i

  const blocks = []
  let currentBlock = []
  let pendingTitle = ''
  let tabTitle = ''
  let seenBlankAfterPending = false

  for (const line of lines) {
    if (isStringLine(line)) {
      currentBlock.push(line)
      if (currentBlock.length === 6) {
        blocks.push({ title: pendingTitle.trim(), lines: [...currentBlock], pageBreak: false })
        currentBlock = []
        pendingTitle = ''
        seenBlankAfterPending = false
      }
    } else {
      if (currentBlock.length > 0) currentBlock = []
      const trimmed = line.trim()
      if (PAGE_BREAK_RE.test(trimmed)) {
        if (blocks.length > 0) blocks[blocks.length - 1].pageBreak = true
      } else if (trimmed) {
        // A text line preceded by a blank is the tab title
        if (seenBlankAfterPending && pendingTitle && !tabTitle) {
          tabTitle = pendingTitle
        }
        pendingTitle = trimmed
        seenBlankAfterPending = false
      } else if (pendingTitle) {
        seenBlankAfterPending = true
      }
    }
  }

  if (!blocks.length) return null

  const firstParsed = parseBlock(blocks[0].lines)
  if (!firstParsed) return null

  const sections = blocks.map(block => {
    const parsed = parseBlock(block.lines)
    if (!parsed || !parsed.columns.length) return null
    return {
      id: generateId(),
      title: block.title || '',
      columns: parsed.columns,
      bars: parsed.bars,
      repeats: parsed.repeats || {},
      ghosts: parsed.ghosts || [],
      pageBreak: block.pageBreak || false,
    }
  }).filter(Boolean)

  if (!sections.length) return null

  return {
    id: generateId(),
    title: tabTitle || 'Imported Tab',
    tuning: firstParsed.tuning,
    tempo: 120,
    sections,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}
