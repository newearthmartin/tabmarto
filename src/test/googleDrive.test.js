import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  seedValidToken, loadDriveModule as loadModule,
  FAKE_TOKEN, FAKE_EXPIRY, TOKEN_KEY, TOKEN_EXP_KEY, CONNECTED_KEY,
} from './helpers.js'

// EMAIL_KEY is only used in this file
const EMAIL_KEY = 'tabmarto_drive_email'

afterEach(() => {
  sessionStorage.clear()
  vi.restoreAllMocks()
})

// ── isConnected ───────────────────────────────────────────────────────────────

describe('isConnected', () => {
  it('returns true when token is valid and CONNECTED_KEY is set', async () => {
    seedValidToken()
    const { isConnected } = await loadModule()
    expect(isConnected()).toBe(true)
  })

  it('returns false when CONNECTED_KEY is missing', async () => {
    sessionStorage.setItem(TOKEN_KEY, FAKE_TOKEN)
    sessionStorage.setItem(TOKEN_EXP_KEY, FAKE_EXPIRY)
    // No localStorage CONNECTED_KEY
    const { isConnected } = await loadModule()
    expect(isConnected()).toBe(false)
  })

  it('returns false when token is expired', async () => {
    sessionStorage.setItem(TOKEN_KEY, FAKE_TOKEN)
    sessionStorage.setItem(TOKEN_EXP_KEY, String(Date.now() - 1000)) // in the past
    localStorage.setItem(CONNECTED_KEY, '1')
    const { isConnected } = await loadModule()
    expect(isConnected()).toBe(false)
  })

  it('returns false when no token is stored', async () => {
    localStorage.setItem(CONNECTED_KEY, '1')
    const { isConnected } = await loadModule()
    expect(isConnected()).toBe(false)
  })
})

// ── getEmail ──────────────────────────────────────────────────────────────────

describe('getEmail', () => {
  it('returns null when no email in sessionStorage', async () => {
    seedValidToken()
    const { getEmail } = await loadModule()
    expect(getEmail()).toBeNull()
  })

  it('returns the email stored in sessionStorage', async () => {
    seedValidToken()
    sessionStorage.setItem(EMAIL_KEY, 'user@example.com')
    const { getEmail } = await loadModule()
    expect(getEmail()).toBe('user@example.com')
  })
})

// ── disconnect ────────────────────────────────────────────────────────────────

describe('disconnect', () => {
  it('makes isConnected return false', async () => {
    seedValidToken()
    const { isConnected, disconnect } = await loadModule()
    expect(isConnected()).toBe(true)
    window.google = { accounts: { oauth2: { revoke: vi.fn() } } }
    disconnect()
    expect(isConnected()).toBe(false)
    delete window.google
  })

  it('clears sessionStorage and localStorage keys', async () => {
    seedValidToken()
    sessionStorage.setItem(EMAIL_KEY, 'user@example.com')
    const { disconnect } = await loadModule()
    window.google = { accounts: { oauth2: { revoke: vi.fn() } } }
    disconnect()
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull()
    expect(sessionStorage.getItem(TOKEN_EXP_KEY)).toBeNull()
    expect(sessionStorage.getItem(EMAIL_KEY)).toBeNull()
    expect(localStorage.getItem(CONNECTED_KEY)).toBeNull()
    delete window.google
  })

  it('calls google.accounts.oauth2.revoke with the token', async () => {
    seedValidToken()
    const { disconnect } = await loadModule()
    const revoke = vi.fn()
    window.google = { accounts: { oauth2: { revoke } } }
    disconnect()
    expect(revoke).toHaveBeenCalledWith(FAKE_TOKEN)
    delete window.google
  })
})

// ── listDriveTabs ─────────────────────────────────────────────────────────────

describe('listDriveTabs', () => {
  it('calls the Drive files endpoint with correct query', async () => {
    seedValidToken()
    const { listDriveTabs } = await loadModule()
    const files = [{ id: 'f1', name: 'Song.json', modifiedTime: '2024-01-01', appProperties: { appId: 'tab-1' } }]
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ files }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await listDriveTabs()

    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toContain('drive/v3/files')
    expect(url).toContain('appDataFolder')
    expect(url).toContain('spaces=appDataFolder')
    expect(url).toContain('appProperties')
    expect(url).toContain('tabmarto')
    expect(opts.headers.Authorization).toBe(`Bearer ${FAKE_TOKEN}`)
    expect(result).toEqual(files)
  })

  it('throws when Drive API returns an error status', async () => {
    seedValidToken()
    const { listDriveTabs } = await loadModule()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    }))
    await expect(listDriveTabs()).rejects.toThrow('403')
  })
})

