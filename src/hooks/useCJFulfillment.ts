/**
 * useCJFulfillment — React Query hooks cho module CJ Dropshipping.
 *
 * Exports:
 *  - useCJStatus()     — GET /api/cj/status
 *  - useCJWallet()     — GET /api/cj/wallet
 *  - useCJOrders()     — GET /api/cj/orders
 *  - useCJSkuMap()     — GET /api/cj/sku-map
 *  - useCJActions()    — mutation helpers: fulfill, upsertMap, deleteMap
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { QUERY_STALE } from '@/lib/queryDefaults'

// ── Types ────────────────────────────────────────────────

export interface CJStatusResponse {
  connected: boolean
  reason?: string
  wallet?: { amount: number; currency: string; frozen: number }
}

export interface CJWalletResponse {
  amount: number
  currency: string
  frozen: number
  low_balance: boolean
  min_balance_threshold: number
}

export interface CJOrderRow {
  id: string
  shopify_order_id: number
  shopify_order_number: string
  cj_order_id: string | null
  cj_order_number: string | null
  status:
    | 'queued'
    | 'submitted'
    | 'paid'
    | 'in_production'
    | 'shipped'
    | 'delivered'
    | 'cancelled'
    | 'error'
  cost_usd: number | null
  shipping_cost_usd: number | null
  ship_to_name: string | null
  ship_to_country: string | null
  error_message: string | null
  queued_at: string
  submitted_at: string | null
  shipped_at: string | null
  delivered_at: string | null
  cj_shipments?: Array<{
    tracking_number: string
    carrier: string | null
    shipment_status: string | null
    pushed_to_shopify: boolean
  }>
}

export interface CJProductMapRow {
  id: string
  shopify_product_id: number | null
  shopify_variant_id: number
  shopify_sku: string | null
  shopify_title: string | null
  cj_product_id: string
  cj_variant_id: string
  cj_sku: string | null
  cj_product_name: string | null
  cj_cost_usd: number | null
  is_pod: boolean
  pod_front_url: string | null
  pod_back_url: string | null
  pod_mockup_url: string | null
  status: 'active' | 'paused' | 'archived'
  notes: string | null
  created_at: string
  updated_at: string
}

// ── Fetchers ─────────────────────────────────────────────

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
  return json
}

// ── Queries ──────────────────────────────────────────────

export function useCJStatus() {
  return useQuery<CJStatusResponse>({
    queryKey: ['cj', 'status'],
    queryFn: () => fetchJSON('/api/cj/status'),
    staleTime: QUERY_STALE.shortLived,
  })
}

export function useCJWallet() {
  return useQuery<CJWalletResponse>({
    queryKey: ['cj', 'wallet'],
    queryFn: () => fetchJSON('/api/cj/wallet'),
    staleTime: QUERY_STALE.shortLived,
  })
}

export function useCJOrders(opts: { status?: string[]; limit?: number } = {}) {
  const params = new URLSearchParams()
  if (opts.status?.length) params.set('status', opts.status.join(','))
  if (opts.limit) params.set('limit', String(opts.limit))
  const q = params.toString()
  return useQuery<CJOrderRow[]>({
    queryKey: ['cj', 'orders', opts],
    queryFn: () => fetchJSON(`/api/cj/orders${q ? `?${q}` : ''}`),
  })
}

export function useCJSkuMap() {
  return useQuery<CJProductMapRow[]>({
    queryKey: ['cj', 'sku-map'],
    queryFn: () => fetchJSON('/api/cj/sku-map'),
  })
}

// ── Mutations ────────────────────────────────────────────

export function useCJFulfillOrder() {
  const qc = useQueryClient()
  return useMutation<
    { success: boolean; cjOrderId: string; cjOrderNum: string; status: string },
    Error,
    { shopifyOrderId: number }
  >({
    mutationFn: (body) =>
      fetchJSON('/api/cj/fulfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cj', 'orders'] })
      qc.invalidateQueries({ queryKey: ['cj', 'wallet'] })
    },
  })
}

export function useCJUpsertMap() {
  const qc = useQueryClient()
  return useMutation<CJProductMapRow, Error, Partial<CJProductMapRow>>({
    mutationFn: (row) =>
      fetchJSON('/api/cj/sku-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(row),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cj', 'sku-map'] }),
  })
}

export function useCJDeleteMap() {
  const qc = useQueryClient()
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: (id) => fetchJSON(`/api/cj/sku-map?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cj', 'sku-map'] }),
  })
}

// ── Utilities ────────────────────────────────────────────

export const CJ_STATUS_BADGE: Record<CJOrderRow['status'], { label: string; color: string }> = {
  queued: { label: 'Queued', color: 'bg-slate-500' },
  submitted: { label: 'Submitted', color: 'bg-blue-500' },
  paid: { label: 'Paid', color: 'bg-indigo-500' },
  in_production: { label: 'In Production', color: 'bg-purple-500' },
  shipped: { label: 'Shipped', color: 'bg-cyan-500' },
  delivered: { label: 'Delivered', color: 'bg-green-500' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-500' },
  error: { label: 'Error', color: 'bg-red-500' },
}
