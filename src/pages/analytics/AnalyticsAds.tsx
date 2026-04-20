import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { QUERY_STALE } from '@/lib/queryDefaults'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Calendar,
  DollarSign,
  Package,
  Target,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────
interface DesignRow {
  run_id: string
  window_since: string
  window_until: string
  window_days: number
  fb_spend_days: number
  fb_spend_min_date: string | null
  fb_spend_max_date: string | null
  total_fb_spend_raw: number
  total_fb_spend: number
  total_revenue: number
  total_units: number
  design_name: string
  product_types: string[]
  variants_count: number
  shopify_units: number
  shopify_recent_30d: number
  shopify_revenue: number
  avg_unit_price: number
  refund_pct: number
  revenue_share_pct: number
  fb_spend_allocated: number
  roas_est: number | null
  category: 'top_profit' | 'middle' | 'top_loss' | 'no_spend' | 'dormant'
  sample_titles: string[]
}

// ── Helpers ───────────────────────────────────────────────────────────
function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d + 'T00:00:00Z').toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    'T-shirt': 'bg-blue-100 text-blue-700',
    'Premium T-shirt': 'bg-indigo-100 text-indigo-700',
    'Long Sleeve T-shirt': 'bg-violet-100 text-violet-700',
    'Long Sleeve': 'bg-violet-100 text-violet-700',
    Sweatshirt: 'bg-amber-100 text-amber-700',
    Hoodie: 'bg-orange-100 text-orange-700',
    'Tank Top': 'bg-teal-100 text-teal-700',
    'Youth T-shirt': 'bg-green-100 text-green-700',
  }
  const cls = map[type] || 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
      {type}
    </span>
  )
}

function RoasBadge({ roas }: { roas: number | null }) {
  if (roas === null) return <span className="text-muted-foreground">—</span>
  if (roas >= 1.5)
    return (
      <Badge variant="success" className="font-mono">
        {roas.toFixed(2)}
      </Badge>
    )
  if (roas >= 1.2)
    return (
      <Badge variant="warning" className="font-mono">
        {roas.toFixed(2)}
      </Badge>
    )
  return (
    <Badge variant="destructive" className="font-mono">
      {roas.toFixed(2)}
    </Badge>
  )
}

