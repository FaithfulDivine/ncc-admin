/**
 * Shared helpers for Google Sheets Vercel API endpoints
 * Loads Service Account from file (local) OR Supabase (production)
 */
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

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

// Exchange JWT for access token
export async function getAccessToken(serviceAccountJson: any): Promise<string> {
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
  return data.access_token
}

/**
 * Load Service Account credentials
 * Priority: 1. Local file (GOOGLE_SERVICE_ACCOUNT_PATH) → 2. Supabase (system_settings)
 */
export async function loadServiceAccount(): Promise<any> {
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
        if (sa.client_email && sa.private_key) return sa
      }
    } catch { /* fall through to Supabase */ }
  }

  // 2. Try Supabase
  const supabaseUrl = clean(process.env.VITE_SUPABASE_URL || '')
  const supabaseKey = clean(process.env.VITE_SUPABASE_ANON_KEY || '')

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
        if (sa.client_email && sa.private_key) return sa
      }
    } catch { /* no Supabase either */ }
  }

  return null
}
