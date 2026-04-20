/**
 * CJ API helper — server-side token management.
 * Cache access token trong system_settings, tự refresh khi expire.
 */
import { getSupabaseClient, getSystemSetting, saveSystemSetting } from '../shopify/_helpers'
import { cjGetAccessToken } from '../../src/lib/cj'

export { getSupabaseClient, getSystemSetting, saveSystemSetting }

interface CJCredentials {
  email: string
  password: string
}

async function getCJCredentials(): Promise<CJCredentials | null> {
  const email = await getSystemSetting('CJ_API_EMAIL')
  const password = await getSystemSetting('CJ_API_PASSWORD')
  if (!email || !password) return null
  return { email, password }
}

/**
 * Lấy access token CJ hiện hành. Nếu đã hết hạn → login lại.
 * Trả về null nếu chưa config credential.
 */
export async function getCJAccessToken(): Promise<string | null> {
  const cachedToken = await getSystemSetting('CJ_ACCESS_TOKEN')
  const expiresAt = await getSystemSetting('CJ_TOKEN_EXPIRES_AT')

  // Token còn sống (còn ít nhất 1h) → dùng cache
  if (cachedToken && expiresAt) {
    const expiry = new Date(expiresAt).getTime()
    const bufferMs = 60 * 60 * 1000 // 1 hour buffer
    if (expiry - Date.now() > bufferMs) {
      return cachedToken
    }
  }

  // Refresh: login lại
  const creds = await getCJCredentials()
  if (!creds) return null

  try {
    const auth = await cjGetAccessToken(creds.email, creds.password)
    await saveSystemSetting('CJ_ACCESS_TOKEN', auth.accessToken)
    await saveSystemSetting('CJ_TOKEN_EXPIRES_AT', auth.accessTokenExpiryDate)
    return auth.accessToken
  } catch (err) {
    console.error('[CJ] Token refresh failed:', err)
    return null
  }
}

/**
 * Build CJ order payload từ Shopify order + product mapping.
 */
export interface ShopifyOrderLite {
  id: number
  order_number: number
  line_items: Array<{
    variant_id: number
    quantity: number
    sku: string
    title: string
  }>
  shipping_address: {
    name: string
    address1: string
    address2?: string
    city: string
    province_code: string
    country_code: string
    zip: string
    phone?: string
  }
  note?: string
}

export interface CJMappingRow {
  shopify_variant_id: number
  cj_variant_id: string
  cj_product_id: string
}

export function buildCJOrderPayload(
  order: ShopifyOrderLite,
  mappings: CJMappingRow[],
  defaultShipping: string,
): { payload: import('../../src/lib/cj').CJCreateOrderRequest; unmapped: number[] } {
  const mapByVariant = new Map(mappings.map((m) => [m.shopify_variant_id, m]))

  const products: Array<{ vid: string; quantity: number }> = []
  const unmapped: number[] = []

  for (const li of order.line_items) {
    const m = mapByVariant.get(li.variant_id)
    if (!m) {
      unmapped.push(li.variant_id)
      continue
    }
    products.push({ vid: m.cj_variant_id, quantity: li.quantity })
  }

  const addr = order.shipping_address

  const payload: import('../../src/lib/cj').CJCreateOrderRequest = {
    orderNumber: String(order.order_number),
    shippingCountryCode: addr.country_code,
    shippingProvince: addr.province_code || '',
    shippingCity: addr.city,
    shippingAddress: addr.address1,
    shippingAddress2: addr.address2,
    shippingZip: addr.zip,
    shippingCustomerName: addr.name,
    shippingPhone: addr.phone || '',
    logisticName: defaultShipping,
    remark: order.note || '',
    products,
  }

  return { payload, unmapped }
}
