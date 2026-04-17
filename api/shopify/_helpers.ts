import { createClient } from '@supabase/supabase-js'

const clean = (s: string) => (s || '').replace(/\0/g, '').trim()

/**
 * Create a Supabase client for server-side use (Vercel API routes).
 * Uses VITE_ prefixed env vars since that's how the project is configured.
 */
function getSupabaseClient() {
  const url = clean(process.env.VITE_SUPABASE_URL || '')
  const key = clean(process.env.VITE_SUPABASE_ANON_KEY || '')
  if (!url || !key) return null
  return createClient(url, key)
}

/**
 * Read a setting from Supabase system_settings table.
 */
async function getSystemSetting(key: string): Promise<string | null> {
  const sb = getSupabaseClient()
  if (!sb) return null
  try {
    const { data, error } = await sb
      .from('system_settings')
      .select('value')
      .eq('key', key)
      .single()
    if (error || !data) return null
    return clean(data.value)
  } catch {
    return null
  }
}

/**
 * Save a setting to Supabase system_settings table.
 */
export async function saveSystemSetting(key: string, value: string): Promise<boolean> {
  const sb = getSupabaseClient()
  if (!sb) return false
  try {
    const { error } = await sb
      .from('system_settings')
      .upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
    return !error
  } catch {
    return false
  }
}

/**
 * Get Shopify access token.
 * Priority: 1) env var SHOPIFY_ACCESS_TOKEN  2) Supabase system_settings SHOPIFY_ADMIN_TOKEN
 */
export async function getShopifyToken(): Promise<string> {
  // 1. Try env var first (fastest, no network call)
  const envToken = clean(process.env.SHOPIFY_ACCESS_TOKEN || '')
  if (envToken) return envToken

  // 2. Fallback: read from Supabase
  const dbToken = await getSystemSetting('SHOPIFY_ADMIN_TOKEN')
  return dbToken || ''
}

/**
 * Get Shopify store URL (cleaned, without protocol).
 * Priority: 1) env var  2) Supabase system_settings
 */
export async function getShopifyStoreUrl(): Promise<string> {
  const envUrl = clean(process.env.VITE_SHOPIFY_STORE_URL || '')
  if (envUrl) return envUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')

  const dbUrl = await getSystemSetting('shopify_domain')
  return dbUrl ? dbUrl.replace(/^https?:\/\//, '').replace(/\/$/, '') : ''
}

/**
 * Get both token and store URL in one call.
 */
export async function getShopifyConfig() {
  const [token, storeUrl] = await Promise.all([
    getShopifyToken(),
    getShopifyStoreUrl(),
  ])
  return { token, storeUrl }
}

export { getSupabaseClient, getSystemSetting }
