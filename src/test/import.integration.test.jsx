import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { renderHook, act } from '@testing-library/react'
import { useTabEditor } from '../hooks/useTabEditor.js'
import ImportModal from '../components/ImportModal.jsx'
import { exportTab } from '../utils/tabFormat.js'
import { makeTab, ASCII_TAB } from './helpers.js'

// ── ImportModal component tests ───────────────────────────────────────────────

describe('ImportModal — rendering', () => {
  it('renders the textarea and buttons', () => {
    render(<ImportModal onImport={() => {}} onImportInto={() => {}} onClose={() => {}} />)
    expect(screen.getByRole('textbox')).toBeDefined()
    expect(screen.getByText('Import as New Tab')).toBeDefined()
    expect(screen.getByText('Import into Current Tab')).toBeDefined()
    expect(screen.getByText('Cancel')).toBeDefined()
  })

  it('hides "Import into Current Tab" when there is no current tab', () => {
    render(<ImportModal onImport={() => {}} onImportInto={() => {}} onClose={() => {}} canImportInto={false} />)
    expect(screen.queryByText('Import into Current Tab')).toBeNull()
  })

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn()
    render(<ImportModal onImport={() => {}} onImportInto={() => {}} onClose={onClose} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows error for invalid input', () => {
    render(<ImportModal onImport={() => {}} onImportInto={() => {}} onClose={() => {}} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'not a tab' } })
    fireEvent.click(screen.getByText('Import as New Tab'))
    expect(screen.getByText(/Could not parse/)).toBeDefined()
  })

  it('does not call onImport for invalid input', () => {
    const onImport = vi.fn()
    render(<ImportModal onImport={onImport} onImportInto={() => {}} onClose={() => {}} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'garbage' } })
    fireEvent.click(screen.getByText('Import as New Tab'))
    expect(onImport).not.toHaveBeenCalled()
  })
})

describe('ImportModal — import as new tab (ASCII)', () => {
  it('calls onImport with a parsed tab', () => {
    const onImport = vi.fn()
    render(<ImportModal onImport={onImport} onImportInto={() => {}} onClose={() => {}} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: ASCII_TAB } })
    fireEvent.click(screen.getByText('Import as New Tab'))
    expect(onImport).toHaveBeenCalledOnce()
    const parsed = onImport.mock.calls[0][0]
    expect(parsed.sections).toHaveLength(1)
    expect(parsed.tuning).toEqual(['E','B','G','D','A','E'])
  })

  it('calls onClose after successful import', () => {
    const onClose = vi.fn()
    render(<ImportModal onImport={() => {}} onImportInto={() => {}} onClose={onClose} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: ASCII_TAB } })
    fireEvent.click(screen.getByText('Import as New Tab'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('passes section title from ASCII to onImport', () => {
    const onImport = vi.fn()
    render(<ImportModal onImport={onImport} onImportInto={() => {}} onClose={() => {}} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: ASCII_TAB } })
    fireEvent.click(screen.getByText('Import as New Tab'))
    const parsed = onImport.mock.calls[0][0]
    expect(parsed.sections[0].title).toBe('Verse')
  })
})

describe('ImportModal — import as new tab (JSON)', () => {
  it('calls onImport with a parsed tab from JSON', () => {
    const onImport = vi.fn()
    const tab = makeTab()
    render(<ImportModal onImport={onImport} onImportInto={() => {}} onClose={() => {}} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: exportTab(tab) } })
    fireEvent.click(screen.getByText('Import as New Tab'))
    const parsed = onImport.mock.calls[0][0]
    expect(parsed.title).toBe('Source Tab')
    expect(parsed.tempo).toBe(130)
    expect(parsed.sections[0].title).toBe('Chorus')
  })

  it('preserves notes from JSON import', () => {
    const onImport = vi.fn()
    const tab = makeTab()
    render(<ImportModal onImport={onImport} onImportInto={() => {}} onClose={() => {}} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: exportTab(tab) } })
    fireEvent.click(screen.getByText('Import as New Tab'))
    const parsed = onImport.mock.calls[0][0]
    expect(parsed.sections[0].columns[0][0]).toBe(5)
    expect(parsed.sections[0].columns[1][1]).toBe(7)
  })
})

