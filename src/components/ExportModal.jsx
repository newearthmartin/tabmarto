import { useRef } from 'react'
import { capoLineFor } from '../utils/capo.js'
import { hasRepeatStart, hasRepeatEnd, closingBar } from '../utils/repeats.js'
import { exportTab } from '../utils/tabFormat.js'
import './ExportModal.css'

export default function ExportModal({ ascii, title, tab, onClose }) {
  const textRef = useRef(null)

  function handleDownloadTab() {
    const blob = new Blob([exportTab(tab)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title || 'tab'}.json`
    a.click()
    URL.revokeObjectURL(url)
    onClose()
  }

  function handleCopy() {
    navigator.clipboard.writeText(ascii)
    textRef.current?.select()
  }

  function handleDownload() {
    const blob = new Blob([ascii], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title || 'tab'}.txt`
    a.click()
    URL.revokeObjectURL(url)
    onClose()
  }

  async function handleDownloadPdf() {
    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })

    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const mx = 15        // margin x
    const my = 15        // margin y
    const cellW = 4.0    // mm per column
    const rowH = 4.0     // mm per string row
    const labelW = 5     // mm for tuning label
    const gutter = 2     // mm between the first/last bar line and the notes (room for repeat dots)
    const normalSize = 11
    const smallSize = 8
    const numStrings = tab.tuning.length
    const blockH = numStrings * rowH
    const colsPerLine = Math.floor((pageW - 2 * mx - labelW - 1) / cellW)

    let y = my

    // Repeat dots beside a bar line on the two middle strings
    function drawRepeatDots(type, barXPos, rowTop, si) {
      const mid = Math.floor(numStrings / 2)
      if (si !== mid - 1 && si !== mid) return
      const cy = rowTop + rowH / 2
      doc.setFillColor(20, 20, 20)
      if (hasRepeatStart(type)) doc.circle(barXPos + 1.15, cy, 0.48, 'F')
      if (hasRepeatEnd(type)) doc.circle(barXPos - 1.15, cy, 0.48, 'F')
    }

    const lineW = pageW - 2 * mx - labelW - 1 - 2 * gutter

    // End column (exclusive) of the row starting at `start`: as many columns as
    // fit, breaking at the last bar line when the section continues.
    function rowEnd(section, start) {
      const barsSet = new Set(section.bars ?? [])
      const closingLast = closingBar(section).last
      const columns = section.columns
      let end = start
      let usedW = 0
      while (end < columns.length && usedW + cellW <= lineW) {
        usedW += cellW
        if (barsSet.has(end) && end !== closingLast) usedW += cellW // bar takes a full cell width
        end++
      }
      if (end === start) end = start + 1 // always advance at least one column
      if (end < columns.length) {
        for (let c = end - 1; c >= start; c--) {
          if (barsSet.has(c)) { end = c + 1; break }
        }
      }
      return end
    }

    // Note block: ~4mm of white above (title/previous rows → note) and the same
    // below (note → top of the tab rows). Height from first baseline to row top:
    const noteLineH = 11 * 1.2 * 25.4 / 72 // mm per line at 11pt, line factor 1.2
    const noteHeight = (n) => (n - 1) * noteLineH + 6

    // Section title spacing: white above it, and below it when no note follows
    // (with a note, the note's own lead keeps the title→note and note→tab gaps even)
    const TITLE_BEFORE = 6
    const titleAfter = (section) => noteText(section) ? 8 : 10

    // Extra white above a note so it matches the space below it (+1mm over the title / previous rows)
    const NOTE_LEAD = 1

    // Capo and note are printed together in the note style: "Capo en 2" first
    const capoLines = new Map(tab.sections.map((s, i) => [s, capoLineFor(s, tab.sections[i - 1])]))
    const noteText = (section) => [capoLines.get(section) ?? '', section.note].filter(Boolean).join('\n')

    function noteLinesFor(section) {
      doc.setFont('Helvetica', 'italic')
      doc.setFontSize(11)
      return doc.splitTextToSize(noteText(section), pageW - 2 * mx)
    }

    // Vertical space a section takes (mirrors the drawing code below)
    function sectionHeight(section) {
      let h = 0
      if (section.title) h += TITLE_BEFORE + titleAfter(section)
      if (noteText(section)) h += NOTE_LEAD + noteHeight(noteLinesFor(section).length)
      for (let start = 0; start < section.columns.length; start = rowEnd(section, start)) h += blockH + 4
      return h + (section.pageBreak ? 0 : 3)
    }

    // Sections are grouped under the last titled section: a titled section plus
    // the untitled ones after it. Keep a group on one page when it fits on one.
    function groupHeight(startIndex) {
      let h = 0
      for (let i = startIndex; i < tab.sections.length; i++) {
        if (i > startIndex && tab.sections[i].title) break
        h += sectionHeight(tab.sections[i])
        if (tab.sections[i].pageBreak) break
      }
      return h
    }

    let pageHasContent = false
    function newPage() { doc.addPage(); y = my; pageHasContent = false }

    function ensureSpace(h) {
      if (y + h > pageH - my) newPage()
    }

    // Title
    doc.setFont('Helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(20, 20, 20)
    doc.text(tab.title || 'Untitled Tab', mx, y)
    y += 9

    for (const [sectionIndex, section] of tab.sections.entries()) {
      if (sectionIndex === 0 || section.title) {
        const h = groupHeight(sectionIndex)
        if (pageHasContent && h <= pageH - 2 * my && y + h > pageH - my) newPage()
      }

      const barsSet = new Set(section.bars ?? [])
      const repeats = section.repeats ?? {}
      const closing = closingBar(section)
      const ghostsSet = new Set(section.ghosts ?? [])
      const columns = section.columns

      if (section.title) {
        y += TITLE_BEFORE
        ensureSpace(titleAfter(section) + 2 + blockH)
        doc.setFont('Helvetica', 'bold')
        doc.setFontSize(12)
        doc.setTextColor(80, 80, 80)
        doc.text(section.title, mx, y)
        y += titleAfter(section)
      }

      if (noteText(section)) {
        y += NOTE_LEAD
        doc.setFont('Helvetica', 'italic')
        doc.setFontSize(11)
        doc.setTextColor(110, 110, 110)
        const noteLines = noteLinesFor(section)
        ensureSpace(NOTE_LEAD + noteHeight(noteLines.length) + blockH)
        doc.text(noteLines, mx, y, { lineHeightFactor: 1.2 })
        y += noteHeight(noteLines.length)
      }

      let start = 0
      while (start < columns.length) {
        const end = rowEnd(section, start)
        const lineLast = end - 1 // a bar on this column is drawn as the line's closing bar

        const chunk = columns.slice(start, end)

        // Precompute x offset for each column in the chunk (accounting for bars before it)
        const colX = []
        let xOff = 0
        for (let i = 0; i < chunk.length; i++) {
          colX[i] = xOff
          xOff += cellW
          if (barsSet.has(start + i) && start + i !== lineLast) xOff += cellW
        }
        const totalW = xOff

        ensureSpace(blockH + 3)

        tab.tuning.forEach((note, si) => {
          const rowTop = y + si * rowH
          const baseline = rowTop + rowH * 0.72

          // Label
          doc.setFont('Courier', 'bold')
          doc.setFontSize(normalSize)
          doc.setTextColor(170, 170, 170)
          doc.text(note, mx, baseline)

          // Opening bar
          const barX = mx + labelW
          doc.setDrawColor(140, 140, 140)
          doc.setLineWidth(0.25)
          doc.line(barX, rowTop, barX, rowTop + rowH)
          // Opening dots: section start, or a |: carried over from the bar the previous line broke at
          const openType = start === 0
            ? (repeats.open === 'start' ? 'start' : undefined)
            : (barsSet.has(start - 1) && hasRepeatStart(repeats[start - 1]) ? 'start' : undefined)
          drawRepeatDots(openType, barX, rowTop, si)

          // Cells
          chunk.forEach((col, i) => {
            const fret = col[si]
            const cx = barX + gutter + colX[i]
            const isGhost = ghostsSet.has(`${start + i},${si}`)

            if (fret !== null) {
              doc.setFont('Courier', 'bold')
              doc.setTextColor(20, 20, 20)
              doc.setFontSize(fret >= 10 ? smallSize : normalSize)
            } else {
              doc.setFont('Courier', 'normal')
              doc.setTextColor(190, 190, 190)
              doc.setFontSize(normalSize)
            }

            if (isGhost && fret !== null) {
              doc.setFontSize(fret >= 10 ? smallSize - 1 : normalSize - 2)
              doc.text(`(${fret})`, cx + cellW / 2, baseline, { align: 'center' })
            } else {
              doc.text(fret !== null ? String(fret) : '-', cx + cellW / 2, baseline, { align: 'center' })
            }

            // Measure bar after column
            if (barsSet.has(start + i) && start + i !== lineLast) {
              const bx = barX + gutter + colX[i] + cellW + cellW / 2
              doc.setDrawColor(140, 140, 140)
              doc.setLineWidth(0.25)
              doc.line(bx, rowTop, bx, rowTop + rowH)
              drawRepeatDots(repeats[start + i], bx, rowTop, si)
            }
          })

          // Closing bar
          const closeX = barX + gutter + totalW + gutter
          doc.setDrawColor(140, 140, 140)
          doc.setLineWidth(0.25)
          const isFinal = end === columns.length
          doc.line(closeX, rowTop, closeX, rowTop + rowH)
          const closeType = isFinal ? closing.type : (barsSet.has(lineLast) && hasRepeatEnd(repeats[lineLast]) ? 'end' : undefined)
          drawRepeatDots(closeType, closeX, rowTop, si)
        })

        y += blockH + 4
        pageHasContent = true
        start = end
      }

      if (section.pageBreak) {
        newPage()
      } else {
        y += 3 // gap between sections
      }
    }

    doc.save(`${title || 'tab'}.pdf`)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>Export Tab</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <textarea
          ref={textRef}
          className="modal-textarea"
          value={ascii}
          readOnly
          spellCheck={false}
          onClick={e => e.target.select()}
        />
        <div className="modal-actions">
          <button className="btn btn--primary" onClick={handleDownloadTab}>Download .json</button>
          <button className="btn" onClick={handleCopy}>Copy ASCII</button>
          <button className="btn" onClick={handleDownload}>Download .txt</button>
          <button className="btn" onClick={handleDownloadPdf}>Download .pdf</button>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
