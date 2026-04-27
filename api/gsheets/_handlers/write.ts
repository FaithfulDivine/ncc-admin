import type { VercelRequest, VercelResponse } from '@vercel/node'
import { loadServiceAccount, getAccessToken } from '../_helpers'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const serviceAccount = await loadServiceAccount()
    if (!serviceAccount) {
      return res.status(400).json({ error: 'Google Service Account not configured. Set in Settings or env.' })
    }

    const { sheetId, range, values } = req.body
    if (!sheetId || !range || !values) {
      return res.status(400).json({ error: 'Missing sheetId, range, or values' })
    }

    const token = await getAccessToken(serviceAccount)
    const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`

    const response = await fetch(writeUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    })

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to write to Google Sheet' })
    }

    const data = await response.json()
    return res.status(200).json({
      updatedRows: data.updatedRows,
      updatedColumns: data.updatedColumns,
      updatedCells: data.updatedCells,
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}
