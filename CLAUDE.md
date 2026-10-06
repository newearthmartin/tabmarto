# TabMarto — CLAUDE.md

> **Keep this file updated whenever the architecture, data model, key decisions, or file structure change.**

## Project overview

A browser-based guitar tablature editor built with React + Vite. Saves to localStorage or Google Drive.

## Stack

- **React 18** + **Vite 8** (no TypeScript)
- No UI framework — plain CSS with CSS custom properties
- Web Audio API for sound (Karplus-Strong plucked string synthesis)
- LocalStorage or Google Drive for persistence
- Google Identity Services (OAuth 2.0) for Drive auth

## Running locally

```bash
nvm use
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
```

- Always run `nvm use` in this repo before `npm install`, `npm run dev`, `npm run build`, or tests. The correct Node version is defined in the top-level `.nvmrc`.

## File structure

```
src/
  main.jsx                  # React root
  App.jsx                   # Top-level: keyboard handler, playback, selection, layout
  App.css                   # App-level layout + status bar + progress bar

  hooks/
    useTabEditor.js         # All tab state: cursor, history, sections, note/column ops

  components/
    Toolbar.jsx / .css      # Top bar: title, BPM, play/stop, col ops, export
    SectionView.jsx / .css  # Wrapper per section: title input, TabGrid, +/- buttons
    TabGrid.jsx / .css      # The actual grid of cells; pure display + mouse events
    Sidebar.jsx / .css      # Tuning (with presets), saved tabs list, shortcuts cheatsheet
    ExportModal.jsx / .css  # ASCII + PDF export popup
    TransposeDialog.jsx/.css # Floating ± semitone panel (live preview in grid)

  audio/
    player.js               # Karplus-Strong synth, playNote(), playTab(), cancel()

  utils/
    repeats.js              # Repeat-sign helpers (cycle order, ASCII glyphs, key remapping)
    transpose.js            # transposeSection(): shift by semitones, re-fingering across strings
    fret.js                 # fretToChar() / charToFret()  (0-9, a-o for frets 10-24)
    ascii.js                # toAscii(tab) — multi-section ASCII tab export
    importAscii.js          # Parse ASCII tab text back into a tab object
    storage.js              # loadTabs / saveTab / deleteTab / saveLastId / loadLastId
    googleDrive.js          # Google Drive OAuth + REST API v3 (list/load/save/delete)
    storageBackend.js       # StorageManager: abstraction over local and Drive backends
    tabModel.js             # Tab/section factory helpers (createTab, createSection, etc.)
    tabFormat.js            # Serialise/deserialise tabs for Drive storage
```

## Data model

### Tab (top-level document)
```js
{
  id: string,
  driveId: string|null,   // Google Drive file ID (null for local-only tabs)
  title: string,
  tuning: string[],       // e.g. ['E','B','G','D','A','E'] — high to low, always uppercase
  tempo: number,          // BPM
  sections: Section[],
  createdAt: number,
  updatedAt: number,
}
```

### Section
```js
{
  id: string,
  title: string,
  note: string,                        // free-text note shown under the title (not a title)
  columns: Array<Array<number|null>>,  // columns[colIndex][stringIndex], null = empty
  bars: number[],                      // sorted column indices that have a bar line after them
  repeats: { [key]: 'start'|'end'|'both' }, // repeat signs: key = column (bar after it), 'open' or 'close' (section edges); start=|: end=:| both=:|:
  ghosts: string[],                    // "col,string" keys rendered as ghost notes
  pageBreak: boolean,                  // insert PDF page break after this section
}
```

### Cursor
```js
{ section: number, col: number, string: number }
```
String 0 = high string (e.g. high E). String 5 = low string (e.g. low E).

### Selection
```js
{ section: number, start: number, end: number } | null
```
Column-range only (no cell-level selection). Always within a single section.

## Fret notation

| Input key | Fret |
|-----------|------|
| `0`–`9`   | 0–9  |
| `a`–`o`   | 10–24 |

Functions: `fretToChar(fret)` and `charToFret(char)` in `utils/fret.js`.

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `0–9`, `a–o` | Enter fret, auto-advance right |
| `←→↑↓` | Move cursor (wraps across sections on edges) |
| `Delete` | Clear note or clear selected range |
| `Backspace` | Clear note + move left |
| `\|` | Toggle bar line at cursor column |
| `:` | Cycle repeat sign on the bar after the cursor column: `:\|` → `\|:` → `:\|:` → plain bar (`\|` removes the bar and its repeat) |
| `{` / `}` | Toggle `\|:` on the section's opening bar / `:\|` on its closing bar |
| `T` | Transpose current section (dialog: ↑/↓ semitones ±1, Shift ±12, ←/→ slide fret position keeping the same notes, Enter accept, Esc cancel) |
| `Space` | Play / Stop current section |
| `Ctrl+A` | Select all columns in current section |
| `Ctrl+C` | Copy selection (or current column if no selection) |
| `Ctrl+X` | Cut selection (or current column) |
| `Ctrl+V` | Paste at cursor (expands grid if needed) |
| `Ctrl+Z` | Undo (up to 100 steps) |
| `Ctrl+S` | Save |
| `Tab` / `Shift+Tab` | Move right / left |
| `Escape` | Clear selection |

