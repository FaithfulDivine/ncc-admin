import { useState, useMemo, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { useCogsExclusions, usePhysicalProducts } from '@/hooks/useCogs'
import { formatCurrency, formatNumber, formatVND } from '@/lib/utils'
import { QUERY_STALE, QUERY_GC } from '@/lib/queryDefaults'
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
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts'
import {
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Calendar,
  Megaphone,
  CreditCard,
  Building2,
  Wallet,
  BadgeDollarSign,
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

// ── Shopify payment fee: 2.9% + $0.30 per transaction ──
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

// COGS cost components per variant (for per-order shipping calculation)
interface CogsCosts {
  baseCost: number
  shippingCost: number
  shippingExtra: number
}

// Extract product type from SKU using known types from cogs_mapping
// Handles 2 SKU structures:
//   A) "{code}_{Type} {code2}_{Color}_{Size}" (space separates halves)
//   B) "{code}_{Type}_{Color}_{Size}" (underscore only)
// Strategy: match SKU against known types (longest first), fallback to split
function extractTypeFromSku(sku: string, knownTypes: string[]): string {
  if (!sku) return ''
  const skuLower = sku.toLowerCase()

  // Match against known types — longest first to avoid partial matches
  // e.g. "Premium T-shirt" matched before "T-Shirt"
  const sorted = [...knownTypes].filter(Boolean).sort((a, b) => b.length - a.length)
  for (const kt of sorted) {
    if (skuLower.includes(kt.toLowerCase())) return kt.toLowerCase()
  }

  // Fallback A: split by space → first half → after first underscore
  const spaceIdx = sku.indexOf(' ')
  if (spaceIdx > 0) {
    const firstHalf = sku.slice(0, spaceIdx)
    const uIdx = firstHalf.indexOf('_')
    if (uIdx >= 0) return firstHalf.slice(uIdx + 1).toLowerCase()
  }

  // Fallback B: split by underscore → index 1
  const parts = sku.split('_')
  return parts.length >= 2 ? parts[1].toLowerCase() : ''
}

function parseItemType(sku: string, variantTitle: string, knownTypes: string[]): { type: string; size: string } {
  const vtParts = (variantTitle || '').split(' / ').map(p => p.trim())
  const size = (vtParts[vtParts.length - 1] || '').toLowerCase()
  const type = extractTypeFromSku(sku, knownTypes)
  return { type, size }
}

interface ShopifyOrder {
  id: number
  created_at: string
  total_price: string
  subtotal_price: string
  total_shipping_price_set?: { shop_money: { amount: string } }
  line_items: OrderItem[]
}

// ── Custom tooltip for stacked bar chart ──
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

// ── Custom tooltip for profit line ──
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

export default function PnL() {
  const [preset, setPreset] = useState<PresetKey>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [usdToVnd, setUsdToVnd] = useState(25500) // Default exchange rate
  const [editingRate, setEditingRate] = useState(false)
  const [rateInput, setRateInput] = useState('25500')

  const { from, to } = useMemo(
    () => getDateRange(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  )

  // ── Fetch exchange rate from Supabase ──
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
  // Auto-load on mount & when date range changes. When queryKey changes, immediately fetch fresh data.
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
    staleTime: 0,                 // Fetch fresh khi queryKey (time range) đổi
    gcTime: QUERY_GC.default,     // Giữ cache để reuse khi user quay lại
    retry: 1,
  })

  // ── Fetch COGS from Supabase ──
  const { data: cogsData } = useQuery({
    queryKey: ['cogs-mapping'],
    enabled: supabaseConfigured,
    staleTime: QUERY_STALE.longLived, // COGS mapping ít đổi trong phiên
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

  // ── Fetch exclusions and physical products ──
  const { data: exclusions } = useCogsExclusions()
  const { data: physicalProducts } = usePhysicalProducts()

  // ── Fetch fixed costs from Supabase ──
  const { data: fixedCosts } = useQuery({
    queryKey: ['fixed-costs'],
    enabled: supabaseConfigured,
    staleTime: QUERY_STALE.longLived, // fixed costs hầu như không đổi trong phiên
    queryFn: async () => {
      const { data, error } = await supabase.from('fixed_costs').select('*')
      if (error) return []
      return data as Array<{ name: string; amount: number; frequency: string }>
    },
  })

  // ── Fetch Facebook Ads spend ──
  const { data: fbAdsData } = useQuery({
    queryKey: ['fb-ads-spend', from, to],
    enabled: supabaseConfigured,
    staleTime: QUERY_STALE.medium, // ad spend có thể sync ngầm 5-10 phút/lần
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

  // ── Known product types from COGS mapping (for SKU matching) ──
  const knownTypes = useMemo(() => {
    if (!cogsData) return [] as string[]
    const set = new Set<string>()
    for (const c of cogsData) {
      if (c.shopify_variant_name) set.add(c.shopify_variant_name.trim())
      if (c.product_title) set.add(c.product_title.trim())
    }
    return Array.from(set)
  }, [cogsData])

  // ── Build COGS lookup ──
  // Key = "shopify_variant_name||size" (e.g. "t-shirt||l") — all lowercase for case-insensitive matching
  const cogsLookup = useMemo(() => {
    const map = new Map<string, CogsCosts>()
    if (!cogsData) return map
    for (const c of cogsData) {
      const costs: CogsCosts = {
        baseCost: c.base_cost,
        shippingCost: c.shipping_cost,
        shippingExtra: c.shipping_extra,
      }
      // Primary key: shopify_variant_name + size (matches Shopify variant_title like "T-Shirt / L")
      if (c.shopify_variant_name) {
        const key = `${c.shopify_variant_name.trim().toLowerCase()}||${(c.variant_title || '').trim().toLowerCase()}`
        map.set(key, costs)
      }
      // Fallback key: supplier product_title + size
      const supplierKey = `${c.product_title.trim().toLowerCase()}||${(c.variant_title || '').trim().toLowerCase()}`
      if (!map.has(supplierKey)) map.set(supplierKey, costs)
    }
    return map
  }, [cogsData])

  // ── Calculate full P&L ──
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
      date: string; revenue: number; cogs: number; ads: number;
      paymentFees: number; orders: number
    }>()

    for (const order of orders) {
      const orderRevenue = parseFloat(order.total_price)
      revenue += orderRevenue

      // Shopify payment processing fee per order
      const orderFee = orderRevenue * SHOPIFY_FEE_PERCENT + SHOPIFY_FEE_FIXED
      paymentFees += orderFee

      const dateKey = order.created_at.slice(0, 10)
      const day = dailyMap.get(dateKey) || {
        date: dateKey, revenue: 0, cogs: 0, ads: 0, paymentFees: 0, orders: 0,
      }
      day.revenue += orderRevenue
      day.paymentFees += orderFee
      day.orders++

      // ── Per-order COGS with correct shipping rule ──
      // Rule: base_cost × qty for each item
      //        + max(shipping_cost) across all items in the order (1st item)
      //        + shipping_extra × (total_order_qty - 1) for subsequent items
      let orderBaseCost = 0
      let orderMaxShipping = 0
      let orderTotalQty = 0
      let orderShippingExtra = 0
      let orderUnmatched = 0

      for (const item of order.line_items) {
        const qty = item.quantity
        totalUnits += qty

        // Check if item is excluded (upsell/add-on)
        const titleLower = item.title.toLowerCase()
        const itemExcluded = exclusions?.some(e => titleLower.includes(e.pattern.toLowerCase()))
        if (itemExcluded) continue // skip — not counted in COGS or units

        orderTotalQty += qty

        // Check if item is a physical product
        const physMatch = physicalProducts?.find(p => titleLower.includes(p.product_name.toLowerCase()))
        if (physMatch) {
          // Physical product — use its manually entered costs
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

        // POD product — extract type from SKU, match against COGS mapping
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
          // Track shipping_extra for this item's cost entry (use the highest if mixed)
          if (costs.shippingExtra > orderShippingExtra) {
            orderShippingExtra = costs.shippingExtra
          }
        } else {
          orderUnmatched++
          unmatchedSet.add(type || item.variant_title || item.title)
        }

        // Product-level tracking
        const lineCost = costs ? costs.baseCost * qty : 0
        const prod = productMap.get(item.title) || { revenue: 0, cost: 0, qty: 0 }
        prod.revenue += parseFloat(item.price) * qty
        prod.cost += lineCost
        prod.qty += qty
        productMap.set(item.title, prod)
      }

      // Order shipping: max(shipping_cost) + shipping_extra × (totalQty - 1)
      const orderShipping = orderMaxShipping + Math.max(0, orderTotalQty - 1) * orderShippingExtra
      const orderCogs = orderBaseCost + orderShipping
      cogs += orderCogs
      day.cogs += orderCogs
      unmatchedItems += orderUnmatched

      dailyMap.set(dateKey, day)
    }

    // Facebook Ads spend
    const adsSpend = (fbAdsData || []).reduce((s, d) => s + d.spend, 0)

    // Merge ads spend into daily data
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

    // Fixed costs — pro-rated to period
    const monthlyFixed = (fixedCosts || []).reduce((s, c) => {
      if (c.frequency === 'monthly') return s + c.amount
      if (c.frequency === 'yearly') return s + c.amount / 12
      if (c.frequency === 'daily') return s + c.amount * 30
      return s + c.amount
    }, 0)

    const periodMs = new Date(to).getTime() - new Date(from).getTime()
    const periodDays = Math.max(1, Math.ceil(periodMs / 86400000))
    const periodFixed = (monthlyFixed / 30) * periodDays

    // P&L summary
    const grossProfit = revenue - cogs
    const netProfit = revenue - cogs - adsSpend - periodFixed - paymentFees

    // Daily data for charts
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

    // Structure data for stacked bar (monthly or period totals)
    const structureData = dailyData.map(d => ({
      date: d.date.slice(5), // MM-DD
      COGS: d.cogs,
      'Quảng cáo': d.ads,
      'Phí TT': d.paymentFees,
      'Cố định': d.fixedCosts,
      'Lợi nhuận': Math.max(0, d.netProfit),
    }))

    // Top products
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

  return (
    <div className="space-y-6">
      {/* ── Header + Time Range ── */}
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

      {/* ── Main P&L content ── */}
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

          {/* ── Row 2: Order stats + VND conversion ── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">Đơn hàng</p>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-2 text-2xl font-bold">{formatNumber(metrics.orderCount)}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  AOV: {formatCurrency(metrics.avgOrderValue)} · {formatNumber(metrics.totalUnits)} sản phẩm
                </p>
              </CardContent>
            </Card>

            {/* VND Conversion Card */}
            <Card className="lg:col-span-2 bg-gradient-to-r from-yellow-500/5 to-amber-500/5 border-yellow-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <BadgeDollarSign className="h-5 w-5 text-yellow-500" />
                    <p className="text-sm font-medium">Quy đổi VNĐ</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Tỷ giá:</span>
                    {editingRate ? (
                      <div className="flex items-center gap-1">
                        <Input
                          className="w-24 h-7 text-xs"
                          value={rateInput}
                          onChange={(e) => setRateInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && saveExchangeRate()}
                        />
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={saveExchangeRate}>
                          ✓
                        </Button>
                      </div>
                    ) : (
                      <button
                        className="text-xs font-medium text-yellow-500 hover:underline cursor-pointer"
                        onClick={() => { setEditingRate(true); setRateInput(String(usdToVnd)) }}
                      >
                        1 USD = {formatNumber(usdToVnd)} VNĐ
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Doanh thu</p>
                    <p className="text-lg font-bold text-blue-400">{formatVND(metrics.revenue * usdToVnd)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Lãi gộp</p>
                    <p className={`text-lg font-bold ${metrics.grossProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatVND(metrics.grossProfit * usdToVnd)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Lợi nhuận ròng</p>
                    <p className={`text-lg font-bold ${metrics.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatVND(metrics.netProfit * usdToVnd)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Charts ── */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Profit Line Chart — green = profit, red = loss */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Lợi nhuận ròng theo ngày</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.dailyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={metrics.dailyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v) => v.slice(5)}
                        className="text-xs"
                      />
                      <YAxis className="text-xs" />
                      <Tooltip content={<ProfitLineTooltip />} />
                      <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                      <Legend />
                      {/* Two overlapping lines: green for profit, red for loss */}
                      <Line
                        type="monotone"
                        dataKey={(d: any) => (d.netProfit >= 0 ? d.netProfit : null)}
                        stroke="#10b981"
                        strokeWidth={2.5}
                        dot={false}
                        connectNulls={false}
                        name="Lãi"
                        legendType="line"
                      />
                      <Line
                        type="monotone"
                        dataKey={(d: any) => (d.netProfit < 0 ? d.netProfit : null)}
                        stroke="#ef4444"
                        strokeWidth={2.5}
                        dot={false}
                        connectNulls={false}
                        name="Lỗ"
                        legendType="line"
                      />
                      {/* Full line for continuity (thin, semi-transparent) */}
                      <Line
                        type="monotone"
                        dataKey="netProfit"
                        stroke="#6b7280"
                        strokeWidth={1}
                        strokeDasharray="2 2"
                        dot={(props: any) => {
                          const { cx, cy, payload } = props
                          const color = payload.netProfit >= 0 ? '#10b981' : '#ef4444'
                          return (
                            <circle
                              key={`dot-${props.index}`}
                              cx={cx}
                              cy={cy}
                              r={3}
                              fill={color}
                              stroke={color}
                              strokeWidth={1}
                            />
                          )
                        }}
                        activeDot={(props: any) => {
                          const { cx, cy, payload } = props
                          const color = payload.netProfit >= 0 ? '#10b981' : '#ef4444'
                          return (
                            <circle
                              key={`adot-${props.index}`}
                              cx={cx}
                              cy={cy}
                              r={5}
                              fill={color}
                              stroke="#fff"
                              strokeWidth={2}
                            />
                          )
                        }}
                        name="Lợi nhuận ròng"
                        legendType="none"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-64 items-center justify-center text-muted-foreground">Chưa có dữ liệu</div>
                )}
              </CardContent>
            </Card>

            {/* Stacked Bar Chart — Cost structure breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cơ cấu chi phí & lợi nhuận</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.structureData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={metrics.structureData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip content={<StackedBarTooltip />} />
                      <Legend />
                      <Bar dataKey="COGS" stackId="a" fill="#f97316" name="COGS" />
                      <Bar dataKey="Quảng cáo" stackId="a" fill="#a855f7" name="Quảng cáo" />
                      <Bar dataKey="Phí TT" stackId="a" fill="#ec4899" name="Phí TT" />
                      <Bar dataKey="Cố định" stackId="a" fill="#64748b" name="Cố định" />
                      <Bar dataKey="Lợi nhuận" stackId="a" fill="#10b981" name="Lợi nhuận" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-64 items-center justify-center text-muted-foreground">Chưa có dữ liệu</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Revenue + Profit trend (overview) ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Doanh thu & Lợi nhuận theo ngày</CardTitle>
            </CardHeader>
            <CardContent>
              {metrics.dailyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={metrics.dailyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={false} name="Doanh thu" />
                    <Line type="monotone" dataKey="cogs" stroke="#f97316" strokeWidth={1.5} dot={false} name="COGS" strokeDasharray="4 2" />
                    <Line type="monotone" dataKey="ads" stroke="#a855f7" strokeWidth={1.5} dot={false} name="Quảng cáo" strokeDasharray="4 2" />
                    <Line type="monotone" dataKey="netProfit" stroke="#10b981" strokeWidth={2} dot={false} name="Lợi nhuận ròng" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-64 items-center justify-center text-muted-foreground">Chưa có dữ liệu</div>
              )}
            </CardContent>
          </Card>

          {/* ── P&L Summary Table ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bảng tổng hợp P&L</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative overflow-auto">
                <table className="w-full text-sm">
                  <tbody>
                    <PnlRow label="Doanh thu (Revenue)" value={metrics.revenue} bold className="text-blue-400" />
                    <PnlRow label="(-) Giá vốn hàng bán (COGS)" value={-metrics.cogs} className="text-orange-400" />
                    <PnlRow label="(-) Chi phí quảng cáo (Ads)" value={-metrics.adsSpend} className="text-purple-400" />
                    <PnlRow label="(-) Phí cổng thanh toán Shopify" value={-metrics.paymentFees} className="text-pink-400" />
                    <PnlRow label="(-) Chi phí cố định" value={-metrics.periodFixed} className="text-slate-400" />
                    <tr className="border-t-2 border-border">
                      <td className="py-3 font-bold text-base">= Lãi gộp (Gross Profit)</td>
                      <td className={`py-3 text-right font-bold text-base ${metrics.grossProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatCurrency(metrics.grossProfit)}
                      </td>
                      <td className="py-3 text-right text-muted-foreground">
                        {metrics.grossMargin.toFixed(1)}%
                      </td>
                    </tr>
                    <tr className="border-t-2 border-primary/30 bg-primary/5">
                      <td className="py-3 font-bold text-base">= Lợi nhuận ròng (Net Profit)</td>
                      <td className={`py-3 text-right font-bold text-base ${metrics.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatCurrency(metrics.netProfit)}
                      </td>
                      <td className="py-3 text-right text-muted-foreground">
                        {metrics.netMargin.toFixed(1)}%
                      </td>
                    </tr>
                    <tr className="border-t bg-yellow-500/5">
                      <td className="py-3 font-medium text-yellow-500">≈ VNĐ (Net Profit)</td>
                      <td className={`py-3 text-right font-bold ${metrics.netProfit >= 0 ? 'text-yellow-500' : 'text-red-400'}`}>
                        {formatVND(metrics.netProfit * usdToVnd)}
                      </td>
                      <td className="py-3 text-right text-xs text-muted-foreground">
                        @{formatNumber(usdToVnd)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* ── Product Profitability Table ── */}
          {metrics.topProducts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Lợi nhuận theo sản phẩm (Top 10)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-3 text-left font-medium text-muted-foreground">Sản phẩm</th>
                        <th className="py-3 text-right font-medium text-muted-foreground">SL</th>
                        <th className="py-3 text-right font-medium text-muted-foreground">Doanh thu</th>
                        <th className="py-3 text-right font-medium text-muted-foreground">COGS</th>
                        <th className="py-3 text-right font-medium text-muted-foreground">Lợi nhuận</th>
                        <th className="py-3 text-right font-medium text-muted-foreground">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.topProducts.map((p, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-3" title={p.fullName}>{p.name}</td>
                          <td className="py-3 text-right">{formatNumber(p.qty)}</td>
                          <td className="py-3 text-right">{formatCurrency(p.revenue)}</td>
                          <td className="py-3 text-right">{formatCurrency(p.cost)}</td>
                          <td className="py-3 text-right font-medium">
                            <span className={p.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                              {formatCurrency(p.profit)}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <Badge variant={p.margin >= 50 ? 'success' : p.margin >= 30 ? 'secondary' : 'warning'}>
                              {p.margin.toFixed(1)}%
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

// ── KPI Card Component ──
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

// ── P&L Summary Row ──
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
        {value < 0 ? '−' : ''}
      </td>
    </tr>
  )
}
