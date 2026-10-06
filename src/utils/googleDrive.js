// Google Drive integration using Identity Services (token model) + Drive REST API v3
// Files are tagged with appProperties so we only see files created by this app.

const DISCOVERY = 'https://accounts.google.com/gsi/client'
const DRIVE_API  = 'https://www.googleapis.com/drive/v3'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const MIME       = 'application/json'
const APP_PROP = { tabmarto: 'true' }
const SCOPE      = 'https://www.googleapis.com/auth/drive.appdata'

const CONNECTED_KEY = 'tabmarto_drive_connected'
const TOKEN_KEY      = 'tabmarto_drive_token'
const TOKEN_EXP_KEY  = 'tabmarto_drive_expiry'
const EMAIL_KEY      = 'tabmarto_drive_email'

let accessToken = localStorage.getItem(TOKEN_KEY) || null
let tokenExpiry = parseInt(localStorage.getItem(TOKEN_EXP_KEY) || '0', 10)
let userEmail   = localStorage.getItem(EMAIL_KEY) || null

function getClientId() {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID
}

function loadGsiScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts) return resolve()
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.onload = resolve
    s.onerror = reject
    document.head.appendChild(s)
  })
}

const SILENT_TIMEOUT_MS = 10_000

// Request a token from Google. `prompt: 'none'` renews silently (no UI) when the
// user is still signed in to Google and has already granted consent.
function requestToken({ prompt, timeoutMs }) {
  return new Promise((resolve, reject) => {
    let timer = null
    const done = (fn, v) => { clearTimeout(timer); fn(v) }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: getClientId(),
      scope: SCOPE,
      prompt,
      ...(userEmail ? { login_hint: userEmail, hint: userEmail } : {}),
      callback: (resp) => {
        if (resp.error) { done(reject, new Error(resp.error)); return }
        accessToken = resp.access_token
        tokenExpiry = Date.now() + resp.expires_in * 1000
        localStorage.setItem(TOKEN_KEY, accessToken)
        localStorage.setItem(TOKEN_EXP_KEY, String(tokenExpiry))
        localStorage.setItem(CONNECTED_KEY, '1')
        done(resolve, accessToken)
      },
      error_callback: (err) => done(reject, new Error(err?.type || 'token_error')),
    })
    if (timeoutMs) timer = setTimeout(() => reject(new Error('silent_timeout')), timeoutMs)
    client.requestAccessToken()
  })
}

async function ensureToken() {
  if (accessToken && Date.now() < tokenExpiry - 60_000) return accessToken
  await loadGsiScript()
  if (wasConnected()) {
    try {
      return await requestToken({ prompt: 'none', timeoutMs: SILENT_TIMEOUT_MS })
    } catch { /* fall through to interactive */ }
  }
  return requestToken({ prompt: '' })
}


async function api(path, opts = {}) {
  const token = await ensureToken()
  console.log('[Drive] API call:', opts.method || 'GET', path.replace('https://www.googleapis.com', ''))
  const res = await fetch(path, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, ...opts.headers },
  })
  if (!res.ok) throw new Error(`Drive API error ${res.status}: ${await res.text()}`)
  return res
}

export function isConnected() {
  return wasConnected() && !!accessToken && Date.now() < tokenExpiry - 60_000
}

export function wasConnected() {
  return !!localStorage.getItem(CONNECTED_KEY)
}

export function clearConnected() {
  accessToken = null
  tokenExpiry = 0
  userEmail = null
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(TOKEN_EXP_KEY)
  localStorage.removeItem(EMAIL_KEY)
  localStorage.removeItem(CONNECTED_KEY)
}

export function disconnect() {
  if (accessToken) window.google?.accounts.oauth2.revoke(accessToken)
  clearConnected()
}

export function getEmail() { return userEmail }

export async function fetchEmail() {
  try {
    // The userinfo endpoint needs the email scope; Drive's about.get works with drive.appdata.
    const res = await api(`${DRIVE_API}/about?fields=user(emailAddress)`)
    const info = await res.json()
    userEmail = info.user?.emailAddress || null
    if (userEmail) localStorage.setItem(EMAIL_KEY, userEmail)
    return userEmail
  } catch {
    return null
  }
}

export async function listDriveTabs() {
  console.log('[Drive] listDriveTabs()')
  const q = `'appDataFolder' in parents and mimeType='${MIME}' and appProperties has { key='tabmarto' and value='true' } and trashed=false`
  const res = await api(`${DRIVE_API}/files?spaces=appDataFolder&q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime,appProperties)`)
  const { files } = await res.json()
  console.log('[Drive] listDriveTabs() - found', files.length, 'files')
  return files // [{ id, name, modifiedTime }]
}

export async function saveToDrive(tab, exportFn) {
  const content = exportFn(tab)
  const name = `${tab.title || 'Untitled'}.json`
  const existingId = tab.driveId
  const meta = {
    name,
    mimeType: MIME,
    appProperties: {
      ...APP_PROP,
      appId: tab.id,
    },
  }
  const createMeta = {
    ...meta,
    parents: ['appDataFolder'],
  }

  let res
  if (existingId) {
    const body = buildMultipart(meta, content)
    console.log('[Drive] saveToDrive() - updating existing file:', existingId)
    res = await api(`${UPLOAD_API}/files/${existingId}?uploadType=multipart&fields=id`, {
      method: 'PATCH',
      headers: { 'Content-Type': body.contentType },
      body: body.data,
    })
  } else {
    const body = buildMultipart(createMeta, content)
    console.log('[Drive] saveToDrive() - creating new file:', name)
    res = await api(`${UPLOAD_API}/files?uploadType=multipart&fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': body.contentType },
      body: body.data,
    })
  }

  const { id } = await res.json()
  console.log('[Drive] saveToDrive() - saved with id:', id)
  return id // caller should store this as tab.driveId
}

export async function loadFromDrive(fileId) {
  console.log('[Drive] loadFromDrive() - id:', fileId)
  const res = await api(`${DRIVE_API}/files/${fileId}?alt=media`)
  const text = await res.text()
  console.log('[Drive] loadFromDrive() - loaded', text.length, 'bytes')
  return text
}

export async function deleteFromDrive(fileId) {
  console.log('[Drive] deleteFromDrive() - id:', fileId)
  await api(`${DRIVE_API}/files/${fileId}`, { method: 'DELETE' })
  console.log('[Drive] deleteFromDrive() - deleted')
}

// ── Multipart body builder ──────────────────────────────────────────────────
function buildMultipart(meta, content) {
  const boundary = 'tabmarto_boundary'
  const data = [
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    JSON.stringify(meta),
    `--${boundary}`,
    `Content-Type: ${MIME}`,
    '',
    content,
    `--${boundary}--`,
  ].join('\r\n')
  return { data, contentType: `multipart/related; boundary=${boundary}` }
}
