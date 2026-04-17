import type { VercelRequest, VercelResponse } from '@vercel/node'
import { saveSystemSetting, getShopifyStoreUrl } from './_helpers'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const clean = (s: string) => (s || '').replace(/\0/g, '').trim()
  const clientId = clean(process.env.SHOPIFY_CLIENT_ID || '')
  const clientSecret = clean(process.env.SHOPIFY_CLIENT_SECRET || '')

  if (!clientId || !clientSecret) {
    return res.status(400).json({ error: 'Missing SHOPIFY_CLIENT_ID or SHOPIFY_CLIENT_SECRET' })
  }

  const cleanUrl = await getShopifyStoreUrl()
  if (!cleanUrl) {
    return res.status(400).json({ error: 'Missing Shopify store URL (env or Supabase)' })
  }

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

    // Save new token to Supabase immediately (server-side)
    const savedToSupabase = await saveSystemSetting('SHOPIFY_ADMIN_TOKEN', newToken)

    return res.status(200).json({
      success: true,
      verified,
      savedToSupabase,
      expiresInHours: expiresHours,
      masked: '****' + newToken.slice(-4),
      newToken, // Frontend can also persist if needed
      message: verified
        ? `Token renewed! Expires in ${expiresHours || '?'}h. Verified OK.${savedToSupabase ? ' Saved to DB.' : ' DB save failed.'}`
        : `Token renewed but verification failed.${savedToSupabase ? ' Saved to DB.' : ' DB save failed.'}`,
    })
  } catch (err: any) {
    return res.status(502).json({ error: `Cannot reach Shopify: ${err.message}` })
  }
}
