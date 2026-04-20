import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const clean = (s: string) => (s || '').replace(/\0/g, '').trim()

/**
 * Module-scoped Supabase client cache — instance được tái dùng xuyên suốt
 * lifetime của serverless worker thay vì tạo mới mỗi lần gọi.
 * Vercel functions có thể giữ warm instance vài phút, vậy nên khóa ở đây
 * sẽ cắt được hàng chục lần gọi createClient dư thừa.
 */
let _sb: SupabaseClient | null = null

/**
 * Create (or reuse) a Supabase client for server-side use.
 *
 * Key priority — Đợt 3 security hardening:
 *   1. SUPABASE_SERVICE_ROLE_KEY  — ưu tiên; bypass RLS nên đọc/ghi system_settings
 *      (chứa secret) sau khi migration 007 siết RLS sẽ vẫn chạy.
 *   2. VITE_SUPABASE_ANON_KEY      — fallback để giữ backward compatibility trước
 *      khi đại vương set env mới. Sau migration 007 anon sẽ KHÔNG đọc được
 *      system_settings, cj_* và sync_logs nữa — vì vậy phải set SERVICE_ROLE_KEY
 *      trên Vercel.
 *
 * Log nhắc 1 lần ở cold start nếu fallback về anon để admin dễ phát hiện.
 */
let _keySourceLogged = false

function getSupabaseClient() {
  if (_sb) return _sb
  const url = clean(process.env.VITE_SUPABASE_URL || '')
  const serviceKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY || '')
  const anonKey = clean(process.env.VITE_SUPABASE_ANON_KEY || '')
  const key = serviceKey || anonKey
  if (!url || !key) return null

  if (!_keySourceLogged) {
    _keySourceLogged = true
    if (!serviceKey) {
      // eslint-disable-next-line no-console
      console.warn(
        '[supabase-helpers] SUPABASE_SERVICE_ROLE_KEY chưa set, đang dùng anon key. ' +
          'Sau khi apply migration 007, anon sẽ KHÔNG đọc được bảng nhạy cảm.',
      )
    }
  }

  _sb = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
  return _sb
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
 * Batch read — đọc nhiều key system_settings trong 1 round-trip duy nhất
 * (Supabase `.in()`). Giảm từ N × ~80ms xuống còn 1 × ~80ms.
 *
 * @param keys  Danh sách key cần đọc
 * @returns     Object { key → value | null }. Key không có trong DB được
 *              map về null để caller destructure an toàn.
 *
 * @example
 *   const { CJ_API_EMAIL, CJ_API_PASSWORD, CJ_ACCESS_TOKEN, CJ_TOKEN_EXPIRES_AT } =
 *     await getSystemSettings(['CJ_API_EMAIL', 'CJ_API_PASSWORD',
 *                              'CJ_ACCESS_TOKEN', 'CJ_TOKEN_EXPIRES_AT'])
 */
export async function getSystemSettings(
  keys: string[],
): Promise<Record<string, string | null>> {
  const result: Record<string, string | null> = Object.fromEntries(
    keys.map((k) => [k, null]),
  )
  if (keys.length === 0) return result
  const sb = getSupabaseClient()
  if (!sb) return result
  try {
    const { data, error } = await sb
      .from('system_settings')
      .select('key,value')
      .in('key', keys)
    if (error || !data) return result
    for (const row of data) {
      if (row.key in result) result[row.key] = clean(row.value ?? '')
    }
    return result
  } catch {
    return result
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
 * Dùng batch helper để gộp 2 RTT Supabase → 1 RTT khi fallback.
 */
export async function getShopifyConfig() {
  const envToken = clean(process.env.SHOPIFY_ACCESS_TOKEN || '')
  const envUrl = clean(process.env.VITE_SHOPIFY_STORE_URL || '')

  // Chỉ query Supabase cho những key chưa có trong env
  const missing: string[] = []
  if (!envToken) missing.push('SHOPIFY_ADMIN_TOKEN')
  if (!envUrl) missing.push('shopify_domain')
  const db = missing.length ? await getSystemSettings(missing) : {}

  const token = envToken || db['SHOPIFY_ADMIN_TOKEN'] || ''
  const rawUrl = envUrl || db['shopify_domain'] || ''
  const storeUrl = rawUrl
    ? rawUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
    : ''

  return { token, storeUrl }
}

export { getSupabaseClient, getSystemSetting }
