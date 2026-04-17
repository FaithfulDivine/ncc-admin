import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getShopifyConfig } from './_helpers'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { token: accessToken, storeUrl: cleanStore } = await getShopifyConfig()

  if (!cleanStore || !accessToken) {
    return res.status(500).json({ error: 'Shopify not configured' })
  }

  try {
    const { orderId, trackingNumber, carrier } = req.body

    if (!orderId || !trackingNumber) {
      return res.status(400).json({ error: 'Missing orderId or trackingNumber' })
    }

    const fulfillUrl = `https://${cleanStore}/admin/api/2024-10/orders/${orderId}/fulfillments.json`

    const fulfillmentData = {
      fulfillment: {
        line_items_by_fulfillment_order: [
          {
            fulfillment_order_id: orderId,
            fulfillment_order_line_items: [],
          },
        ],
        tracking_info: {
          number: trackingNumber,
          company: carrier || 'other',
        },
      },
    }

    const response = await fetch(fulfillUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fulfillmentData),
    })

    if (!response.ok) {
      const errorData = await response.json()
      return res.status(response.status).json({ error: errorData.errors || 'Fulfillment failed' })
    }

    const data = await response.json()
    return res.status(200).json(data.fulfillment)
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}
