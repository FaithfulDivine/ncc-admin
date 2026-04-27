import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const clean = (s: string) => (s || '').replace(/\0/g, '').trim()
  const appId = clean(process.env.FB_APP_ID || '')
  const appSecret = clean(process.env.FB_APP_SECRET || '')
  const adAccountId = clean(process.env.FB_AD_ACCOUNT_ID || '')
  const accessToken = clean(process.env.FB_ACCESS_TOKEN || '')

  let tokenValid = false
  let tokenExpiry: string | null = null

  if (accessToken && appId && appSecret) {
    try {
      const debugUrl = `https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${appId}|${appSecret}`
      const debugRes = await fetch(debugUrl)
      const debugData = await debugRes.json()
      if (debugData.data) {
        tokenValid = debugData.data.is_valid === true
        if (debugData.data.expires_at) {
          tokenExpiry = new Date(debugData.data.expires_at * 1000).toISOString()
        }
      }
    } catch {
      // Can't verify
    }
  }

  return res.status(200).json({
    hasToken: !!accessToken,
    hasAppId: !!appId,
    hasAppSecret: !!appSecret,
    adAccountId: adAccountId || null,
    maskedToken: accessToken ? '****' + accessToken.slice(-4) : null,
    tokenValid,
    tokenExpiry,
  })
}
