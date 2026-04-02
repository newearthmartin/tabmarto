# TabMarto

A browser-based guitar tablature editor built with React and Vite. Saves to localStorage or Google Drive.

**Try it:** https://shiny-ember-ftg9.here.now/

## Features

- Multi-section tabs (verse, chorus, etc.) with per-section titles
- Fret entry via keyboard (0-9 for frets 0-9, a-o for frets 10-24)
- Karplus-Strong plucked string synthesis for playback via Web Audio API
- Customisable tuning with presets (Standard, Drop D, Open G/D/E/A, DADGAD, and more)
- Export and import as ASCII, PDF, or JSON
- Google Drive sync (OAuth 2.0, saves to app data folder)
- Import sections from other tabs
- Undo/redo (up to 100 steps)
- Auto-save to localStorage or Google Drive

## Getting started

```bash
nvm use
npm install
npm run dev
```

The app runs at [http://localhost:5173](http://localhost:5173).

## Build

```bash
npm run build
```

Output goes to `dist/`.

## Tests

```bash
npm test
```
