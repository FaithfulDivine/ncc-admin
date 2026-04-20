/**
 * GET /api/cj/wallet — lấy số dư ví CJ hiện tại.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getCJAccessToken, getSystemSetting } from './_helpers'
import { cjGetWalletBalance } from '../../src/lib/cj'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const token = await getCJAccessToken()
  if (!token) return res.status(500).json({ error: 'CJ chưa cấu hình' })

  try {
    const wallet = await cjGetWalletBalance(token)
    const minBalanceStr = (await getSystemSetting('CJ_WALLET_MIN_BALANCE')) || '50'
    const minBalance = Number(minBalanceStr)
    return res.status(200).json({
      ...wallet,
      low_balance: wallet.amount < minBalance,
      min_balance_threshold: minBalance,
    })
  } catch (err: any) {
    return res.status(502).json({ error: err.message })
  }
}
