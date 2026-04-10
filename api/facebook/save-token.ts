import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // NOTE: On Vercel, we cannot persist tokens to .env at runtime.
  // This endpoint validates the token and returns it — the frontend should
  // save it to Supabase system_settings for persistence.
  const token = req.body?.token

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Missing token in request body' })
  }

  const cleanToken = token.trim()

  return res.status(200).json({
    success: true,
    message: 'Token received. Save to Supabase system_settings for persistence.',
    masked: '****' + cleanToken.slice(-4),
  })
}
