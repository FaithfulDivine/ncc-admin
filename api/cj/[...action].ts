/**
 * Catch-all router for /api/cj/*
 *
 * Tự động sinh bởi refactor script — gộp 6 endpoint cũ
 * thành 1 Vercel function duy nhất, route theo segment đầu của path.
 *
 * URL pattern không đổi:
 *   /api/cj/<action>           → routes['action']
 *   /api/cj/<action>?foo=bar   → routes['action'] với req.query.foo
 *
 * Để thêm endpoint mới: thêm file vào _handlers/<action>.ts rồi đăng ký ở routes.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import handleFulfill from './_handlers/fulfill'
import handleOrders from './_handlers/orders'
import handleSkuMap from './_handlers/sku-map'
import handleStatus from './_handlers/status'
import handleWallet from './_handlers/wallet'
import handleTrackingWebhook from './_handlers/tracking-webhook'

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<unknown>

const routes: Record<string, Handler> = {
  'fulfill': handleFulfill,
  'orders': handleOrders,
  'sku-map': handleSkuMap,
  'status': handleStatus,
  'wallet': handleWallet,
  'tracking-webhook': handleTrackingWebhook,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const segments = req.query.action as string[] | undefined
  const action = segments?.[0] || ''
  const fn = routes[action]
  if (!fn) {
    return res.status(404).json({
      error: `Unknown action: ${action || '(empty)'}`,
      available: Object.keys(routes),
    })
  }
  return fn(req, res)
}
