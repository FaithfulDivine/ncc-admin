import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { QUERY_STALE } from '@/lib/queryDefaults'

// ── Types ──
export interface CogsMapping {
  id: string
  product_title: string     // Supplier name (e.g. "US Unisex T-shirt 2D")
  sku: string | null
  variant_title: string | null  // Size (e.g. "S", "M", "L")
  base_cost: number
  shipping_cost: number
  shipping_extra: number
  shopify_variant_name: string  // Mapped Shopify variant name for P&L matching
  created_at?: string
}

export interface CogsGroup {
  style: string                 // Supplier name (product_title)
  shopifyVariant: string        // Shopify variant name mapping
  items: CogsMapping[]
}

// ── Fetch all COGS mappings ──
export function useCogsMapping() {
  return useQuery({
    queryKey: ['cogs-mapping'],
    enabled: supabaseConfigured,
    // COGS mapping ít đổi trong phiên làm việc → staleTime dài, tránh refetch
    // mỗi lần mount trang khác nhau (PnL + Cogs cùng dùng hook này).
    staleTime: QUERY_STALE.longLived,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cogs_mapping')
        .select('id, product_title, sku, variant_title, base_cost, shipping_cost, shipping_extra, shopify_variant_name, created_at')
        .order('product_title')
      if (error) throw error
      return (data || []) as CogsMapping[]
    },
  })
}

// ── Save (create/update) a single COGS row ──
export function useSaveCogs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (row: Partial<CogsMapping> & { product_title: string; base_cost: number; shipping_cost: number }) => {
      const payload = {
        product_title: row.product_title,
        sku: row.sku || null,
        variant_title: row.variant_title || null,
        base_cost: Number(row.base_cost),
        extra_cost: 0,
        shipping_cost: Number(row.shipping_cost),
        shipping_extra: Number(row.shipping_extra || 0),
        shopify_variant_name: row.shopify_variant_name || '',
      }

      if (row.id) {
        const { data, error } = await supabase
          .from('cogs_mapping')
          .update(payload)
          .eq('id', row.id)
          .select()
        if (error) throw error
        return data?.[0]
      } else {
        const { data, error } = await supabase
          .from('cogs_mapping')
          .insert(payload)
          .select()
        if (error) throw error
        return data?.[0]
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cogs-mapping'] }),
  })
}

// ── Update shopify_variant_name for a whole group ──
export function useUpdateGroupMapping() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ productTitle, shopifyVariantName }: { productTitle: string; shopifyVariantName: string }) => {
      const { error } = await supabase
        .from('cogs_mapping')
        .update({ shopify_variant_name: shopifyVariantName, updated_at: new Date().toISOString() })
        .eq('product_title', productTitle)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cogs-mapping'] }),
  })
}

// ── Delete a single COGS row ──
export function useDeleteCogs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cogs_mapping').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cogs-mapping'] }),
  })
}

// ── Delete entire group by IDs ──
export function useDeleteCogsGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('cogs_mapping').delete().in('id', ids)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cogs-mapping'] }),
  })
}

// ═══════════════════════════════════════
// ── COGS Exclusions (upsells, add-ons) ──
// ═══════════════════════════════════════

export interface CogsExclusion {
  id: string
  pattern: string
  reason: string | null
  created_at?: string
}

export function useCogsExclusions() {
  return useQuery({
    queryKey: ['cogs-exclusions'],
    enabled: supabaseConfigured,
    staleTime: QUERY_STALE.longLived,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cogs_exclusions')
        .select('*')
        .order('pattern')
      if (error) throw error
      return (data || []) as CogsExclusion[]
    },
  })
}

export function useSaveExclusion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (row: { id?: string; pattern: string; reason?: string }) => {
      if (row.id) {
        const { error } = await supabase
          .from('cogs_exclusions')
          .update({ pattern: row.pattern, reason: row.reason || null })
          .eq('id', row.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('cogs_exclusions')
          .insert({ pattern: row.pattern, reason: row.reason || null })
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cogs-exclusions'] }),
  })
}

export function useDeleteExclusion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cogs_exclusions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cogs-exclusions'] }),
  })
}

// ═══════════════════════════════════════
// ── Physical Products (manual COGS) ──
// ═══════════════════════════════════════

export interface PhysicalProduct {
  id: string
  product_name: string
  variant: string | null
  base_cost: number
  shipping_cost: number
  shipping_extra: number
  notes: string | null
  created_at?: string
}

export function usePhysicalProducts() {
  return useQuery({
    queryKey: ['cogs-physical'],
    enabled: supabaseConfigured,
    staleTime: QUERY_STALE.longLived,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cogs_physical_products')
        .select('*')
        .order('product_name')
      if (error) throw error
      return (data || []) as PhysicalProduct[]
    },
  })
}

export function useSavePhysicalProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (row: Partial<PhysicalProduct> & { product_name: string }) => {
      const payload = {
        product_name: row.product_name,
        variant: row.variant || null,
        base_cost: Number(row.base_cost || 0),
        shipping_cost: Number(row.shipping_cost || 0),
        shipping_extra: Number(row.shipping_extra || 0),
        notes: row.notes || null,
        updated_at: new Date().toISOString(),
      }
      if (row.id) {
        const { error } = await supabase.from('cogs_physical_products').update(payload).eq('id', row.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('cogs_physical_products').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cogs-physical'] }),
  })
}

export function useDeletePhysicalProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cogs_physical_products').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cogs-physical'] }),
  })
}
