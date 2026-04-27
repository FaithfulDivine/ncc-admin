/**
 * GET  /api/cj/sku-map        — list tất cả mapping
 * POST /api/cj/sku-map        — upsert một mapping
 * DELETE /api/cj/sku-map?id=… — xoá
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from '../_helpers'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const sb = getSupabaseClient()
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' })

  if (req.method === 'GET') {
    const { data, error } = await sb
      .from('cj_product_map')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'POST') {
    const body = req.body as Record<string, unknown>
    if (!body.shopify_variant_id || !body.cj_variant_id || !body.cj_product_id) {
      return res.status(400).json({
        error: 'Missing required: shopify_variant_id, cj_variant_id, cj_product_id',
      })
    }
    const { data, error } = await sb
      .from('cj_product_map')
      .upsert(body, { onConflict: 'shopify_variant_id' })
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    const id = req.query.id as string
    if (!id) return res.status(400).json({ error: 'Missing id' })
    const { error } = await sb.from('cj_product_map').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
