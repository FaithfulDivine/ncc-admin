import { useQuery } from '@tanstack/react-query'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Target } from 'lucide-react'

interface MatchLevel {
  run_id: string | null
  window_since: string
  window_until: string
  window_days: number
  fb_spend_days: number
  fb_spend_min_date: string | null
  fb_spend_max_date: string | null
  total_fb_spend: number
  shopify_revenue: number
  fb_spend_window_from_run: number
  overall_roas: number
  time_coverage_pct: number
  match_label: 'Tốt' | 'Khá' | 'Yếu'
}

interface Props {
  /** If provided, fetch match level for that specific run. Otherwise → latest successful run. */
  runId?: string | null
  /** Optional explicit title (default: "Mức độ khớp với FB Ad Spend"). */
  title?: string
  /** Hide explanation footer (useful when embedded elsewhere). */
  compact?: boolean
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return d
  return dt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

export default function MatchLevelPanel({ runId, title = 'Mức độ khớp với FB Ad Spend', compact = false }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['fbc-match-level', runId ?? 'latest'],
    enabled: supabaseConfigured,
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('fbc_match_level', { p_run_id: runId ?? null })
        .single()
      if (error) throw error
      return data as MatchLevel
    },
  })

  if (!supabaseConfigured) return null

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Đang tính toán mức độ khớp…</p>
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-500">
            Chưa lấy được dữ liệu. {error instanceof Error ? error.message : ''}
          </p>
        </CardContent>
      </Card>
    )
  }

  const timePct = Number(data.time_coverage_pct) || 0
  const totalFb = Number(data.total_fb_spend) || 0
  const shopifyRev = Number(data.shopify_revenue) || 0
  const roas = Number(data.overall_roas) || 0

  const quality =
    timePct >= 80
      ? { label: 'Tốt', color: 'text-green-600', bg: 'bg-green-500' }
      : timePct >= 50
      ? { label: 'Khá', color: 'text-amber-600', bg: 'bg-amber-500' }
      : { label: 'Yếu', color: 'text-red-600', bg: 'bg-red-500' }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          <Target className="h-4 w-4 text-primary" />
          {title}
          <span className={`text-sm font-semibold ${quality.color}`}>
            · {quality.label} ({timePct.toFixed(0)}%)
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
                {data.fb_spend_days}/{data.window_days} ngày
              </span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${quality.bg} transition-all`}
                style={{ width: `${timePct.toFixed(1)}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground mt-1.5">
              {data.fb_spend_min_date
                ? <>FB có data {fmtDate(data.fb_spend_min_date)} → {fmtDate(data.fb_spend_max_date)}</>
                : 'Chưa có FB spend data trong cửa sổ'}
            </div>
            <div className="text-xs text-muted-foreground">
              Cửa sổ: {fmtDate(data.window_since)} → {fmtDate(data.window_until)}
            </div>
          </div>

          {/* FB Spend vs Shopify Revenue */}
          <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="font-medium">FB Spend (trong cửa sổ)</span>
              <span className="font-mono font-semibold">{formatCurrency(totalFb)}</span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden relative">
              {(() => {
                const denom = Math.max(shopifyRev, totalFb * 2, 1)
                const revPct = (shopifyRev / denom) * 100
                const spendPct = (totalFb / denom) * 100
                return (
                  <>
                    <div
                      className="absolute inset-y-0 left-0 bg-emerald-500/70"
                      style={{ width: `${revPct.toFixed(1)}%` }}
                      title={`Revenue: ${formatCurrency(shopifyRev)}`}
                    />
                    <div
                      className="absolute inset-y-0 left-0 bg-blue-500/80"
                      style={{ width: `${spendPct.toFixed(1)}%` }}
                      title={`FB Spend: ${formatCurrency(totalFb)}`}
                    />
                  </>
                )
              })()}
            </div>
            <div className="flex items-center justify-between text-xs mt-1.5">
              <span className="text-blue-700 inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
                Spend: {formatCurrency(totalFb)}
              </span>
              <span className="text-emerald-700 inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500/70" />
                Rev: {formatCurrency(shopifyRev)}
              </span>
            </div>
          </div>

          {/* Overall ROAS */}
          <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="font-medium">Overall ROAS</span>
              <span className="font-mono font-semibold">
                {roas > 0 ? `${roas.toFixed(2)}×` : '—'}
              </span>
            </div>
            <div
              className={`text-3xl font-bold ${
                roas >= 1.5 ? 'text-green-600' : roas >= 1.2 ? 'text-amber-600' : 'text-red-600'
              }`}
            >
              {roas > 0 ? roas.toFixed(2) : '—'}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatCurrency(shopifyRev)} ÷ {formatCurrency(totalFb)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Dữ liệu: public.facebook_ad_spend (campaign level).
            </div>
          </div>
        </div>

        {!compact && (
          <div className="mt-4 pt-3 border-t text-xs text-muted-foreground">
            <AlertCircle className="inline h-3.5 w-3.5 mr-1 text-amber-600" />
            {timePct < 50 ? (
              <>
                <b>Coverage yếu:</b> FB spend chỉ phủ {data.fb_spend_days}/{data.window_days} ngày.
                Thu hẹp cửa sổ hoặc chạy lại FB sync để có coverage tốt hơn.
              </>
            ) : timePct < 80 ? (
              <>
                <b>Coverage khá:</b> FB spend phủ {timePct.toFixed(0)}% cửa sổ — con số dùng tham khảo, nên bật <i>Extrapolate</i> khi so ROAS.
              </>
            ) : (
              <>
                <b>Coverage tốt:</b> FB spend phủ gần toàn bộ cửa sổ. Các con số ROAS đáng tin cho quyết định.
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
