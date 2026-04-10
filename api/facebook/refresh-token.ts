import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const clean = (s: string) => (s || '').replace(/\0/g, '').trim()
  const appId = clean(process.env.FB_APP_ID || '')
  const appSecret = clean(process.env.FB_APP_SECRET || '')
  const accessToken = clean(process.env.FB_ACCESS_TOKEN || '')

  if (!appId || !appSecret) {
    return res.status(400).json({ error: 'Missing FB_APP_ID or FB_APP_SECRET' })
  }

  const tokenToExchange = req.body?.token || accessToken

  if (!tokenToExchange) {
    return res.status(400).json({ error: 'No FB_ACCESS_TOKEN found. Paste a short-lived token first.' })
  }

  try {
    const exchangeUrl = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenToExchange}`
    const response = await fetch(exchangeUrl)
    const result = await response.json()

    if (!response.ok || result.error) {
      const errMsg = result.error?.message || JSON.stringify(result)
      return res.status(502).json({ error: `Facebook token exchange failed: ${errMsg}` })
    }

    const newToken = result.access_token
    const expiresIn = result.expires_in
    const expiresInDays = expiresIn ? Math.round(expiresIn / 86400) : null

    return res.status(200).json({
      success: true,
      expiresInDays,
      masked: '****' + newToken.slice(-4),
      newToken, // Frontend should persist this to Supabase
      message: `Long-lived token obtained! Expires in ~${expiresInDays || '?'} days.`,
    })
  } catch (err: any) {
    return res.status(502).json({ error: `Cannot reach Facebook: ${err.message}` })
  }
}
