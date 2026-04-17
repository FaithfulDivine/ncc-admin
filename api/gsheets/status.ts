import type { VercelRequest, VercelResponse } from '@vercel/node'
import { loadServiceAccount, getAccessToken } from './_helpers'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const serviceAccount = await loadServiceAccount()
    if (!serviceAccount) {
      return res.status(400).json({ error: 'Google Service Account not configured. Set in Settings or env.', connected: false })
    }

    const token = await getAccessToken(serviceAccount)
    const testUrl = 'https://sheets.googleapis.com/v4/spreadsheets'
    const testRes = await fetch(testUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })

    return res.status(200).json({
      connected: testRes.ok,
      email: serviceAccount.client_email,
      projectId: serviceAccount.project_id,
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message, connected: false })
  }
}
