/**
 * GET /api/cj/status
 * Kiểm tra kết nối CJ: token hợp lệ + wallet balance.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getCJAccessToken } from './_helpers'
import { cjGetWalletBalance } from '../../src/lib/cj'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const token = await getCJAccessToken()
  if (!token) {
    return res.status(200).json({
      connected: false,
      reason: 'CJ credentials chưa cấu hình trong Settings (CJ_API_EMAIL / CJ_API_PASSWORD).',
    })
  }

  try {
    const wallet = await cjGetWalletBalance(token)
    return res.status(200).json({
      connected: true,
      wallet,
    })
  } catch (err: any) {
    return res.status(200).json({
      connected: false,
      reason: err?.message || 'Không lấy được wallet balance',
    })
  }
}
