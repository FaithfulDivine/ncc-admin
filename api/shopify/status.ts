import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSystemSettings } from './_helpers'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const clean = (s: string) => (s || '').replace(/\0/g, '').trim()
  const envToken = clean(process.env.SHOPIFY_ACCESS_TOKEN || '')
  const clientId = clean(process.env.SHOPIFY_CLIENT_ID || '')
  const clientSecret = clean(process.env.SHOPIFY_CLIENT_SECRET || '')
  const envStoreUrl = clean(process.env.VITE_SHOPIFY_STORE_URL || '')

  // Batch đọc cả 2 key cùng lúc (1 RTT Supabase thay vì 3)
  const { SHOPIFY_ADMIN_TOKEN: dbToken, shopify_domain: dbDomain } = await getSystemSettings([
    'SHOPIFY_ADMIN_TOKEN',
    'shopify_domain',
  ])
  const activeToken = envToken || dbToken || ''
  const rawStoreUrl = envStoreUrl || dbDomain || ''
  const activeStoreUrl = rawStoreUrl
    ? rawStoreUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
    : ''

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
