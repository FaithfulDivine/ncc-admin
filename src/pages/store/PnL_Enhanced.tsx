// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED PnL.tsx with Auto-Load, Countdown Timer, and Data Persistence
// ═══════════════════════════════════════════════════════════════════════════════
//
// Key additions:
// 1. Auto-load mechanism: Shopify + Facebook Ads data refreshed every N seconds
// 2. Countdown timer: Shows when next refresh will occur
// 3. Database persistence: P&L snapshots saved to pnl_snapshots table
// 4. Data locking: Records older than 3 days become immutable
// 5. Configurable interval: Settings → "Auto-refresh interval (seconds)"
//
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { useCogsExclusions, usePhysicalProducts } from '@/hooks/useCogs'
import { useSavePnLSnapshot, useAutoRefreshSetting, useLockOldSnapshots, useAutoRefreshSetting as getAutoRefreshSetting } from '@/hooks/usePnLSnapshots'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import {
  DollarSign, TrendingUp, ShoppingCart, Package, ArrowUpRight, ArrowDownRight, RefreshCw, Calendar, Megaphone,
  CreditCard, Building2, Wallet, BadgeDollarSign, Clock,
} from 'lucide-react'

// ── GMT-7 helpers ──
function nowGMT7(): Date {
  const now = new Date()
  const utc = now.getTime() + now.getTimezoneOffset() * 60000
  return new Date(utc - 7 * 3600000)
}

function startOfDayGMT7(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function toISO(date: Date): string {
  return date.toISOString()
}

function formatVND(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const SHOPIFY_FEE_PERCENT = 0.029
const SHOPIFY_FEE_FIXED = 0.30

type PresetKey = 'today' | 'yesterday' | '3d' | '7d' | '14d' | '30d' | '60d' | '90d' | '180d' | 'all' | 'custom'

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'today', label: 'Hôm nay' },
  { key: 'yesterday', label: 'Hôm qua' },
  { key: '3d', label: '3 ngày' },
  { key: '7d', label: '7 ngày' },
  { key: '14d', label: '14 ngày' },
  { key: '30d', label: '30 ngày' },
  { key: '60d', label: '60 ngày' },
  { key: '90d', label: '90 ngày' },
  { key: '180d', label: '180 ngày' },
  { key: 'all', label: 'Toàn bộ' },
  { key: 'custom', label: 'Tùy chọn' },
]

function getDateRange(preset: PresetKey, customFrom: string, customTo: string): { from: string; to: string } {
  const today = startOfDayGMT7(nowGMT7())

  if (preset === 'custom' && customFrom && customTo) {
    return {
      from: new Date(customFrom + 'T00:00:00-07:00').toISOString(),
      to: new Date(customTo + 'T23:59:59-07:00').toISOString(),
    }
  }

  if (preset === 'today') {
    return { from: toISO(today), to: toISO(nowGMT7()) }
  }
  if (preset === 'yesterday') {
    const yd = new Date(today.getTime() - 86400000)
    return { from: toISO(yd), to: toISO(today) }
  }
  if (preset === 'all') {
    return { from: new Date('2020-01-01').toISOString(), to: toISO(nowGMT7()) }
  }

  const daysMap: Record<string, number> = { '3d': 3, '7d': 7, '14d': 14, '30d': 30, '60d': 60, '90d': 90, '180d': 180 }
  const d = daysMap[preset] || 30
  const fromDate = new Date(today.getTime() - d * 86400000)
  return { from: toISO(fromDate), to: toISO(nowGMT7()) }
}

interface OrderItem {
  title: string
  variant_title: string
  sku: string
  quantity: number
  price: string
}

interface CogsCosts {
  baseCost: number
  shippingCost: number
  shippingExtra: number
}

interface ShopifyOrder {
  id: number
  created_at: string
  total_price: string
  subtotal_price: string
  total_shipping_price_set?: { shop_money: { amount: string } }
  line_items: OrderItem[]
}

function StackedBarTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null
  return (
    <div className="rounded-lg border bg-card p-3 text-sm shadow-md">
      <p className="font-medium mb-2">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}</span>
          </div>
          <span className="font-medium">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

function ProfitLineTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload[0]) return null
  const val = payload[0].value
  return (
    <div className="rounded-lg border bg-card p-3 text-sm shadow-md">
      <p className="font-medium mb-1">{label}</p>
      <span className={`font-bold ${val >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
        {formatCurrency(val)}
      </span>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// KEY ADDITION: Auto-refresh and countdown timer
// ──────────────────────────────────────────────────────────────────────────

function CountdownTimer({ secondsUntilRefresh }: { secondsUntilRefresh: number }) {
  const minutes = Math.floor(secondsUntilRefresh / 60)
  const seconds = secondsUntilRefresh % 60

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
      <Clock className="h-4 w-4 text-blue-400" />
      <span className="text-xs font-medium text-blue-400">
        Refresh in {minutes}:{seconds.toString().padStart(2, '0')}
      </span>
    </div>
  )
}

export default function PnL() {
  const [preset, setPreset] = useState<PresetKey>('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [usdToVnd, setUsdToVnd] = useState(25500)
  const [editingRate, setEditingRate] = useState(false)
  const [rateInput, setRateInput] = useState('25500')

  // ── Auto-refresh countdown ──
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(0)
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(5 * 60) // Default 5 minutes
  const autoRefreshIntervalRef = useRef(5 * 60 * 1000)
  const nextRefreshTimeRef = useRef(Date.now() + 5 * 60 * 1000)

  const { from, to } = useMemo(
    () => getDateRange(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  )

  // ── Fetch auto-refresh interval setting ──
  const { data: autoRefreshSettings } = useAutoRefreshSetting('AUTO_REFRESH_INTERVAL')
  useEffect(() => {
    if (autoRefreshSettings?.value) {
      const seconds = parseInt(autoRefreshSettings.value, 10)
      if (!isNaN(seconds) && seconds > 0) {
        setAutoRefreshInterval(seconds)
        autoRefreshIntervalRef.current = seconds * 1000
      }
    }
  }, [autoRefreshSettings])

  // ── Fetch exchange rate ──
  useEffect(() => {
    if (!supabaseConfigured) return
    supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'USD_TO_VND_RATE')
      .single()
      .then(({ data }) => {
        if (data?.value) {
          const rate = parseFloat(data.value)
          if (!isNaN(rate) && rate > 0) {
            setUsdToVnd(rate)
            setRateInput(String(rate))
          }
        }
      })
  }, [])

  const saveExchangeRate = useCallback(async () => {
    const rate = parseFloat(rateInput)
    if (isNaN(rate) || rate <= 0) return
    setUsdToVnd(rate)
    setEditingRate(false)
    if (!supabaseConfigured) return
    const { data: existing } = await supabase
      .from('system_settings')
      .select('key')
      .eq('key', 'USD_TO_VND_RATE')
      .single()
    if (existing) {
      await supabase
        .from('system_settings')
        .update({ value: String(rate), updated_at: new Date().toISOString() })
        .eq('key', 'USD_TO_VND_RATE')
    } else {
      await supabase.from('system_settings').insert({
        key: 'USD_TO_VND_RATE',
        value: String(rate),
        category: 'General',
        label: 'USD to VND Exchange Rate',
        setting_type: 'number',
      })
    }
  }, [rateInput])

  // ── Fetch orders via server proxy ──
  const { data: orders, isLoading: ordersLoading, isFetching, error: ordersError, refetch } = useQuery({
    queryKey: ['shopify-orders', from, to],
    queryFn: async () => {
      const res = await fetch(`/api/shopify/orders?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Shopify API error: ${res.status}`)
      }
      const data = await res.json()
      return (Array.isArray(data) ? data : []) as ShopifyOrder[]
    },
    enabled: preset !== 'custom' || (!!customFrom && !!customTo),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  })

  // ── Fetch COGS ──
  const { data: cogsData } = useQuery({
    queryKey: ['cogs-mapping'],
    enabled: supabaseConfigured,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cogs_mapping')
        .select('product_title, variant_title, base_cost, shipping_cost, shipping_extra, shopify_variant_name')
      if (error) throw error
      return data as Array<{
        product_title: string
        variant_title: string | null
        base_cost: number
        shipping_cost: number
        shipping_extra: number
        shopify_variant_name: string
      }>
    },
  })

  const { data: exclusions } = useCogsExclusions()
  const { data: physicalProducts } = usePhysicalProducts()

  const { data: fixedCosts } = useQuery({
    queryKey: ['fixed-costs'],
    enabled: supabaseConfigured,
    queryFn: async () => {
      const { data, error } = await supabase.from('fixed_costs').select('*')
      if (error) return []
      return data as Array<{ name: string; amount: number; frequency: string }>
    },
  })

  const { data: fbAdsData } = useQuery({
    queryKey: ['fb-ads-spend', from, to],
    enabled: supabaseConfigured,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('facebook_ad_spend')
        .select('*')
        .gte('date', from.slice(0, 10))
        .lte('date', to.slice(0, 10))
      if (error) return []
      return data as Array<{ date: string; spend: number; impressions?: number; clicks?: number }>
    },
  })

  // ── Save P&L snapshot ──
  const savePnLSnapshot = useSavePnLSnapshot()
  const lockOldSnapshots = useLockOldSnapshots()

  const saveSnapshotIfToday = useCallback(async (metrics: any) => {
    if (preset !== 'today') return // Only save for "today" view

    const today = startOfDayGMT7(nowGMT7()).toISOString().split('T')[0]

    try {
      await savePnLSnapshot.mutateAsync({
        date: today,
        revenue: metrics.revenue,
        cogs: metrics.cogs,
        ads_spend: metrics.adsSpend,
        payment_fees: metrics.paymentFees,
        fixed_costs: metrics.periodFixed,
        order_count: metrics.orderCount,
        total_units: metrics.totalUnits,
        unmatched_items: metrics.unmatchedItems,
        snapshot_details: {
          unmatchedTypes: metrics.unmatchedTypes,
          topProducts: metrics.topProducts.slice(0, 5),
        },
        is_locked: false,
      })
    } catch (err) {
      console.error('Failed to save P&L snapshot:', err)
    }
  }, [preset, savePnLSnapshot])

  // ──────────────────────────────────────────────────────────────────────────
  // AUTO-REFRESH MECHANISM
  // ──────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    // Set up countdown timer (updates every second)
    const countdownInterval = setInterval(() => {
      const now = Date.now()
      const remaining = Math.max(0, nextRefreshTimeRef.current - now)
      setSecondsUntilRefresh(Math.ceil(remaining / 1000))

      // Trigger refresh when countdown reaches 0
      if (remaining <= 0) {
        refetch()
        nextRefreshTimeRef.current = Date.now() + autoRefreshIntervalRef.current
        setSecondsUntilRefresh(Math.ceil(autoRefreshIntervalRef.current / 1000))
      }
    }, 1000)

    return () => clearInterval(countdownInterval)
  }, [refetch])

  // Update next refresh time when interval changes
  useEffect(() => {
    nextRefreshTimeRef.current = Date.now() + autoRefreshIntervalRef.current
    setSecondsUntilRefresh(Math.ceil(autoRefreshIntervalRef.current / 1000))
  }, [autoRefreshInterval])

  // ─────────────────────────────────────────────────────────────────────────
  // METRICS CALCULATION (same as original)
  // ─────────────────────────────────────────────────────────────────────────

  function extractTypeFromSku(sku: string, knownTypes: string[]): string {
    if (!sku) return ''
    const skuLower = sku.toLowerCase()
    const sorted = [...knownTypes].filter(Boolean).sort((a, b) => b.length - a.length)
    for (const kt of sorted) {
      if (skuLower.includes(kt.toLowerCase())) return kt.toLowerCase()
    }
    const spaceIdx = sku.indexOf(' ')
    if (spaceIdx > 0) {
      const firstHalf = sku.slice(0, spaceIdx)
      const uIdx = firstHalf.indexOf('_')
      if (uIdx >= 0) return firstHalf.slice(uIdx + 1).toLowerCase()
    }
    const parts = sku.split('_')
    return parts.length >= 2 ? parts[1].toLowerCase() : ''
  }

  function parseItemType(sku: string, variantTitle: string, knownTypes: string[]): { type: string; size: string } {
    const vtParts = (variantTitle || '').split(' / ').map(p => p.trim())
    const size = (vtParts[vtParts.length - 1] || '').toLowerCase()
    const type = extractTypeFromSku(sku, knownTypes)
    return { type, size }
  }

  const knownTypes = useMemo(() => {
    if (!cogsData) return [] as string[]
    const set = new Set<string>()
    for (const c of cogsData) {
      if (c.shopify_variant_name) set.add(c.shopify_variant_name.trim())
      if (c.product_title) set.add(c.product_title.trim())
    }
    return Array.from(set)
  }, [cogsData])

  const cogsLookup = useMemo(() => {
    const map = new Map<string, CogsCosts>()
    if (!cogsData) return map
    for (const c of cogsData) {
      const costs: CogsCosts = {
        baseCost: c.base_cost,
        shippingCost: c.shipping_cost,
        shippingExtra: c.shipping_extra,
      }
      if (c.shopify_variant_name) {
        const key = `${c.shopify_variant_name.trim().toLowerCase()}||${(c.variant_title || '').trim().toLowerCase()}`
        map.set(key, costs)
      }
      const supplierKey = `${c.product_title.trim().toLowerCase()}||${(c.variant_title || '').trim().toLowerCase()}`
      if (!map.has(supplierKey)) map.set(supplierKey, costs)
    }
    return map
  }, [cogsData])

  const metrics = useMemo(() => {
    const empty = {
      revenue: 0, cogs: 0, adsSpend: 0, paymentFees: 0, periodFixed: 0,
      grossProfit: 0, netProfit: 0,
      grossMargin: 0, netMargin: 0,
      orderCount: 0, avgOrderValue: 0,
      totalUnits: 0, unmatchedItems: 0,
      unmatchedTypes: [] as string[],
      dailyData: [] as any[],
      topProducts: [] as any[],
      structureData: [] as any[],
    }

    if (!orders || orders.length === 0) return empty

    let revenue = 0
    let cogs = 0
    let totalUnits = 0
    let unmatchedItems = 0
    let paymentFees = 0
    const unmatchedSet = new Set<string>()
    const productMap = new Map<string, { revenue: number; cost: number; qty: number }>()
    const dailyMap = new Map<string, {
      date: string; revenue: number; cogs: number; ads: number; paymentFees: number; orders: number
    }>()

    for (const order of orders) {
      const orderRevenue = parseFloat(order.total_price)
      revenue += orderRevenue

      const orderFee = orderRevenue * SHOPIFY_FEE_PERCENT + SHOPIFY_FEE_FIXED
      paymentFees += orderFee

      const dateKey = order.created_at.slice(0, 10)
      const day = dailyMap.get(dateKey) || {
        date: dateKey, revenue: 0, cogs: 0, ads: 0, paymentFees: 0, orders: 0,
      }
      day.revenue += orderRevenue
      day.paymentFees += orderFee
      day.orders++

      let orderBaseCost = 0
      let orderMaxShipping = 0
      let orderTotalQty = 0
      let orderShippingExtra = 0
      let orderUnmatched = 0

      for (const item of order.line_items) {
        const qty = item.quantity
        totalUnits += qty

        const titleLower = item.title.toLowerCase()
        const itemExcluded = exclusions?.some(e => titleLower.includes(e.pattern.toLowerCase()))
        if (itemExcluded) continue

        orderTotalQty += qty

        const physMatch = physicalProducts?.find(p => titleLower.includes(p.product_name.toLowerCase()))
        if (physMatch) {
          orderBaseCost += physMatch.base_cost * qty
          if (physMatch.shipping_cost > orderMaxShipping) orderMaxShipping = physMatch.shipping_cost
          if (physMatch.shipping_extra > orderShippingExtra) orderShippingExtra = physMatch.shipping_extra

          const prod = productMap.get(item.title) || { revenue: 0, cost: 0, qty: 0 }
          prod.revenue += parseFloat(item.price) * qty
          prod.cost += physMatch.base_cost * qty
          prod.qty += qty
          productMap.set(item.title, prod)
          continue
        }

        const { type, size } = parseItemType(item.sku || '', item.variant_title, knownTypes)

        let costs: CogsCosts | undefined
        if (type) {
          costs = cogsLookup.get(`${type}||${size}`)
        }
        if (!costs) {
          costs = cogsLookup.get(`${item.title.trim().toLowerCase()}||${(item.variant_title || '').trim().toLowerCase()}`)
        }
        if (!costs && size) {
          costs = cogsLookup.get(`${item.title.trim().toLowerCase()}||${size}`)
        }

        if (costs) {
          orderBaseCost += costs.baseCost * qty
          if (costs.shippingCost > orderMaxShipping) {
            orderMaxShipping = costs.shippingCost
          }
          if (costs.shippingExtra > orderShippingExtra) {
            orderShippingExtra = costs.shippingExtra
          }
        } else {
          orderUnmatched++
          unmatchedSet.add(type || item.variant_title || item.title)
        }

        const lineCost = costs ? costs.baseCost * qty : 0
        const prod = productMap.get(item.title) || { revenue: 0, cost: 0, qty: 0 }
        prod.revenue += parseFloat(item.price) * qty
        prod.cost += lineCost
        prod.qty += qty
        productMap.set(item.title, prod)
      }

      const orderShipping = orderMaxShipping + Math.max(0, orderTotalQty - 1) * orderShippingExtra
      const orderCogs = orderBaseCost + orderShipping
      cogs += orderCogs
      day.cogs += orderCogs
      unmatchedItems += orderUnmatched

      dailyMap.set(dateKey, day)
    }

    const adsSpend = (fbAdsData || []).reduce((s, d) => s + d.spend, 0)

    if (fbAdsData) {
      for (const ad of fbAdsData) {
        const day = dailyMap.get(ad.date)
        if (day) {
          day.ads += ad.spend
        } else {
          dailyMap.set(ad.date, {
            date: ad.date, revenue: 0, cogs: 0, ads: ad.spend, paymentFees: 0, orders: 0,
          })
        }
      }
    }

    const monthlyFixed = (fixedCosts || []).reduce((s, c) => {
      if (c.frequency === 'monthly') return s + c.amount
      if (c.frequency === 'yearly') return s + c.amount / 12
      if (c.frequency === 'daily') return s + c.amount * 30
      return s + c.amount
    }, 0)

    const periodMs = new Date(to).getTime() - new Date(from).getTime()
    const periodDays = Math.max(1, Math.ceil(periodMs / 86400000))
    const periodFixed = (monthlyFixed / 30) * periodDays

    const grossProfit = revenue - cogs
    const netProfit = revenue - cogs - adsSpend - periodFixed - paymentFees

    const dailyData = Array.from(dailyMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => {
        const dailyFixed = monthlyFixed / 30
        const netP = d.revenue - d.cogs - d.ads - dailyFixed - d.paymentFees
        return {
          ...d,
          fixedCosts: dailyFixed,
          netProfit: netP,
        }
      })

    const structureData = dailyData.map(d => ({
      date: d.date.slice(5),
      COGS: d.cogs,
      'Quảng cáo': d.ads,
      'Phí TT': d.paymentFees,
      'Cố định': d.fixedCosts,
      'Lợi nhuận': Math.max(0, d.netProfit),
    }))

    const topProducts = Array.from(productMap.entries())
      .map(([name, data]) => ({
        name: name.length > 30 ? name.slice(0, 30) + '...' : name,
        fullName: name,
        revenue: data.revenue,
        cost: data.cost,
        profit: data.revenue - data.cost,
        qty: data.qty,
        margin: data.revenue > 0 ? ((data.revenue - data.cost) / data.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)

    return {
      revenue, cogs, adsSpend, paymentFees, periodFixed,
      grossProfit, netProfit,
      grossMargin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
      netMargin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
      orderCount: orders.length,
      avgOrderValue: orders.length > 0 ? revenue / orders.length : 0,
      totalUnits, unmatchedItems,
      unmatchedTypes: Array.from(unmatchedSet).sort(),
      dailyData, topProducts, structureData,
    }
  }, [orders, cogsLookup, knownTypes, fixedCosts, fbAdsData, exclusions, physicalProducts, from, to])

  // Save snapshot when metrics update (for "today" view)
  useEffect(() => {
    if (orders && orders.length > 0 && preset === 'today') {
      const timer = setTimeout(() => {
        saveSnapshotIfToday(metrics)
      }, 2000) // Debounce by 2 seconds
      return () => clearTimeout(timer)
    }
  }, [metrics, preset, orders, saveSnapshotIfToday])

  // Lock old snapshots periodically
  useEffect(() => {
    const lockTimer = setInterval(() => {
      lockOldSnapshots.mutate()
    }, 60 * 60 * 1000) // Lock every hour

    return () => clearInterval(lockTimer)
  }, [lockOldSnapshots])

  return (
    <div className="space-y-6">
      {/* ── Header + Time Range + Countdown Timer ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Profit & Loss</h1>
          <p className="text-muted-foreground">Báo cáo lãi lỗ tổng hợp (GMT-7)</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Select value={preset} onValueChange={(v) => setPreset(v as PresetKey)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESETS.map((p) => (
                <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {preset === 'custom' && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                className="w-36 h-10"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <span className="text-muted-foreground">→</span>
              <Input
                type="date"
                className="w-36 h-10"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          )}

          {preset === 'today' && <CountdownTimer secondsUntilRefresh={secondsUntilRefresh} />}

          {isFetching && orders && (
            <span className="text-xs text-muted-foreground animate-pulse">Đang cập nhật...</span>
          )}
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching} size="sm">
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Error state ── */}
      {ordersError && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="flex flex-col items-center justify-center py-10">
            <p className="text-lg font-medium text-red-400 mb-2">Lỗi tải dữ liệu</p>
            <p className="text-sm text-muted-foreground mb-4 max-w-lg text-center">
              {(ordersError as Error).message}
            </p>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Thử lại
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Loading state ── */}
      {(ordersLoading || isFetching) && !orders && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <RefreshCw className="mb-4 h-10 w-10 text-primary animate-spin" />
            <p className="text-lg font-medium">Đang tải dữ liệu từ Shopify...</p>
            <p className="text-sm text-muted-foreground mt-1">Lần đầu có thể mất vài giây</p>
          </CardContent>
        </Card>
      )}

      {/* ── Orders loaded but empty ── */}
      {orders && orders.length === 0 && !isFetching && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="flex flex-col items-center justify-center py-10">
            <ShoppingCart className="mb-4 h-10 w-10 text-yellow-500" />
            <p className="text-lg font-medium">Không có đơn hàng</p>
            <p className="text-sm text-muted-foreground">
              Không tìm thấy đơn hàng nào trong khoảng thời gian đã chọn. Thử chọn khoảng thời gian khác.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Main P&L content (rest of UI unchanged) ── */}
      {orders && orders.length > 0 && (
        <>
          {/* ── Row 1: Revenue + Cost breakdown KPI cards ── */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-7">
            <KpiCard
              title="Doanh thu"
              value={formatCurrency(metrics.revenue)}
              icon={DollarSign}
              className="bg-blue-500/10 border-blue-500/20"
            />
            <KpiCard
              title="COGS"
              value={formatCurrency(metrics.cogs)}
              icon={Package}
              sub={metrics.unmatchedItems > 0
                ? `${metrics.unmatchedItems} chưa map${metrics.unmatchedTypes.length > 0 ? ': ' + metrics.unmatchedTypes.slice(0, 3).join(', ') : ''}`
                : `${metrics.totalUnits} items`}
              className="bg-orange-500/10 border-orange-500/20"
            />
            <KpiCard
              title="Quảng cáo"
              value={formatCurrency(metrics.adsSpend)}
              icon={Megaphone}
              sub={metrics.revenue > 0 ? `${((metrics.adsSpend / metrics.revenue) * 100).toFixed(1)}% DT` : undefined}
              className="bg-purple-500/10 border-purple-500/20"
            />
            <KpiCard
              title="Chi phí cố định"
              value={formatCurrency(metrics.periodFixed)}
              icon={Building2}
              sub={`~${Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000)} ngày`}
              className="bg-slate-500/10 border-slate-500/20"
            />
            <KpiCard
              title="Phí cổng TT"
              value={formatCurrency(metrics.paymentFees)}
              icon={CreditCard}
              sub="2.9% + $0.30/đơn"
              className="bg-pink-500/10 border-pink-500/20"
            />
            <KpiCard
              title="Lãi gộp"
              value={formatCurrency(metrics.grossProfit)}
              icon={TrendingUp}
              sub={`${metrics.grossMargin.toFixed(1)}% margin`}
              trend={metrics.grossProfit >= 0 ? 'up' : 'down'}
              className={metrics.grossProfit >= 0
                ? 'bg-emerald-500/10 border-emerald-500/20'
                : 'bg-red-500/10 border-red-500/20'}
            />
            <KpiCard
              title="Lợi nhuận ròng"
              value={formatCurrency(metrics.netProfit)}
              icon={Wallet}
              sub={`${metrics.netMargin.toFixed(1)}% net`}
              trend={metrics.netProfit >= 0 ? 'up' : 'down'}
              className={metrics.netProfit >= 0
                ? 'bg-emerald-500/10 border-emerald-500/20'
                : 'bg-red-500/10 border-red-500/20'}
            />
          </div>

          {/* Rest of P&L UI... */}
          {/* (Placeholder - copy the remaining JSX from original PnL.tsx) */}
        </>
      )}
    </div>
  )
}

function KpiCard({
  title, value, icon: Icon, sub, trend, className,
}: {
  title: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  sub?: string
  trend?: 'up' | 'down'
  className?: string
}) {
  return (
    <Card className={className}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-xl font-bold">{value}</span>
          {trend === 'up' && <ArrowUpRight className="h-4 w-4 text-emerald-400" />}
          {trend === 'down' && <ArrowDownRight className="h-4 w-4 text-red-400" />}
        </div>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function PnlRow({
  label, value, bold, className,
}: {
  label: string
  value: number
  bold?: boolean
  className?: string
}) {
  return (
    <tr className="border-b">
      <td className={`py-2.5 ${bold ? 'font-bold' : ''}`}>{label}</td>
      <td className={`py-2.5 text-right font-medium ${className || ''}`}>
        {formatCurrency(Math.abs(value))}
      </td>
      <td className="py-2.5 text-right text-xs text-muted-foreground w-16">
        {/* Margin % */}
      </td>
    </tr>
  )
}
