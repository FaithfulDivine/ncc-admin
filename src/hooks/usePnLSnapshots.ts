import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, supabaseConfigured } from '@/lib/supabase'

// ── Types ──
export interface PnLSnapshot {
  id: string
  date: string // YYYY-MM-DD
  revenue: number
  cogs: number
  ads_spend: number
  payment_fees: number
  fixed_costs: number
  gross_profit: number
  net_profit: number
  gross_margin: number
  net_margin: number
  order_count: number
  total_units: number
  unmatched_items: number
  snapshot_details?: Record<string, any>
  is_locked: boolean
  created_at: string
  updated_at: string
}

export interface AutoRefreshSetting {
  id: string
  key: string
  value: string
  category: string
  label: string
  setting_type: string
  created_at: string
  updated_at: string
}

// ── Fetch all P&L snapshots ──
export function usePnLSnapshots(dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['pnl-snapshots', dateFrom, dateTo],
    enabled: supabaseConfigured,
    queryFn: async () => {
      let query = supabase
        .from('pnl_snapshots')
        .select('*')
        .order('date', { ascending: false })

      if (dateFrom) query = query.gte('date', dateFrom)
      if (dateTo) query = query.lte('date', dateTo)

      const { data, error } = await query
      if (error) throw error
      return (data || []) as PnLSnapshot[]
    },
    staleTime: 1 * 60 * 1000, // 1 minute
  })
}

// ── Fetch single P&L snapshot by date ──
export function usePnLSnapshotByDate(date: string) {
  return useQuery({
    queryKey: ['pnl-snapshot', date],
    enabled: supabaseConfigured && !!date,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pnl_snapshots')
        .select('*')
        .eq('date', date)
        .single()
      if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows
      return data as PnLSnapshot | null
    },
  })
}

// ── Save/upsert P&L snapshot ──
export function useSavePnLSnapshot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (snapshot: Partial<PnLSnapshot> & { date: string }) => {
      const payload = {
        date: snapshot.date,
        revenue: Number(snapshot.revenue || 0),
        cogs: Number(snapshot.cogs || 0),
        ads_spend: Number(snapshot.ads_spend || 0),
        payment_fees: Number(snapshot.payment_fees || 0),
        fixed_costs: Number(snapshot.fixed_costs || 0),
        order_count: Number(snapshot.order_count || 0),
        total_units: Number(snapshot.total_units || 0),
        unmatched_items: Number(snapshot.unmatched_items || 0),
        snapshot_details: snapshot.snapshot_details || null,
        is_locked: snapshot.is_locked || false,
        updated_at: new Date().toISOString(),
      }

      const { data: existing } = await supabase
        .from('pnl_snapshots')
        .select('id')
        .eq('date', snapshot.date)
        .single()

      if (existing) {
        const { data, error } = await supabase
          .from('pnl_snapshots')
          .update(payload)
          .eq('date', snapshot.date)
          .select()
        if (error) throw error
        return data?.[0]
      } else {
        const { data, error } = await supabase
          .from('pnl_snapshots')
          .insert(payload)
          .select()
        if (error) throw error
        return data?.[0]
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pnl-snapshots'] })
      qc.invalidateQueries({ queryKey: ['pnl-snapshot'] })
    },
  })
}

// ── Lock snapshots older than 3 days ──
export function useLockOldSnapshots() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const threeDaysAgo = new Date()
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
      const date = threeDaysAgo.toISOString().split('T')[0]

      const { error } = await supabase
        .from('pnl_snapshots')
        .update({ is_locked: true, updated_at: new Date().toISOString() })
        .lt('date', date)
        .eq('is_locked', false)

      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pnl-snapshots'] }),
  })
}

// ── Fetch auto-refresh settings ──
export function useAutoRefreshSettings() {
  return useQuery({
    queryKey: ['auto-refresh-settings'],
    enabled: supabaseConfigured,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auto_refresh_settings')
        .select('*')
      if (error) return [] as AutoRefreshSetting[]
      return (data || []) as AutoRefreshSetting[]
    },
  })
}

// ── Get specific auto-refresh setting ──
export function useAutoRefreshSetting(key: string) {
  return useQuery({
    queryKey: ['auto-refresh-setting', key],
    enabled: supabaseConfigured && !!key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auto_refresh_settings')
        .select('*')
        .eq('key', key)
        .single()
      if (error && error.code !== 'PGRST116') throw error
      return (data || null) as AutoRefreshSetting | null
    },
  })
}

// ── Save auto-refresh setting ──
export function useSaveAutoRefreshSetting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (setting: { key: string; value: string; label?: string; category?: string }) => {
      const { data: existing } = await supabase
        .from('auto_refresh_settings')
        .select('id')
        .eq('key', setting.key)
        .single()

      const payload = {
        key: setting.key,
        value: setting.value,
        label: setting.label || '',
        category: setting.category || 'General',
        updated_at: new Date().toISOString(),
      }

      if (existing) {
        const { data, error } = await supabase
          .from('auto_refresh_settings')
          .update(payload)
          .eq('key', setting.key)
          .select()
        if (error) throw error
        return data?.[0]
      } else {
        const { data, error } = await supabase
          .from('auto_refresh_settings')
          .insert(payload)
          .select()
        if (error) throw error
        return data?.[0]
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auto-refresh-settings'] })
      qc.invalidateQueries({ queryKey: ['auto-refresh-setting'] })
    },
  })
}

// ── Get auto-refresh interval in milliseconds ──
export async function getAutoRefreshIntervalMs(): Promise<number> {
  try {
    if (!supabaseConfigured) return 5 * 60 * 1000 // Default 5 minutes

    const { data, error } = await supabase
      .from('auto_refresh_settings')
      .select('value')
      .eq('key', 'AUTO_REFRESH_INTERVAL')
      .single()

    if (error || !data?.value) return 5 * 60 * 1000
    const seconds = parseInt(data.value, 10)
    return isNaN(seconds) ? 5 * 60 * 1000 : seconds * 1000
  } catch {
    return 5 * 60 * 1000 // Fallback to 5 minutes
  }
}