## Playback

- Plays only the **current section**, starting from the cursor column.
- When playback ends naturally, resets start position to col 0 (so next Play starts from beginning).
- Stop cancels all scheduled `AudioBufferSourceNode`s immediately (not just UI timeouts).
- Uses Karplus-Strong synthesis via Web Audio API — no external audio files.
- Frequency lookup is **position-aware**: the same note name (e.g. `E`) resolves to the correct octave based on string index (high string → 329 Hz, low string → 82 Hz).

## Persistence

- Dual backend: **localStorage** (default) or **Google Drive**.
- Every tab change auto-saves after a 500 ms debounce.
- The last-opened tab ID is stored separately (`tabmarto_last_id` for local, sessionStorage for Drive) and restored on reload.
- Old tabs without `sections` are auto-migrated on load (single section created from `columns`/`bars`).
- Old tabs with lowercase tuning notes are normalised to uppercase on load.

## Google Drive

- Uses Google Identity Services (GSI) OAuth 2.0 token flow — no gapi.
- Files stored in Drive's `appDataFolder` with `appProperties: { tabmarto: 'true' }`.
- Tabs with a `driveId` are never saved locally — Drive is source of truth.
- Token (and email) cached in localStorage with expiry tracking (Google caps access tokens at 1 h; no refresh token in the GIS token flow).
- When expired (60 s buffer), `ensureToken` first tries a silent renewal (`prompt: 'none'` + `login_hint`, 10 s timeout); only if that fails does it fall back to the interactive popup. Works while the user is still signed in to Google and has already consented.
- Toolbar button toggles between local and Drive modes.
- Sections from another Drive tab can be appended into the current tab.

## Undo

- History stored in a `useRef` array (max 100 snapshots) — not in React state.
- Every mutating operation calls `pushHistory()` before `setTab()`.
- Loading a different tab or creating a new tab clears the history.

## Sections

- A file can have multiple sections (verse, chorus, etc.), each with its own title, columns, and bar lines.
- `+` button below each section inserts a new section after it.
- `−` button deletes; skips confirmation if the section is empty.
- Arrow up on string 1 → jumps to last string of previous section.
- Arrow down on last string → jumps to string 1 of next section.

## Transpose

- `T` opens `TransposeDialog` for the cursor's section; App holds `transpose: { section, semitones }` and renders a live preview (`visibleTab` is the preview while open; nothing is committed or pushed to history until Accept).
- `utils/transpose.js` computes absolute open-string pitches from the tuning, then per column picks the string/fret assignment (distinct strings, frets 0–24) minimising distance from the section's original fret window (min..max+1) plus a small string-change cost, with a bonus for open strings, so the whole section stays in one hand position (e.g. a 0–4 section +12 lands in 0–5). Notes that don't fit are dropped (dialog shows a warning). Ghost flags follow their notes. `position` slides that fret window (same pitches, different strings/frets); `semitones` may be 0 for a pure re-position.

## Grid layout (ASCII-style)

- Font: Menlo / Consolas / Courier New
- Cell width: `1.6ch`, height: `1.2em` — tight, text-file feel
- Empty cells show `-` (dim); cells with fret numbers show the character (bright/bold)
- Opening/closing bar lines have `0.8ch` margin on each side

## Tuning

- All tuning notes stored and displayed **uppercase** (`E`, `B`, `G`, `D`, `A`, `E`).
- Sidebar has individual string dropdowns plus a presets dropdown (Standard, Drop D, Open G/D/E/A, DADGAD, half/full step down).

## Export / Import

### ASCII
- `toAscii(tab)` in `utils/ascii.js` renders all sections separated by their titles.
- Bar lines from `section.bars` are rendered as `|` inline (`|:`, `:|`, `:|:` for repeat signs; import parses them back).
- A bar on a section's last column is drawn as the closing bar (styled exactly like a mid-section bar), with any `:|` dots, instead of an extra line; `+` after it turns it back into a normal mid-section bar (`closingBar()` in `utils/repeats.js`).
- Section notes are exported as `# text` lines under the title (import reads `#` lines back as the note) and printed in italics in the PDF.
- Repeat signs are display/export only for now — playback does not loop them yet.
- Output wraps at 80 characters per line.
- ASCII import (`utils/importAscii.js`) parses ASCII tab text back into sections, detecting tuning labels, bar lines, and page breaks.

### PDF
- Generated client-side with jsPDF.
- Renders tuning labels, bar lines, fret numbers, ghost notes, section titles, and page breaks.

### JSON
- Full tab exported/imported as a `.json` file.
- Preserves all data including section IDs, bars, ghosts, page breaks, and tuning.
