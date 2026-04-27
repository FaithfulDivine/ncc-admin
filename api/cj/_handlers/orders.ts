/**
 * GET /api/cj/orders?status=queued,submitted,paid&limit=50
 * List các CJ order từ bảng cj_orders + join shipments.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from '../_helpers'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const sb = getSupabaseClient()
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' })

  const statusCsv = (req.query.status as string) || ''
  const limit = Number(req.query.limit) || 50

  let query = sb
    .from('cj_orders')
    .select('*, cj_shipments(*)')
    .order('queued_at', { ascending: false })
    .limit(limit)

  if (statusCsv) {
    const statuses = statusCsv.split(',').map((s) => s.trim()).filter(Boolean)
    if (statuses.length) query = query.in('status', statuses)
  }

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json(data)
}
