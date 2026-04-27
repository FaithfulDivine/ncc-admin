import type { VercelRequest, VercelResponse } from '@vercel/node'
import { loadServiceAccount, getAccessToken } from '../_helpers'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const serviceAccount = await loadServiceAccount()
    if (!serviceAccount) {
      return res.status(400).json({ error: 'Google Service Account not configured. Set in Settings or env.' })
    }

    const { sheetId } = req.query
    if (!sheetId) {
      return res.status(400).json({ error: 'Missing sheetId parameter' })
    }

    const token = await getAccessToken(serviceAccount)
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`

    const response = await fetch(metaUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch sheet metadata' })
    }

    const data = await response.json()
    const sheets = (data.sheets || []).map((sheet: any) => ({
      id: sheet.properties.sheetId,
      title: sheet.properties.title,
    }))

    return res.status(200).json({ sheets })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}
