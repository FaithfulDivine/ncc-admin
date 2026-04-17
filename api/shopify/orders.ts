import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getShopifyConfig } from './_helpers'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { token: accessToken, storeUrl: cleanStore } = await getShopifyConfig()

  if (!cleanStore || !accessToken) {
    return res.status(500).json({ error: 'Shopify not configured. Set env vars or Supabase settings.' })
  }

  const from = (req.query.from as string) || ''
  const to = (req.query.to as string) || ''

  let allOrders: any[] = []
  let pageCount = 0
  const maxPages = 50

  let apiUrl: string | null =
    `https://${cleanStore}/admin/api/2024-10/orders.json?status=any&created_at_min=${from}&created_at_max=${to}&limit=250`

  try {
    while (apiUrl && pageCount < maxPages) {
      pageCount++

      const response = await fetch(apiUrl, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        return res.status(response.status).json({ error: `Shopify API error: ${response.status}` })
      }

      const data = await response.json()
      allOrders = allOrders.concat(data.orders || [])

      // Check for next page via Link header
      const linkHeader = response.headers.get('link')
      apiUrl = null

      if (linkHeader) {
        const links = linkHeader.split(',')
        for (const link of links) {
          if (link.includes('rel="next"')) {
            const match = link.match(/<([^>]+)>/)
            if (match) apiUrl = match[1]
            break
          }
        }
      }
    }

    return res.status(200).json(allOrders)
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}
