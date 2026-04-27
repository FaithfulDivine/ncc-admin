/**
 * POST /api/cj/tracking-webhook
 *
 * CJ gọi webhook này khi order có update tracking / shipped / delivered.
 * Flow:
 *  1. Verify HMAC (nếu có secret) — header X-CJ-Signature.
 *  2. Append raw payload vào cj_webhook_log.
 *  3. Parse event → update cj_orders + cj_shipments.
 *  4. Nếu shipped và chưa push Shopify → gọi Shopify fulfill API.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'node:crypto'
import { getSupabaseClient, getSystemSetting } from '../_helpers'
import { getShopifyConfig } from '../../shopify/_helpers'

interface CJWebhookPayload {
  eventType: string
  orderId: string
  orderNum: string
  trackNumber?: string
  logisticName?: string
  status?: string
  timestamp?: string
}

function verifySignature(body: string, signature: string | undefined, secret: string): boolean {
  if (!signature) return false
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const sb = getSupabaseClient()
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' })

  const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
  const payload = (typeof req.body === 'object' ? req.body : JSON.parse(raw)) as CJWebhookPayload

  // 1. Verify
  const secret = await getSystemSetting('CJ_WEBHOOK_SECRET')
  if (secret) {
    const sig = (req.headers['x-cj-signature'] || req.headers['X-CJ-Signature']) as
      | string
      | undefined
    if (!verifySignature(raw, sig, secret)) {
      return res.status(401).json({ error: 'Invalid signature' })
    }
  }

  // 2. Append raw log (idempotent)
  await sb.from('cj_webhook_log').insert({
    event_type: payload.eventType,
    cj_order_id: payload.orderId,
    payload: payload as unknown as Record<string, unknown>,
  })

  // 3. Xử lý theo eventType
  try {
    if (payload.eventType === 'ORDER_SHIPPED' && payload.trackNumber) {
      await handleShipped(sb, payload)
    } else if (payload.eventType === 'ORDER_DELIVERED') {
      await sb
        .from('cj_orders')
        .update({
          status: 'delivered',
          delivered_at: payload.timestamp || new Date().toISOString(),
        })
        .eq('cj_order_id', payload.orderId)
    } else if (payload.eventType === 'ORDER_CANCELLED') {
      await sb.from('cj_orders').update({ status: 'cancelled' }).eq('cj_order_id', payload.orderId)
    }

    await sb
      .from('cj_webhook_log')
      .update({ processed: true })
      .eq('cj_order_id', payload.orderId)
      .order('received_at', { ascending: false })
      .limit(1)

    return res.status(200).json({ ok: true })
  } catch (err: any) {
    await sb
      .from('cj_webhook_log')
      .update({ error_message: err.message })
      .eq('cj_order_id', payload.orderId)
      .order('received_at', { ascending: false })
      .limit(1)
    return res.status(500).json({ error: err.message })
  }
}

async function handleShipped(
  sb: ReturnType<typeof getSupabaseClient>,
  payload: CJWebhookPayload,
) {
  if (!sb) return

  // Lấy cj_order để biết shopify_order_id
  const { data: order } = await sb
    .from('cj_orders')
    .select('id, shopify_order_id')
    .eq('cj_order_id', payload.orderId)
    .single()

  if (!order) return

  // Song song: upsert shipment + update status + load Shopify config
  // (3 thao tác độc lập, không phụ thuộc nhau → Promise.all thay vì tuần tự)
  const shippedAt = payload.timestamp || new Date().toISOString()
  const [, , shopifyCfg] = await Promise.all([
    sb.from('cj_shipments').upsert(
      {
        cj_order_id: order.id,
        tracking_number: payload.trackNumber!,
        carrier: payload.logisticName || null,
        shipment_status: 'in_transit',
        shipped_at: shippedAt,
      },
      { onConflict: 'tracking_number' },
    ),
    sb
      .from('cj_orders')
      .update({ status: 'shipped', shipped_at: shippedAt })
      .eq('cj_order_id', payload.orderId),
    getShopifyConfig(),
  ])

  // Push fulfillment sang Shopify
  const { token, storeUrl } = shopifyCfg
  if (!token || !storeUrl) return

  try {
    const shopRes = await fetch(
      `https://${storeUrl}/admin/api/2024-10/orders/${order.shopify_order_id}/fulfillments.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fulfillment: {
            tracking_info: {
              number: payload.trackNumber,
              company: payload.logisticName || 'other',
            },
            notify_customer: true,
          },
        }),
      },
    )
    const shopData = await shopRes.json()
    if (shopRes.ok && shopData.fulfillment) {
      await sb
        .from('cj_shipments')
        .update({
          pushed_to_shopify: true,
          shopify_fulfillment_id: shopData.fulfillment.id,
        })
        .eq('tracking_number', payload.trackNumber)
    }
  } catch (err) {
    console.error('[CJ webhook] push to Shopify failed:', err)
  }
}