// ── Section Table ─────────────────────────────────────────────────────
function DesignTable({ rows, emoji }: { rows: DesignRow[]; emoji?: string }) {
  if (!rows.length) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        {emoji ? `${emoji} ` : ''}Không có design nào trong phân khúc này.
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead className="min-w-[220px]">Design</TableHead>
            <TableHead>Types</TableHead>
            <TableHead className="text-right">Var.</TableHead>
            <TableHead className="text-right">Units</TableHead>
            <TableHead className="text-right">30d</TableHead>
            <TableHead className="text-right">Revenue</TableHead>
            <TableHead className="text-right">AOV</TableHead>
            <TableHead className="text-right">Refund%</TableHead>
            <TableHead className="text-right">Rev Share</TableHead>
            <TableHead className="text-right">Spend*</TableHead>
            <TableHead className="text-right">ROAS*</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={r.design_name}>
              <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
              <TableCell>
                <div className="font-medium text-sm">{r.design_name}</div>
                {r.sample_titles.length > 1 && (
                  <div className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[300px]">
                    {r.sample_titles.slice(0, 3).join(' · ')}
                    {r.sample_titles.length > 3 ? ` · +${r.sample_titles.length - 3}` : ''}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {r.product_types.map((t) => (
                    <TypeBadge key={t} type={t} />
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-right text-xs">{r.variants_count}</TableCell>
              <TableCell className="text-right font-mono">{formatNumber(r.shopify_units)}</TableCell>
              <TableCell className="text-right font-mono text-xs text-muted-foreground">
                {formatNumber(r.shopify_recent_30d)}
              </TableCell>
              <TableCell className="text-right font-mono font-medium">
                {formatCurrency(r.shopify_revenue)}
              </TableCell>
              <TableCell className="text-right font-mono text-xs">
                {formatCurrency(r.avg_unit_price)}
              </TableCell>
              <TableCell className="text-right text-xs">
                {r.refund_pct > 0 ? `${r.refund_pct.toFixed(1)}%` : '—'}
              </TableCell>
              <TableCell className="text-right font-mono text-xs">
                {r.revenue_share_pct.toFixed(2)}%
              </TableCell>
              <TableCell className="text-right font-mono text-xs">
                {formatCurrency(r.fb_spend_allocated)}
              </TableCell>
              <TableCell className="text-right">
                <RoasBadge roas={r.roas_est} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────
export default function AnalyticsAds() {
  const [breakeven, setBreakeven] = useState(1.5)
  const [watchLow, setWatchLow] = useState(1.2)
  const [extrapolate, setExtrapolate] = useState(true)
  const [search, setSearch] = useState('')

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['analytics-design-pnl', breakeven, watchLow, extrapolate],
    enabled: supabaseConfigured,
    staleTime: QUERY_STALE.medium,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('analytics_design_pnl', {
        p_breakeven: breakeven,
        p_watch_low: watchLow,
        p_extrapolate: extrapolate,
      })
      if (error) throw error
      return (data || []) as DesignRow[]
    },
  })

  const rows = data || []
  const meta = rows[0]

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter((r) => r.design_name.toLowerCase().includes(q))
  }, [rows, search])

  const topProfit = filtered.filter((r) => r.category === 'top_profit')
  const middle = filtered.filter((r) => r.category === 'middle')
  const topLoss = filtered.filter((r) => r.category === 'top_loss')
  const dormant = filtered.filter((r) => r.category === 'dormant')

  const overallRoas =
    meta && meta.total_fb_spend > 0 ? meta.total_revenue / meta.total_fb_spend : 0
  const spendCoveragePct =
    meta && meta.window_days > 0
      ? (meta.fb_spend_days / meta.window_days) * 100
      : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Phân tích hiệu quả Design
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gộp biến thể POD về design gốc (strip suffix T-shirt / Sweatshirt / Hoodie / Premium / Long Sleeve) để đánh giá thiết kế nào tiềm năng.
          </p>
        </div>
        <Button onClick={() => refetch()} disabled={isFetching} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Match Level Panel — mức độ khớp với FB spend */}
      {meta && (() => {
        const timePct = meta.window_days > 0 ? (meta.fb_spend_days / meta.window_days) * 100 : 0
        const measuredPct = meta.total_fb_spend > 0 ? (meta.total_fb_spend_raw / meta.total_fb_spend) * 100 : 100
        const extrapolatedPct = 100 - measuredPct
        const matchQuality =
          timePct >= 80 ? { label: 'Tốt', color: 'text-green-600', bg: 'bg-green-500' }
          : timePct >= 50 ? { label: 'Khá', color: 'text-amber-600', bg: 'bg-amber-500' }
          : { label: 'Yếu', color: 'text-red-600', bg: 'bg-red-500' }
        return (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Mức độ khớp với FB Ad Spend
                <span className={`text-sm font-semibold ${matchQuality.color}`}>
                  · {matchQuality.label} ({timePct.toFixed(0)}%)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Time coverage */}
                <div>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-medium">Time coverage</span>
                    <span className="font-mono font-semibold">
                      {meta.fb_spend_days}/{meta.window_days} ngày
                    </span>
                  </div>
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${matchQuality.bg} transition-all`}
                      style={{ width: `${timePct.toFixed(1)}%` }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1.5">
                    {meta.fb_spend_min_date
                      ? <>FB có data từ {fmtDate(meta.fb_spend_min_date)} → {fmtDate(meta.fb_spend_max_date)}</>
                      : 'Chưa có FB spend data'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Cửa sổ Shopify: {fmtDate(meta.window_since)} → {fmtDate(meta.window_until)}
                  </div>
                </div>

                {/* Spend composition */}
                <div>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-medium">Spend composition</span>
                    <span className="font-mono font-semibold">
                      {formatCurrency(meta.total_fb_spend)}
                    </span>
                  </div>
                  <div className="h-3 flex rounded-full overflow-hidden bg-gray-200">
                    <div
                      className="bg-emerald-500 transition-all"
                      style={{ width: `${measuredPct.toFixed(1)}%` }}
                      title={`Measured: ${formatCurrency(meta.total_fb_spend_raw)}`}
                    />
                    {extrapolate && extrapolatedPct > 0 && (
                      <div
                        className="bg-amber-400 transition-all"
                        style={{ width: `${extrapolatedPct.toFixed(1)}%` }}
                        title={`Extrapolated: ${formatCurrency(meta.total_fb_spend - meta.total_fb_spend_raw)}`}
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1.5">
                    <span className="text-emerald-700 inline-flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                      Đo thực: {formatCurrency(meta.total_fb_spend_raw)}
                    </span>
                    {extrapolate && extrapolatedPct > 0.5 && (
                      <span className="text-amber-700 inline-flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                        Ước tính: {formatCurrency(meta.total_fb_spend - meta.total_fb_spend_raw)}
                      </span>
                    )}
                  </div>
                  {!extrapolate && timePct < 100 && (
                    <div className="text-[11px] text-muted-foreground mt-1">
                      Bật extrapolate để scale spend cho đủ cửa sổ.
                    </div>
                  )}
                </div>

                {/* Overall ROAS */}
                <div>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-medium">Overall ROAS</span>
                    <span className="font-mono font-semibold">
                      {formatCurrency(meta.total_revenue)}
                    </span>
                  </div>
                  <div className={`text-3xl font-bold ${
                    overallRoas >= breakeven ? 'text-green-600'
                    : overallRoas >= watchLow ? 'text-amber-600'
                    : 'text-red-600'
                  }`}>
                    {overallRoas > 0 ? overallRoas.toFixed(2) : '—'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatCurrency(meta.total_revenue)} ÷ {formatCurrency(meta.total_fb_spend)}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Breakeven {breakeven.toFixed(1)} · Watch {watchLow.toFixed(1)}
                  </div>
                </div>
              </div>

              {/* Explanation */}
              <div className="mt-4 pt-3 border-t text-xs text-muted-foreground">
                <AlertCircle className="inline h-3.5 w-3.5 mr-1 text-amber-600" />
                FB Curator (v11) chưa lưu spend theo Product ID. Spend được phân bổ cho từng design theo <b>tỉ trọng units</b> → ROAS design ≈ AOV design / CPU tổng. Mức độ khớp cao (time coverage ≥80%) thì con số đáng tin, thấp thì chỉ để xếp hạng tương đối.
              </div>
            </CardContent>
          </Card>
        )
      })()}

      {/* Controls */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Breakeven ROAS</label>
              <Input
                type="number"
                step="0.1"
                value={breakeven}
                onChange={(e) => setBreakeven(Number(e.target.value))}
                className="w-24 font-mono"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Watch-list low</label>
              <Input
                type="number"
                step="0.1"
                value={watchLow}
                onChange={(e) => setWatchLow(Number(e.target.value))}
                className="w-24 font-mono"
              />
            </div>
            <div className="flex items-center gap-2 pb-1">
              <input
                id="extrapolate"
                type="checkbox"
                checked={extrapolate}
                onChange={(e) => setExtrapolate(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="extrapolate" className="text-sm">
                Extrapolate FB spend (scale sang full window)
              </label>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground">Tìm design</label>
              <Input
                type="text"
                placeholder="VD: Heart Cross"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Package className="h-3.5 w-3.5" />
              Designs
            </div>
            <div className="text-2xl font-bold mt-1">{rows.length}</div>
            <div className="text-[11px] text-muted-foreground">
              {meta?.total_units ?? 0} units · {meta?.variants_count ? '' : ''}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <DollarSign className="h-3.5 w-3.5" />
              Revenue
            </div>
            <div className="text-2xl font-bold mt-1">
              {formatCurrency(meta?.total_revenue ?? 0)}
            </div>
            <div className="text-[11px] text-muted-foreground">Window sold</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Target className="h-3.5 w-3.5" />
              FB Spend
            </div>
            <div className="text-2xl font-bold mt-1">
              {formatCurrency(meta?.total_fb_spend ?? 0)}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {extrapolate && meta && meta.fb_spend_days < meta.window_days
                ? `scaled from ${formatCurrency(meta.total_fb_spend_raw)}`
                : 'raw'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <TrendingUp className="h-3.5 w-3.5" />
              Overall ROAS
            </div>
            <div
              className={`text-2xl font-bold mt-1 ${
                overallRoas >= breakeven
                  ? 'text-green-600'
                  : overallRoas >= watchLow
                  ? 'text-amber-600'
                  : 'text-red-600'
              }`}
            >
              {overallRoas > 0 ? overallRoas.toFixed(2) : '—'}
            </div>
            <div className="text-[11px] text-muted-foreground">revenue / spend</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Calendar className="h-3.5 w-3.5" />
              Buckets
            </div>
            <div className="text-sm mt-1 space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-green-700">Lãi</span>
                <span className="font-mono font-semibold">{topProfit.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-amber-700">Middle</span>
                <span className="font-mono font-semibold">{middle.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-red-700">Lỗ</span>
                <span className="font-mono font-semibold">{topLoss.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error */}
      {error && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-4 pb-4 flex items-start gap-3 text-sm text-red-900">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <b>Lỗi tải dữ liệu:</b> {(error as Error).message}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-12 text-muted-foreground">Đang tải…</div>
      )}

      {/* Sections */}
      {!isLoading && meta && (
        <>
          {/* TOP LÃI */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <TrendingUp className="h-5 w-5" />
                TOP Lãi — ROAS ≥ {breakeven.toFixed(1)}
                <Badge variant="success" className="ml-2">{topProfit.length} design</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DesignTable rows={topProfit} emoji="🟢" />
            </CardContent>
          </Card>

          {/* MIDDLE */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-700">
                <Minus className="h-5 w-5" />
                Watch-list — ROAS {watchLow.toFixed(1)} – {breakeven.toFixed(1)}
                <Badge variant="warning" className="ml-2">{middle.length} design</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DesignTable rows={middle} emoji="🟡" />
            </CardContent>
          </Card>

          {/* TOP LỖ */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700">
                <TrendingDown className="h-5 w-5" />
                TOP Lỗ — ROAS &lt; {watchLow.toFixed(1)}
                <Badge variant="destructive" className="ml-2">{topLoss.length} design</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DesignTable rows={topLoss} emoji="🔴" />
            </CardContent>
          </Card>

          {/* DORMANT */}
          {dormant.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-600">
                  <Package className="h-5 w-5" />
                  Dormant — chưa bán unit nào
                  <Badge variant="secondary" className="ml-2">{dormant.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DesignTable rows={dormant} />
              </CardContent>
            </Card>
          )}

          <div className="text-xs text-muted-foreground pt-2">
            <b>* Spend</b> và <b>ROAS</b> được phân bổ theo tỉ trọng units bán ra (proxy). Khi FB Curator được nâng cấp để fetch spend theo Product ID, các số này sẽ chính xác tuyệt đối.
          </div>
        </>
      )}
    </div>
  )
}
