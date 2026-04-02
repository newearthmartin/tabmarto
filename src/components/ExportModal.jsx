import { useRef } from 'react'
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
    const normalSize = 11
    const smallSize = 8
    const numStrings = tab.tuning.length
    const blockH = numStrings * rowH
    const colsPerLine = Math.floor((pageW - 2 * mx - labelW - 1) / cellW)

    let y = my

    function ensureSpace(h) {
      if (y + h > pageH - my) { doc.addPage(); y = my }
    }

    // Title
    doc.setFont('Helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(20, 20, 20)
    doc.text(tab.title || 'Untitled Tab', mx, y)
    y += 9

    for (const section of tab.sections) {
      const barsSet = new Set(section.bars ?? [])
      const ghostsSet = new Set(section.ghosts ?? [])
      const columns = section.columns

      if (section.title) {
        y += 4
        ensureSpace(10 + blockH)
        doc.setFont('Helvetica', 'bold')
        doc.setFontSize(12)
        doc.setTextColor(80, 80, 80)
        doc.text(section.title, mx, y)
        y += 8
      }

      let start = 0
      while (start < columns.length) {
        const end = Math.min(start + colsPerLine, columns.length)
        const chunk = columns.slice(start, end)
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

          // Cells
          chunk.forEach((col, i) => {
            const fret = col[si]
            const cx = barX + 0.5 + i * cellW
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
            if (barsSet.has(start + i)) {
              const bx = barX + 0.5 + (i + 1) * cellW
              doc.setDrawColor(80, 80, 80)
              doc.setLineWidth(0.35)
              doc.line(bx, rowTop, bx, rowTop + rowH)
            }
          })

          // Closing bar
          const closeX = barX + 0.5 + chunk.length * cellW
          doc.setDrawColor(140, 140, 140)
          doc.setLineWidth(0.25)
          doc.line(closeX, rowTop, closeX, rowTop + rowH)
        })

        y += blockH + 4
        start = end
      }

      if (section.pageBreak) {
        doc.addPage()
        y = my
      } else {
        y += 3 // gap between sections
      }
    }

    doc.save(`${title || 'tab'}.pdf`)
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
