import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const clean = (s: string) => (s || '').replace(/\0/g, '').trim()
  const accessToken = clean(process.env.FB_ACCESS_TOKEN || '')
  const adAccountId = clean(process.env.FB_AD_ACCOUNT_ID || '')

  if (!accessToken) {
    return res.status(400).json({ error: 'Facebook token not configured' })
  }
  if (!adAccountId) {
    return res.status(400).json({ error: 'Facebook Ad Account ID not configured' })
  }

  const from = (req.query.from as string) || ''
  const to = (req.query.to as string) || ''

  const fromDate = from ? from.split('T')[0] : new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  const toDate = to ? to.split('T')[0] : new Date().toISOString().split('T')[0]

  const actId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`

  try {
    // Verify token
    const meRes = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${accessToken}`)
    const meData = await meRes.json()
    if (meData.error) {
      return res.status(401).json({ error: `Facebook token invalid: ${meData.error.message}` })
    }

    // Fetch ad insights
    const insightUrl = `https://graph.facebook.com/v21.0/${actId}/insights?fields=spend,impressions,clicks,reach,campaign_name&time_increment=1&time_range[since]=${fromDate}&time_range[until]=${toDate}&level=campaign&access_token=${accessToken}&limit=500`
    const insightRes = await fetch(insightUrl)
    const insightData = await insightRes.json()

    if (!insightRes.ok || insightData.error) {
      const errMsg = insightData.error?.message || JSON.stringify(insightData.error) || 'Unknown'
      return res.status(502).json({ error: `Facebook API error: ${errMsg}` })
    }

    const allInsights: any[] = []

    const processData = (data: any[]) => {
      data.forEach((day: any) => {
        allInsights.push({
          date: day.date_start,
          campaign_name: day.campaign_name || 'Unknown',
          spend: parseFloat(day.spend) || 0,
          impressions: parseInt(day.impressions) || 0,
          clicks: parseInt(day.clicks) || 0,
          reach: parseInt(day.reach) || 0,
        })
      })
    }

    if (insightData.data) processData(insightData.data)

    // Handle pagination
    let nextUrl = insightData.paging?.next
    while (nextUrl) {
      const nextRes = await fetch(nextUrl)
      const nextData = await nextRes.json()
      if (nextData.data) processData(nextData.data)
      nextUrl = nextData.paging?.next
    }

    return res.status(200).json(allInsights)
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}
