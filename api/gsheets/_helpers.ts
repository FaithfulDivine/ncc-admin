/**
 * Shared helpers for Google Sheets Vercel API endpoints
 * Loads Service Account from file (local) OR Supabase (production)
 *
 * PERF: Cache cả Service Account và Access Token ở module-scope.
 *       Warm Vercel instance chỉ load SA 1 lần và reuse OAuth token
 *       trong suốt ~55 phút (Google cấp 3600s, chừa 5 phút buffer).
 */
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

// ── Module-scope caches ──────────────────────────────────
let _cachedServiceAccount: any | null = null
let _cachedServiceAccountLoadedAt = 0
// Service account gần như immutable — chỉ refresh mỗi 30 phút để đón rotate bằng tay
const SA_CACHE_TTL_MS = 30 * 60 * 1000

let _cachedAccessToken: string | null = null
let _cachedAccessTokenExpiresAt = 0
// Google token thực tế expires_in ≈ 3600s, trừ 5 phút buffer
const TOKEN_BUFFER_MS = 5 * 60 * 1000

// Create JWT token for Google Service Account authentication
export function createJWT(serviceAccountJson: any): string {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: serviceAccountJson.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  const headerEncoded = Buffer.from(JSON.stringify(header)).toString('base64url')
  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signatureInput = `${headerEncoded}.${payloadEncoded}`

  const signer = crypto.createSign('RSA-SHA256')
  signer.update(signatureInput)
  const signature = signer.sign(serviceAccountJson.private_key, 'base64url')

  return `${signatureInput}.${signature}`
}

// Exchange JWT for access token (with module-scope cache)
export async function getAccessToken(serviceAccountJson: any): Promise<string> {
  // Reuse cached token if still valid
  if (_cachedAccessToken && Date.now() < _cachedAccessTokenExpiresAt) {
    return _cachedAccessToken
  }

  const jwt = createJWT(serviceAccountJson)
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  })

  const data = await response.json()
  if (!data.access_token) {
    throw new Error(`Failed to get access token: ${data.error}`)
  }

  const expiresInSec = Number(data.expires_in) || 3600
  _cachedAccessToken = data.access_token as string
  _cachedAccessTokenExpiresAt = Date.now() + expiresInSec * 1000 - TOKEN_BUFFER_MS
  return _cachedAccessToken
}

/**
 * Load Service Account credentials
 * Priority: 1. Local file (GOOGLE_SERVICE_ACCOUNT_PATH) → 2. Supabase (system_settings)
 * Cached module-scope (SA_CACHE_TTL_MS).
 */
export async function loadServiceAccount(): Promise<any> {
  // Fast path: cached SA still fresh
  if (_cachedServiceAccount && Date.now() - _cachedServiceAccountLoadedAt < SA_CACHE_TTL_MS) {
    return _cachedServiceAccount
  }

  const clean = (s: string) => (s || '').replace(/\0/g, '').trim()

  // 1. Try local file
  const serviceAccountPath = clean(process.env.GOOGLE_SERVICE_ACCOUNT_PATH || '')
  if (serviceAccountPath) {
    try {
      const fullPath = path.isAbsolute(serviceAccountPath)
        ? serviceAccountPath
        : path.resolve(process.cwd(), serviceAccountPath)

      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8')
        const sa = JSON.parse(content)
        if (sa.client_email && sa.private_key) {
          _cachedServiceAccount = sa
          _cachedServiceAccountLoadedAt = Date.now()
          return sa
        }
      }
    } catch { /* fall through to Supabase */ }
  }

  // 2. Try Supabase — ưu tiên SERVICE_ROLE_KEY (sau migration 007 anon sẽ bị
  // chặn với bảng system_settings). Fallback anon để giữ backward compat.
  const supabaseUrl = clean(process.env.VITE_SUPABASE_URL || '')
  const supabaseKey =
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY || '') ||
    clean(process.env.VITE_SUPABASE_ANON_KEY || '')

  if (supabaseUrl && supabaseKey) {
    try {
      const url = `${supabaseUrl}/rest/v1/system_settings?key=eq.GSHEET_SERVICE_ACCOUNT_JSON&select=value`
      const res = await fetch(url, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      })
      const rows = await res.json()
      if (rows?.[0]?.value) {
        const sa = JSON.parse(rows[0].value)
        if (sa.client_email && sa.private_key) {
          _cachedServiceAccount = sa
          _cachedServiceAccountLoadedAt = Date.now()
          return sa
        }
      }
    } catch { /* no Supabase either */ }
  }

  return null
}