describe('ImportModal — import into current tab', () => {
  it('calls onImportInto (not onImport) with parsed sections', () => {
    const onImport = vi.fn()
    const onImportInto = vi.fn()
    render(<ImportModal onImport={onImport} onImportInto={onImportInto} onClose={() => {}} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: ASCII_TAB } })
    fireEvent.click(screen.getByText('Import into Current Tab'))
    expect(onImportInto).toHaveBeenCalledOnce()
    expect(onImport).not.toHaveBeenCalled()
  })

  it('passes the parsed tab to onImportInto', () => {
    const onImportInto = vi.fn()
    render(<ImportModal onImport={() => {}} onImportInto={onImportInto} onClose={() => {}} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: ASCII_TAB } })
    fireEvent.click(screen.getByText('Import into Current Tab'))
    const parsed = onImportInto.mock.calls[0][0]
    expect(parsed.sections).toBeDefined()
  })

  it('calls onClose after importing into tab', () => {
    const onClose = vi.fn()
    render(<ImportModal onImport={() => {}} onImportInto={() => {}} onClose={onClose} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: ASCII_TAB } })
    fireEvent.click(screen.getByText('Import into Current Tab'))
    expect(onClose).toHaveBeenCalledOnce()
  })
})

// ── Full integration with useTabEditor hook ───────────────────────────────────

describe('import as new tab — hook integration', () => {
  it('loadTabDirectly loads ASCII-parsed tab', () => {
    const { result } = renderHook(() => useTabEditor())
    const onImport = vi.fn()
    render(<ImportModal onImport={onImport} onImportInto={() => {}} onClose={() => {}} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: ASCII_TAB } })
    fireEvent.click(screen.getByText('Import as New Tab'))
    const parsed = onImport.mock.calls[0][0]
    act(() => result.current.loadTabDirectly(parsed))
    expect(result.current.tab.sections[0].title).toBe('Verse')
    expect(result.current.tab.tuning).toEqual(['E','B','G','D','A','E'])
  })

  it('loadTabDirectly loads JSON-imported tab with notes', () => {
    const { result } = renderHook(() => useTabEditor())
    const onImport = vi.fn()
    const tab = makeTab()
    render(<ImportModal onImport={onImport} onImportInto={() => {}} onClose={() => {}} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: exportTab(tab) } })
    fireEvent.click(screen.getByText('Import as New Tab'))
    const parsed = onImport.mock.calls[0][0]
    act(() => result.current.loadTabDirectly(parsed))
    expect(result.current.tab.title).toBe('Source Tab')
    expect(result.current.tab.sections[0].columns[0][0]).toBe(5)
  })
})

describe('import into current tab — hook integration', () => {
  it('appendSections adds sections from the imported tab', () => {
    const { result } = renderHook(() => useTabEditor())
    const initialSectionCount = result.current.tab.sections.length

    const onImportInto = vi.fn()
    const tab = makeTab()
    render(<ImportModal onImport={() => {}} onImportInto={onImportInto} onClose={() => {}} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: exportTab(tab) } })
    fireEvent.click(screen.getByText('Import into Current Tab'))

    const parsed = onImportInto.mock.calls[0][0]
    act(() => result.current.appendSections(parsed.sections))
    expect(result.current.tab.sections.length).toBe(initialSectionCount + parsed.sections.length)
  })

  it('imported sections have correct notes', () => {
    const { result } = renderHook(() => useTabEditor())
    const tab = makeTab()
    const onImportInto = vi.fn()
    render(<ImportModal onImport={() => {}} onImportInto={onImportInto} onClose={() => {}} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: exportTab(tab) } })
    fireEvent.click(screen.getByText('Import into Current Tab'))
    const parsed = onImportInto.mock.calls[0][0]
    act(() => result.current.appendSections(parsed.sections))
    const added = result.current.tab.sections[result.current.tab.sections.length - 1]
    expect(added.columns[0][0]).toBe(5)
    expect(added.columns[1][1]).toBe(7)
  })

  it('original sections are untouched after import into', () => {
    const { result } = renderHook(() => useTabEditor())
    act(() => result.current.setNote(0, 0, 0, 3))
    const tab = makeTab()
    const onImportInto = vi.fn()
    render(<ImportModal onImport={() => {}} onImportInto={onImportInto} onClose={() => {}} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: exportTab(tab) } })
    fireEvent.click(screen.getByText('Import into Current Tab'))
    const parsed = onImportInto.mock.calls[0][0]
    act(() => result.current.appendSections(parsed.sections))
    expect(result.current.tab.sections[0].columns[0][0]).toBe(3)
  })

  it('does not render import-into in empty-tab mode', () => {
    render(<ImportModal onImport={() => {}} onImportInto={() => {}} onClose={() => {}} canImportInto={false} />)
    expect(screen.queryByText('Import into Current Tab')).toBeNull()
  })
})
