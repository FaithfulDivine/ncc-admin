/**
 * CJ Dropshipping API client
 *
 * Docs: https://developers.cjdropshipping.com/
 * Base URL: https://developers.cjdropshipping.com/api2.0/v1
 *
 * Auth flow:
 *   POST /authentication/getAccessToken { email, password }
 *     → { accessToken, accessTokenExpiryDate, refreshToken, refreshTokenExpiryDate }
 *   Token TTL 15 ngày. Cache trong system_settings (CJ_ACCESS_TOKEN + CJ_TOKEN_EXPIRES_AT).
 *
 * Tất cả request (trừ auth) cần header: `CJ-Access-Token: <token>`
 *
 * Rate limit: 1 request / second / endpoint. Client này KHÔNG tự throttle —
 * gọi sequential từ API route là đủ; queue xử lý dồn nên nhờ job scheduler.
 */

const CJ_BASE_URL = 'https://developers.cjdropshipping.com/api2.0/v1'

export interface CJAuthResponse {
  accessToken: string
  accessTokenExpiryDate: string
  refreshToken: string
  refreshTokenExpiryDate: string
}

export interface CJOrderLineItem {
  vid: string          // CJ variant ID
  quantity: number
  shippingName?: string
}

export interface CJCreateOrderRequest {
  orderNumber: string                  // Shopify order number (unique)
  shippingCountryCode: string          // 'US'
  shippingProvince: string
  shippingCity: string
  shippingAddress: string
  shippingAddress2?: string
  shippingZip: string
  shippingCustomerName: string
  shippingPhone: string
  shippingZip2?: string
  remark?: string
  fromCountryCode?: string
  logisticName?: string                // CJPacket, YunExpress, USPS...
  products: CJOrderLineItem[]
}

export interface CJOrderResponse {
  orderId: string
  orderNum: string
}

export interface CJWalletBalance {
  amount: number
  currency: string
  frozen: number
}

export interface CJTrackingInfo {
  trackNumber: string
  logisticsName: string
  status: string
  trackDetails?: Array<{
    time: string
    description: string
  }>
}

/**
 * Wrapper cho response CJ — CJ luôn trả về shape:
 *   { code: 200, result: true, message: '', data: {...}, requestId: '...' }
 */
interface CJEnvelope<T> {
  code: number
  result: boolean
  message: string
  data: T
  requestId?: string
}

export class CJApiError extends Error {
  code: number
  requestId?: string
  constructor(code: number, message: string, requestId?: string) {
    super(`[CJ ${code}] ${message}${requestId ? ` (req=${requestId})` : ''}`)
    this.code = code
    this.requestId = requestId
  }
}

/**
 * Thực hiện fetch với envelope unwrap. Ném CJApiError khi code != 200.
 */
async function cjFetch<T>(
  path: string,
  options: { method?: 'GET' | 'POST'; token?: string; body?: unknown } = {},
): Promise<T> {
  const { method = 'GET', token, body } = options
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) headers['CJ-Access-Token'] = token

  const res = await fetch(`${CJ_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const json = (await res.json()) as CJEnvelope<T>

  if (!json.result || json.code !== 200) {
    throw new CJApiError(json.code, json.message || 'CJ API error', json.requestId)
  }
  return json.data
}

// ─────────────────────────────────────────────────────────────
// Authentication
// ─────────────────────────────────────────────────────────────

export async function cjGetAccessToken(
  email: string,
  password: string,
): Promise<CJAuthResponse> {
  return cjFetch<CJAuthResponse>('/authentication/getAccessToken', {
    method: 'POST',
    body: { email, password },
  })
}

export async function cjRefreshAccessToken(refreshToken: string): Promise<CJAuthResponse> {
  return cjFetch<CJAuthResponse>('/authentication/refreshAccessToken', {
    method: 'POST',
    body: { refreshToken },
  })
}

// ─────────────────────────────────────────────────────────────
// Products
// ─────────────────────────────────────────────────────────────

export interface CJProductDetail {
  pid: string
  productName: string
  productSku: string
  sellPrice: string
  variants: Array<{
    vid: string
    variantSku: string
    variantName: string
    variantSellPrice: string
    variantImage?: string
  }>
}

export async function cjGetProductDetail(token: string, pid: string): Promise<CJProductDetail> {
  return cjFetch<CJProductDetail>(`/product/query?pid=${encodeURIComponent(pid)}`, { token })
}

export async function cjSearchProduct(
  token: string,
  keyword: string,
  pageNum = 1,
): Promise<{ list: CJProductDetail[]; total: number }> {
  return cjFetch(
    `/product/list?productNameEn=${encodeURIComponent(keyword)}&pageNum=${pageNum}&pageSize=20`,
    { token },
  )
}

// ─────────────────────────────────────────────────────────────
// Orders
// ─────────────────────────────────────────────────────────────

export async function cjCreateOrder(
  token: string,
  payload: CJCreateOrderRequest,
): Promise<CJOrderResponse> {
  return cjFetch<CJOrderResponse>('/shopping/order/createOrder', {
    method: 'POST',
    token,
    body: payload,
  })
}

export async function cjPayOrder(token: string, orderId: string): Promise<{ success: boolean }> {
  return cjFetch<{ success: boolean }>('/shopping/order/confirmOrder', {
    method: 'POST',
    token,
    body: { orderId },
  })
}

export async function cjGetOrderDetail(
  token: string,
  orderId: string,
): Promise<{
  orderId: string
  orderNum: string
  orderStatus: string
  productAmount: number
  postFee: number
  trackNumber?: string
  logisticName?: string
}> {
  return cjFetch(`/shopping/order/getOrderDetail?orderId=${orderId}`, { token })
}

export async function cjCancelOrder(token: string, orderId: string): Promise<{ success: boolean }> {
  return cjFetch('/shopping/order/deleteOrder', {
    method: 'POST',
    token,
    body: { orderId },
  })
}

// ─────────────────────────────────────────────────────────────
// Tracking
// ─────────────────────────────────────────────────────────────

export async function cjGetTracking(
  token: string,
  trackNumber: string,
): Promise<CJTrackingInfo> {
  return cjFetch<CJTrackingInfo>(
    `/logistic/trackQuery?trackNumber=${encodeURIComponent(trackNumber)}`,
    { token },
  )
}

// ─────────────────────────────────────────────────────────────
// Wallet
// ─────────────────────────────────────────────────────────────

export async function cjGetWalletBalance(token: string): Promise<CJWalletBalance> {
  return cjFetch<CJWalletBalance>('/wallet/balance', { token })
}

// ─────────────────────────────────────────────────────────────
// Shipping quote (freight calc)
// ─────────────────────────────────────────────────────────────

export interface CJFreightOption {
  logisticName: string
  logisticPrice: number
  logisticAging: string      // "7-15 days"
}

export async function cjCalculateFreight(
  token: string,
  params: {
    startCountryCode: string
    endCountryCode: string
    products: Array<{ vid: string; quantity: number }>
  },
): Promise<CJFreightOption[]> {
  return cjFetch<CJFreightOption[]>('/logistic/freightCalculate', {
    method: 'POST',
    token,
    body: params,
  })
}
