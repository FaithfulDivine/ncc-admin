/**
 * Catch-all router for /api/gsheets/*
 *
 * Tự động sinh bởi refactor script — gộp 4 endpoint cũ
 * thành 1 Vercel function duy nhất, route theo segment đầu của path.
 *
 * URL pattern không đổi:
 *   /api/gsheets/<action>           → routes['action']
 *   /api/gsheets/<action>?foo=bar   → routes['action'] với req.query.foo
 *
 * Để thêm endpoint mới: thêm file vào _handlers/<action>.ts rồi đăng ký ở routes.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import handleMeta from './_handlers/meta'
import handleRead from './_handlers/read'
import handleStatus from './_handlers/status'
import handleWrite from './_handlers/write'

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<unknown>

const routes: Record<string, Handler> = {
  'meta': handleMeta,
  'read': handleRead,
  'status': handleStatus,
  'write': handleWrite,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const segments = req.query.action as string[] | undefined
  const action = segments?.[0] || ''
  const fn = routes[action]
  if (!fn) {
    return res.status(404).json({
      error: `Unknown action: ${action || '(empty)'}`,
      available: Object.keys(routes),
    })
  }
  return fn(req, res)
}
