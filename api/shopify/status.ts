import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getShopifyToken, getShopifyStoreUrl, getSystemSetting } from './_helpers'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const clean = (s: string) => (s || '').replace(/\0/g, '').trim()
  const envToken = clean(process.env.SHOPIFY_ACCESS_TOKEN || '')
  const clientId = clean(process.env.SHOPIFY_CLIENT_ID || '')
  const clientSecret = clean(process.env.SHOPIFY_CLIENT_SECRET || '')
  const envStoreUrl = clean(process.env.VITE_SHOPIFY_STORE_URL || '')

  // Also check Supabase for the active token
  const dbToken = await getSystemSetting('SHOPIFY_ADMIN_TOKEN')
  const activeToken = await getShopifyToken()
  const activeStoreUrl = await getShopifyStoreUrl()

  return res.status(200).json({
    hasToken: !!activeToken,
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    hasStoreUrl: !!activeStoreUrl,
    maskedToken: activeToken ? '****' + activeToken.slice(-4) : null,
    storeUrl: activeStoreUrl || null,
    tokenSource: envToken ? 'env' : dbToken ? 'supabase' : 'none',
    supabaseToken: dbToken ? '****' + dbToken.slice(-4) : null,
    envToken: envToken ? '****' + envToken.slice(-4) : null,
  })
}
