import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const clean = (s: string) => (s || '').replace(/\0/g, '').trim()
  const storeUrl = clean(process.env.VITE_SHOPIFY_STORE_URL || '')
  const clientId = clean(process.env.SHOPIFY_CLIENT_ID || '')
  const clientSecret = clean(process.env.SHOPIFY_CLIENT_SECRET || '')

  if (!clientId || !clientSecret) {
    return res.status(400).json({ error: 'Missing SHOPIFY_CLIENT_ID or SHOPIFY_CLIENT_SECRET' })
  }
  if (!storeUrl) {
    return res.status(400).json({ error: 'Missing VITE_SHOPIFY_STORE_URL' })
  }

  const cleanUrl = storeUrl.replace(/^https?:\/\//, '')

  try {
    const tokenUrl = `https://${cleanUrl}/admin/oauth/access_token`
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })

    const result = await response.json()

    if (!response.ok || !result.access_token) {
      const errorMsg = result.errors || result.error_description || JSON.stringify(result)
      return res.status(502).json({ error: `Shopify OAuth failed: ${errorMsg}` })
    }

    const newToken = result.access_token
    const expiresIn = result.expires_in

    // Verify token
    let verified = false
    try {
      const verifyUrl = `https://${cleanUrl}/admin/api/2024-10/shop.json`
      const verifyRes = await fetch(verifyUrl, {
        headers: { 'X-Shopify-Access-Token': newToken },
      })
      verified = verifyRes.ok
    } catch {
      // Verification failed but token may still be valid
    }

    const expiresHours = expiresIn ? Math.round(expiresIn / 3600) : null

    // NOTE: On Vercel, we can't write to .env at runtime.
    // The new token should be saved to Supabase system_settings from the frontend,
    // then updated in Vercel env vars if needed.
    return res.status(200).json({
      success: true,
      verified,
      expiresInHours: expiresHours,
      masked: '****' + newToken.slice(-4),
      newToken, // Frontend should persist this to Supabase
      message: verified
        ? `Token renewed! Expires in ${expiresHours || '?'}h. Verified OK.`
        : 'Token renewed but verification failed.',
    })
  } catch (err: any) {
    return res.status(502).json({ error: `Cannot reach Shopify: ${err.message}` })
  }
}
