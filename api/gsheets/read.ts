import type { VercelRequest, VercelResponse } from '@vercel/node'
import { loadServiceAccount, getAccessToken } from './_helpers'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const serviceAccount = await loadServiceAccount()
    if (!serviceAccount) {
      return res.status(400).json({ error: 'Google Service Account not configured. Set in Settings or env.' })
    }

    const { sheetId, range } = req.query
    if (!sheetId || !range) {
      return res.status(400).json({ error: 'Missing sheetId or range parameter' })
    }

    const token = await getAccessToken(serviceAccount)
    const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range as string)}`

    const response = await fetch(readUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to read from Google Sheet' })
    }

    const data = await response.json()
    return res.status(200).json(data.values || [])
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}
