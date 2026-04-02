import { vi } from 'vitest'

// ── Tab fixtures ──────────────────────────────────────────────────────────────

export const ASCII_TAB = `Verse
E|--0--3--|
B|--------|
G|--------|
D|--------|
A|--------|
E|--------|`

export function makeTab(overrides = {}) {
  return {
    id: 'src', title: 'Source Tab',
    tuning: ['E','B','G','D','A','E'],
    tempo: 130,
    sections: [{
      id: 's1', title: 'Chorus',
      columns: [[5,null,null,null,null,null], [null,7,null,null,null,null]],
      bars: [0], ghosts: [], pageBreak: false,
    }],
    createdAt: Date.now(),
    ...overrides,
  }
}

// ── Google Drive test infrastructure ─────────────────────────────────────────

export const FAKE_TOKEN    = 'fake-access-token'
export const FAKE_EXPIRY   = String(Date.now() + 3_600_000)
export const FAKE_DRIVE_ID = 'drive-file-id-123'

export const TOKEN_KEY     = 'tabmarto_drive_token'
export const TOKEN_EXP_KEY = 'tabmarto_drive_expiry'
export const CONNECTED_KEY = 'tabmarto_drive_connected'

/**
 * Pre-seed sessionStorage with a valid token so that `ensureToken` inside
 * googleDrive.js short-circuits and never tries to open an OAuth popup.
 * Must be called BEFORE loadDriveModule() so the module picks it up at init.
 */
export function seedValidToken() {
  sessionStorage.setItem(TOKEN_KEY, FAKE_TOKEN)
  sessionStorage.setItem(TOKEN_EXP_KEY, String(Date.now() + 3_600_000))
  localStorage.setItem(CONNECTED_KEY, '1')
}

/**
 * Reset the module registry and re-import googleDrive.js so the module-level
 * `accessToken` variable is re-initialised from the current sessionStorage.
 */
export async function loadDriveModule() {
  vi.resetModules()
  return import('../utils/googleDrive.js')
}

/**
 * Stub global fetch to return a successful Drive-style response.
 * Pass `body` to override the JSON response body (default: `{ id: FAKE_DRIVE_ID }`).
 */
export function mockDriveFetch(body = { id: FAKE_DRIVE_ID }) {
  const mock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  })
  vi.stubGlobal('fetch', mock)
  return mock
}