// ── loadFromDrive ─────────────────────────────────────────────────────────────

describe('loadFromDrive', () => {
  it('fetches the file content by id', async () => {
    seedValidToken()
    const { loadFromDrive } = await loadModule()
    const content = JSON.stringify({ title: 'My Tab' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => content,
    }))

    const result = await loadFromDrive('file-abc')

    const [url] = vi.mocked(fetch).mock.calls[0]
    expect(url).toContain('file-abc')
    expect(url).toContain('alt=media')
    expect(result).toBe(content)
  })
})

// ── deleteFromDrive ───────────────────────────────────────────────────────────

describe('deleteFromDrive', () => {
  it('sends a DELETE request for the given file id', async () => {
    seedValidToken()
    const { deleteFromDrive } = await loadModule()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '' })
    vi.stubGlobal('fetch', fetchMock)

    await deleteFromDrive('file-xyz')

    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toContain('file-xyz')
    expect(opts.method).toBe('DELETE')
    expect(opts.headers.Authorization).toBe(`Bearer ${FAKE_TOKEN}`)
  })
})

// ── saveToDrive ───────────────────────────────────────────────────────────────

describe('saveToDrive', () => {
  const exportFn = (tab) => JSON.stringify(tab)

  it('POSTs a new file when tab has no driveId', async () => {
    seedValidToken()
    const { saveToDrive } = await loadModule()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'new-drive-id' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const tab = { title: 'New Song', sections: [] }
    const id = await saveToDrive(tab, exportFn)

    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toContain('upload/drive/v3/files')
    expect(opts.method).toBe('POST')
    expect(id).toBe('new-drive-id')
  })

  it('PATCHes the existing file when tab has a driveId', async () => {
    seedValidToken()
    const { saveToDrive } = await loadModule()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'existing-id' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const tab = { title: 'Old Song', driveId: 'existing-id', sections: [] }
    await saveToDrive(tab, exportFn)

    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toContain('existing-id')
    expect(opts.method).toBe('PATCH')
  })

  it('sends the tab title as the file name in the multipart metadata', async () => {
    seedValidToken()
    const { saveToDrive } = await loadModule()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'x' }),
    }))

    const tab = { title: 'Blues Riff', sections: [] }
    await saveToDrive(tab, exportFn)

    const body = vi.mocked(fetch).mock.calls[0][1].body
    expect(body).toContain('"name":"Blues Riff.json"')
  })

  it('stores new files in the appDataFolder', async () => {
    seedValidToken()
    const { saveToDrive } = await loadModule()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'x' }),
    }))

    await saveToDrive({ id: 'tab-123', title: 'T', sections: [] }, exportFn)

    const body = vi.mocked(fetch).mock.calls[0][1].body
    expect(body).toContain('"parents":["appDataFolder"]')
  })

  it('includes appProperties in the multipart metadata', async () => {
    seedValidToken()
    const { saveToDrive } = await loadModule()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'x' }),
    }))

    await saveToDrive({ id: 'tab-123', title: 'T', sections: [] }, exportFn)

    const body = vi.mocked(fetch).mock.calls[0][1].body
    expect(body).toContain('"tabmarto":"true"')
    expect(body).toContain('"appId":"tab-123"')
  })

  it('uses "Untitled" when tab has no title', async () => {
    seedValidToken()
    const { saveToDrive } = await loadModule()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'x' }),
    }))

    await saveToDrive({ title: '', sections: [] }, exportFn)

    const body = vi.mocked(fetch).mock.calls[0][1].body
    expect(body).toContain('"name":"Untitled.json"')
  })
})

// ── multipart body structure ──────────────────────────────────────────────────

describe('multipart body (via saveToDrive)', () => {
  it('includes the boundary markers and both parts', async () => {
    seedValidToken()
    const { saveToDrive } = await loadModule()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'x' }),
    }))

    const tab = { title: 'Song', sections: [] }
    const toJson = (t) => JSON.stringify(t)
    await saveToDrive(tab, toJson)

    const [, opts] = vi.mocked(fetch).mock.calls[0]
    const body = opts.body
    const contentType = opts.headers['Content-Type']

    expect(contentType).toMatch(/multipart\/related/)
    expect(contentType).toMatch(/boundary=/)
    // metadata part
    expect(body).toContain('Content-Type: application/json')
    // content part
    expect(body).toContain(toJson(tab))
    // boundary appears at start and end
    const boundary = contentType.match(/boundary=(.+)/)[1]
    expect(body.startsWith(`--${boundary}`)).toBe(true)
    expect(body.trimEnd().endsWith(`--${boundary}--`)).toBe(true)
  })
})
