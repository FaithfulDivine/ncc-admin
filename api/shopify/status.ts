import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const clean = (s: string) => (s || '').replace(/\0/g, '').trim()
  const accessToken = clean(process.env.SHOPIFY_ACCESS_TOKEN || '')
  const clientId = clean(process.env.SHOPIFY_CLIENT_ID || '')
  const clientSecret = clean(process.env.SHOPIFY_CLIENT_SECRET || '')
  const storeUrl = clean(process.env.VITE_SHOPIFY_STORE_URL || '')

  return res.status(200).json({
    hasToken: !!accessToken,
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    hasStoreUrl: !!storeUrl,
    maskedToken: accessToken ? '****' + accessToken.slice(-4) : null,
    storeUrl: storeUrl || null,
  })
}
