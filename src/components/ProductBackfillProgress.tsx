import { useQuery } from '@tanstack/react-query'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { formatCurrency, formatNumber, formatDateTimeVN } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Database, Activity, AlertCircle, CheckCircle2 } from 'lucide-react'

interface BackfillProgress {
  window_since: string
  window_until: string
  window_days: number
  days_covered: number
  gap_days_remaining: number
  progress_pct: number
  total_rows: number
  distinct_variants: number
  sum_spend: number
  rollup_rows: number
  latest_sync_id: number | null
  latest_status: string | null
  latest_started_at: string | null
  latest_finished_at: string | null
  latest_rows_upserted: number | null
  latest_api_calls: number | null
  latest_notes: string | null
  latest_error: string | null
  latest_triggered_by: string | null
  product_cron_schedule: string | null
  product_cron_active: boolean | null
  runs_last_24h: number | null
  rows_last_24h: number | null
  avg_rows_per_day: number | null
  eta_hours: number | null
}

function formatEta(hours: number): string {
  if (hours <= 0) return 'đã đầy'
  if (hours < 1) return `${Math.round(hours * 60)} phút`
  if (hours < 24) return `${hours.toFixed(1)} giờ`
  const d = Math.floor(hours / 24)
  const h = Math.round(hours - d * 24)
  return `${d} ngày ${h} giờ`
}

function StatusPill({ status }: { status: string | null }) {
  if (!status) return <Badge variant="secondary">—</Badge>
  if (status === 'success') return <Badge variant="success">success</Badge>
  if (status === 'failed') return <Badge variant="destructive">failed</Badge>
  if (status === 'timeout') return <Badge variant="destructive">timeout</Badge>
  if (status === 'running') return <Badge variant="warning">running</Badge>
  if (status === 'partial') return <Badge variant="warning">partial</Badge>
  if (status === 'throttled_backoff') return <Badge variant="warning">throttled</Badge>
  return <Badge variant="secondary">{status}</Badge>
}

export default function ProductBackfillProgress() {
  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ['fbc-product-backfill-progress'],
    enabled: supabaseConfigured,
    refetchInterval: 20000, // 20s live
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('fbc_product_backfill_progress')
        .single()
      if (error) throw error
      return data as BackfillProgress
    },
  })

  if (!supabaseConfigured) return null

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            Backfill FB spend theo variant_id
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Đang tải trạng thái backfill…</p>
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            Backfill FB spend theo variant_id
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

  const pct = Number(data.progress_pct) || 0
  const covered = Number(data.days_covered) || 0
  const total = Number(data.window_days) || 90
  const remaining = Number(data.gap_days_remaining) || 0
  const etaHours = Number(data.eta_hours) || 0

  const quality =
    pct >= 80
      ? { label: 'Đầy đủ', color: 'text-green-600', bg: 'bg-green-500' }
      : pct >= 40
      ? { label: 'Đang nạp', color: 'text-amber-600', bg: 'bg-amber-500' }
      : { label: 'Mới khởi động', color: 'text-blue-600', bg: 'bg-blue-500' }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          <Database className="h-4 w-4 text-primary" />
          Backfill FB spend theo variant_id (90 ngày)
          <span className={`text-sm font-semibold ${quality.color}`}>
            · {quality.label} ({pct.toFixed(1)}%)
          </span>
          <span className="ml-auto text-[11px] font-normal text-muted-foreground">
            tự refresh mỗi 20s
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Progress bar */}
          <div className="lg:col-span-2">
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium">Days covered</span>
              <span className="font-mono font-semibold">
                {covered}/{total} ngày — còn {remaining} ngày
              </span>
            </div>
            <div className="h-4 overflow-hidden rounded-full bg-gray-200">
              <div
                className={`h-full ${quality.bg} transition-all`}
                style={{ width: `${Math.min(pct, 100).toFixed(2)}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Cửa sổ: {data.window_since} → {data.window_until}
              </span>
              <span>
                ETA: <b className={quality.color}>{formatEta(etaHours)}</b>
              </span>
            </div>
          </div>

          {/* Accumulated stats */}
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="text-xs text-muted-foreground">Đã tích lũy</div>
            <div className="mt-1 text-2xl font-bold">{formatNumber(data.total_rows ?? 0)}</div>
            <div className="text-[11px] text-muted-foreground">product×ad×day rows</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-muted-foreground">Variants</div>
                <div className="font-mono font-semibold">
                  {formatNumber(data.distinct_variants ?? 0)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Spend</div>
                <div className="font-mono font-semibold">
                  {formatCurrency(Number(data.sum_spend) || 0)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Rollup rows</div>
                <div className="font-mono font-semibold">
                  {formatNumber(data.rollup_rows ?? 0)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Last 24h</div>
                <div className="font-mono font-semibold">
                  {data.runs_last_24h ?? 0} runs
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Latest sync */}
        <div className="mt-4 rounded-md border bg-muted/10 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Lần backfill gần nhất
              {data.latest_sync_id != null && (
                <span className="font-mono text-xs text-muted-foreground">
                  #{data.latest_sync_id}
                </span>
              )}
            </div>
            <StatusPill status={data.latest_status} />
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs lg:grid-cols-4">
            <div>
              <div className="text-muted-foreground">Trigger</div>
              <div className="truncate font-mono" title={data.latest_triggered_by ?? ''}>
                {data.latest_triggered_by ?? '—'}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Bắt đầu</div>
              <div className="font-mono">{formatDateTimeVN(data.latest_started_at)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Rows upserted</div>
              <div className="font-mono font-semibold">
                {formatNumber(data.latest_rows_upserted ?? 0)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">API calls</div>
              <div className="font-mono font-semibold">{data.latest_api_calls ?? 0}</div>
            </div>
          </div>
          {data.latest_notes && (
            <div className="mt-2 text-[11px] text-muted-foreground">
              <b>Notes:</b> {data.latest_notes}
            </div>
          )}
          {data.latest_error && (
            <div className="mt-2 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-600">
              <AlertCircle className="mr-1 inline h-3 w-3" />
              {data.latest_error}
            </div>
          )}
        </div>

        {/* Cron status */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
          Cron <code className="rounded bg-muted px-1 font-mono">
            {data.product_cron_schedule ?? '—'}
          </code>
          {data.product_cron_active ? (
            <Badge variant="success">active</Badge>
          ) : (
            <Badge variant="secondary">paused</Badge>
          )}
          <span className="ml-auto">
            Last refresh: {dataUpdatedAt ? formatDateTimeVN(new Date(dataUpdatedAt).toISOString(), { showSeconds: true }) : '—'}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
