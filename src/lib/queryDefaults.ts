/**
 * TanStack Query default constants
 * =================================
 * Mục tiêu: đồng nhất staleTime / gcTime / refetchInterval trong toàn bộ app,
 * tránh "set số đại" rải rác mỗi hook một kiểu. Khi cần điều chỉnh toàn cục,
 * chỉ sửa 1 file này.
 *
 * Quy ước chọn mức cho mỗi query:
 *
 *   - QUERY_STALE.shortLived   (1 min)  — counters, status, "đang chạy",
 *                                          config thay đổi theo phiên làm.
 *   - QUERY_STALE.medium       (5 min)  — default cho app (đã set ở main.tsx).
 *                                          Settings, small-config, list ngắn.
 *   - QUERY_STALE.longLived    (30 min) — COGS mapping, product map, style
 *                                          mapping, dữ liệu ít khi đổi
 *                                          trong phiên.
 *   - QUERY_STALE.historical   (1 h)    — Orders cache, P&L snapshot, ad
 *                                          spend lịch sử — dữ liệu immutable
 *                                          cho date range cố định.
 *
 *   - QUERY_GC.default         (10 min) — giữ cached data 2× staleTime default.
 *   - QUERY_GC.long            (1 h)    — cho query đắt (orders cache)
 *                                          để tránh refetch khi user quay lại.
 *
 *   - REFETCH_INTERVAL.live    (15 s)   — dashboard "live" (ad curator runs).
 *   - REFETCH_INTERVAL.frequent(30 s)
 *   - REFETCH_INTERVAL.moderate(60 s)
 */

export const QUERY_STALE = {
  shortLived: 60 * 1000,
  medium: 5 * 60 * 1000,
  longLived: 30 * 60 * 1000,
  historical: 60 * 60 * 1000,
} as const

export const QUERY_GC = {
  default: 10 * 60 * 1000,
  long: 60 * 60 * 1000,
} as const

export const REFETCH_INTERVAL = {
  live: 15 * 1000,
  frequent: 30 * 1000,
  moderate: 60 * 1000,
} as const

export type QueryStaleKey = keyof typeof QUERY_STALE
export type QueryGcKey = keyof typeof QUERY_GC
export type RefetchIntervalKey = keyof typeof REFETCH_INTERVAL
