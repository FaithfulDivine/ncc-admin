/**
 * POST /api/cj/fulfill
 * Body: { shopifyOrderId: number, autoPayIfEnabled?: boolean }
 *
 * Flow:
 *  1. Tìm Shopify order.
 *  2. Load mapping cho các variant.
 *  3. Build payload CJ → gọi createOrder.
 *  4. Ghi cj_orders row (status = submitted).
 *  5. Nếu CJ_AUTO_PAY_ENABLED → gọi confirmOrder → status = paid.
 *
 * Lỗi thường gặp:
 *  - variant chưa map → trả 400 với danh sách unmapped.
 *  - ví thiếu tiền → CJ trả message, thuộc hạ lưu vào error_message.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getCJAccessToken,
  getSupabaseClient,
  getSystemSetting,
  buildCJOrderPayload,
  type ShopifyOrderLite,
  type CJMappingRow,
} from './_helpers'
import { cjCreateOrder, cjPayOrder, CJApiError } from '../../src/lib/cj'
import { getShopifyConfig } from '../shopify/_helpers'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { shopifyOrderId } = req.body as { shopifyOrderId?: number }
  if (!shopifyOrderId) {
    return res.status(400).json({ error: 'Missing shopifyOrderId' })
  }

  const sb = getSupabaseClient()
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' })

  const token = await getCJAccessToken()
  if (!token) return res.status(500).json({ error: 'CJ credentials chưa cấu hình' })

  // 1. Lấy Shopify order
  const { token: shopifyToken, storeUrl } = await getShopifyConfig()
  if (!shopifyToken || !storeUrl) {
    return res.status(500).json({ error: 'Shopify chưa cấu hình' })
  }

  const orderRes = await fetch(
    `https://${storeUrl}/admin/api/2024-10/orders/${shopifyOrderId}.json`,
    { headers: { 'X-Shopify-Access-Token': shopifyToken } },
  )
  if (!orderRes.ok) {
    return res.status(404).json({ error: `Shopify order ${shopifyOrderId} không tồn tại` })
  }
  const { order } = (await orderRes.json()) as { order: ShopifyOrderLite }

  // 2. Load mapping cho variants
  const variantIds = order.line_items.map((li) => li.variant_id)
  const { data: mappings, error: mapErr } = await sb
    .from('cj_product_map')
    .select('shopify_variant_id, cj_variant_id, cj_product_id')
    .in('shopify_variant_id', variantIds)

  if (mapErr) return res.status(500).json({ error: `Supabase: ${mapErr.message}` })

  // 3. Build payload
  const defaultShipping = (await getSystemSetting('CJ_DEFAULT_SHIPPING')) || 'CJPacket'
  const { payload, unmapped } = buildCJOrderPayload(
    order,
    (mappings || []) as CJMappingRow[],
    defaultShipping,
  )

  if (unmapped.length > 0) {
    return res.status(400).json({
      error: 'Một số variant chưa map với CJ',
      unmappedVariantIds: unmapped,
    })
  }

  // 4. Gọi CJ createOrder
  let cjOrderResult: { orderId: string; orderNum: string } | null = null
  let errorMessage: string | null = null
  try {
    cjOrderResult = await cjCreateOrder(token, payload)
  } catch (err) {
    errorMessage = err instanceof CJApiError ? err.message : String(err)
  }

  // 5. Upsert cj_orders
  const newStatus = cjOrderResult ? 'submitted' : 'error'
  const { error: upsertErr } = await sb.from('cj_orders').upsert(
    {
      shopify_order_id: order.id,
      shopify_order_number: String(order.order_number),
      cj_order_id: cjOrderResult?.orderId || null,
      cj_order_number: cjOrderResult?.orderNum || null,
      status: newStatus,
      ship_to_name: order.shipping_address.name,
      ship_to_country: order.shipping_address.country_code,
      ship_to_zip: order.shipping_address.zip,
      request_payload: payload,
      response_payload: cjOrderResult || null,
      error_message: errorMessage,
      submitted_at: cjOrderResult ? new Date().toISOString() : null,
    },
    { onConflict: 'shopify_order_id' },
  )
  if (upsertErr) console.error('[CJ] upsert error:', upsertErr)

  if (!cjOrderResult) {
    return res.status(502).json({ error: errorMessage })
  }

  // 6. Auto-pay?
  const autoPay = (await getSystemSetting('CJ_AUTO_PAY_ENABLED')) === 'true'
  if (autoPay) {
    try {
      await cjPayOrder(token, cjOrderResult.orderId)
      await sb
        .from('cj_orders')
        .update({ status: 'paid' })
        .eq('cj_order_id', cjOrderResult.orderId)
    } catch (err) {
      const msg = err instanceof CJApiError ? err.message : String(err)
      await sb
        .from('cj_orders')
        .update({ error_message: `auto-pay failed: ${msg}` })
        .eq('cj_order_id', cjOrderResult.orderId)
    }
  }

  return res.status(200).json({
    success: true,
    cjOrderId: cjOrderResult.orderId,
    cjOrderNum: cjOrderResult.orderNum,
    status: newStatus,
  })
}
