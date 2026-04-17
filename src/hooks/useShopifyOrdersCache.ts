import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, supabaseConfigured } from '@/lib/supabase'

export interface ShopifyOrderItem {
  id: string
  shopify_order_id: bigint
  order_date: string
  title: string
  variant_title: string | null
  sku: string | null
  quantity: number
  price: number | null
}

export interface ShopifyOrderCache {
  id: string
  shopify_order_id: bigint
  order_date: string
  items_count: number
  total_price: number | null
  created_at: string
  updated_at: string
}

export interface SyncStatus {
  id: string
  last_sync_date: string | null
  last_sync_timestamp: string | null
  sync_from_date: string
  sync_to_date: string
  total_orders_synced: number
  status: 'pending' | 'syncing' | 'completed' | 'failed'
  error_message: string | null
}

// ── Fetch all cached orders ──
export function useShopifyOrdersCache(dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['shopify-orders-cache', dateFrom, dateTo],
    enabled: supabaseConfigured,
    queryFn: async () => {
      let query = supabase
        .from('shopify_orders_cache')
        .select('*')
        .order('order_date', { ascending: false })

      if (dateFrom) query = query.gte('order_date', dateFrom)
      if (dateTo) query = query.lte('order_date', dateTo)

      const { data, error } = await query
      if (error) throw error
      return (data || []) as ShopifyOrderCache[]
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  })
}

// ── Fetch cached order items ──
export function useShopifyOrderItems(dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['shopify-order-items', dateFrom, dateTo],
    enabled: supabaseConfigured,
    queryFn: async () => {
      let query = supabase
        .from('shopify_order_items')
        .select('*')
        .order('order_date', { ascending: false })

      if (dateFrom) query = query.gte('order_date', dateFrom)
      if (dateTo) query = query.lte('order_date', dateTo)

      const { data, error } = await query
      if (error) throw error
      return (data || []) as ShopifyOrderItem[]
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  })
}

// ── Save orders to cache ──
export function useSaveOrdersCache() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (orders: Array<{
      shopify_order_id: bigint
      order_date: string
      items_count: number
      total_price: number | null
      order_json: Record<string, any>
      items: Array<{
        title: string
        variant_title: string | null
        sku: string | null
        quantity: number
        price: number | null
      }>
    }>) => {
      // Insert main orders
      const { data: orderData, error: orderError } = await supabase
        .from('shopify_orders_cache')
        .upsert(
          orders.map(o => ({
            shopify_order_id: o.shopify_order_id,
            order_date: o.order_date,
            items_count: o.items_count,
            total_price: o.total_price,
            order_json: o.order_json,
          })),
          { onConflict: 'shopify_order_id' }
        )
        .select()

      if (orderError) throw orderError

      // Insert items
      const itemsToInsert = orders
        .flatMap((order, idx) =>
          order.items.map(item => ({
            order_cache_id: orderData?.[idx]?.id,
            shopify_order_id: order.shopify_order_id,
            order_date: order.order_date,
            title: item.title,
            variant_title: item.variant_title,
            sku: item.sku,
            quantity: item.quantity,
            price: item.price,
          }))
        )
        .filter(item => item.order_cache_id)

      if (itemsToInsert.length > 0) {
        const { error: itemError } = await supabase
          .from('shopify_order_items')
          .insert(itemsToInsert)

        if (itemError) throw itemError
      }

      return orderData
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shopify-orders-cache'] })
      qc.invalidateQueries({ queryKey: ['shopify-order-items'] })
    },
  })
}

// ── Get sync status ──
export function useSyncStatus() {
  return useQuery({
    queryKey: ['shopify-sync-status'],
    enabled: supabaseConfigured,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shopify_sync_status')
        .select('*')
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return (data || null) as SyncStatus | null
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// ── Update sync status ──
export function useUpdateSyncStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (status: Partial<SyncStatus>) => {
      const { data, error } = await supabase
        .from('shopify_sync_status')
        .update({
          ...status,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shopify-sync-status'] })
    },
  })
}

// ── Clear cache (for full resync) ──
export function useClearOrdersCache() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      // Delete all items first (cascade)
      const { error } = await supabase
        .from('shopify_orders_cache')
        .delete()
        .neq('id', '')  // Delete all

      if (error) throw error

      // Reset sync status
      await supabase
        .from('shopify_sync_status')
        .update({
          last_sync_date: null,
          last_sync_timestamp: null,
          total_orders_synced: 0,
          status: 'pending',
          error_message: null,
        })
        .single()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shopify-orders-cache'] })
      qc.invalidateQueries({ queryKey: ['shopify-order-items'] })
      qc.invalidateQueries({ queryKey: ['shopify-sync-status'] })
    },
  })
}

// ── Get sync settings ──
export function useSyncSettings() {
  return useQuery({
    queryKey: ['shopify-sync-settings'],
    enabled: supabaseConfigured,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shopify_sync_settings')
        .select('key, value')

      if (error) throw error

      const settings: Record<string, string> = {}
      for (const item of data || []) {
        settings[item.key] = item.value
      }
      return settings
    },
  })
}

// ── Update sync settings ──
export function useUpdateSyncSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (settings: Record<string, string>) => {
      const updates = Object.entries(settings).map(([key, value]) => ({
        key,
        value,
      }))

      const { error } = await supabase
        .from('shopify_sync_settings')
        .upsert(updates, { onConflict: 'key' })

      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shopify-sync-settings'] })
    },
  })
}
