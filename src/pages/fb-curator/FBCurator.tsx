import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { REFETCH_INTERVAL } from '@/lib/queryDefaults'
import { formatCurrency, formatNumber, formatDateTimeVN } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Play,
  TestTube,
  Settings as SettingsIcon,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'
import MatchLevelPanel from '@/components/MatchLevelPanel'
import ProductBackfillProgress from '@/components/ProductBackfillProgress'

interface Stats {
  total_runs: number
  successes: number
  failures: number
  last_run_at: string | null
  last_run_status: string | null
  last_run_id: string | null
  next_cron_schedule: string | null
}

interface CronJob {
  jobid: number
  jobname: string
  schedule: string
  active: boolean
}

interface RunRow {
  id: string
  status: string
  dry_run: boolean
  triggered_by: string | null
  started_at: string
  finished_at: string | null
  elapsed_sec: number
  product_set_id: string | null
  prev_member_count: number | null
  new_member_count: number | null
  added_count: number | null
  removed_count: number | null
  kept_count: number | null
  grace_count: number | null
  churn_capped: boolean | null
  shopify_revenue_window: number | null
  fb_spend_window: number | null
  window_since: string | null
  window_until: string | null
  strategy: string | null
  error_msg: string | null
}

const fmtTime = (iso: string | null): string => formatDateTimeVN(iso)

function describeCron(expr: string | null): string {
  if (!expr) return '—'
  // Best-effort, only for the two known schedules
  if (expr === '0 16 * * 5') return 'Thứ 6 hàng tuần, 16:00 UTC (9 AM AZ)'
  if (expr === '0 16 21 4 *') return '21 tháng 4, 16:00 UTC (9 AM AZ) — một lần'
  return expr
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'success') return <Badge variant="success">success</Badge>
  if (status === 'failed') return <Badge variant="destructive">failed</Badge>
  if (status === 'running') return <Badge variant="warning">running</Badge>
  return <Badge variant="secondary">{status}</Badge>
}

export default function FBCurator() {
  const qc = useQueryClient()
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null)

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['fbc-stats'],
    enabled: supabaseConfigured,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fbc_stats').single()
      if (error) throw error
      return data as Stats
    },
    refetchInterval: REFETCH_INTERVAL.live,
  })

  const { data: cronJobs } = useQuery({
    queryKey: ['fbc-cron'],
    enabled: supabaseConfigured,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fbc_cron_jobs')
      if (error) throw error
      return data as CronJob[]
    },
  })

  const { data: runs, isLoading: runsLoading } = useQuery({
    queryKey: ['fbc-runs-recent'],
    enabled: supabaseConfigured,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fbc_runs_list', {
        p_limit: 20,
        p_offset: 0,
      })
      if (error) throw error
      return data as RunRow[]
    },
    refetchInterval: REFETCH_INTERVAL.live,
  })

  const triggerMutation = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const { data, error } = await supabase.rpc('fbc_trigger', {
        p_triggered_by: dryRun ? 'ncc_admin_ui_dryrun' : 'ncc_admin_ui_apply',
        p_dry_run: dryRun,
      })
      if (error) throw error
      return data as number
    },
    onSuccess: (reqId, dryRun) => {
      setTriggerMsg(
        `Đã gửi lệnh ${dryRun ? 'dry-run' : 'APPLY'} (net request #${reqId}). Worker chạy nền, cập nhật sau ~5–10s.`,
      )
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['fbc-runs-recent'] })
        qc.invalidateQueries({ queryKey: ['fbc-stats'] })
      }, 7000)
    },
    onError: (e: any) => {
      setTriggerMsg(`Lỗi: ${e?.message || 'unknown'}`)
    },
  })

  const successRate = stats && stats.total_runs > 0
    ? Math.round((stats.successes / stats.total_runs) * 100)
    : null

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">FB Best Seller Curator</h1>
          <p className="text-muted-foreground">
            Auto-curate Facebook product set <code className="text-xs">642690975425656</code> dựa trên Shopify 90d
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/fb-curator/design-backlog">
            <Button variant="outline" size="sm">
              🎨 Thiết kế tiềm năng
            </Button>
          </Link>
          <Link to="/fb-curator/config">
            <Button variant="outline" size="sm">
              <SettingsIcon className="mr-2 h-4 w-4" />
              Ngưỡng & quy tắc
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              qc.invalidateQueries({ queryKey: ['fbc-stats'] })
              qc.invalidateQueries({ queryKey: ['fbc-runs-recent'] })
              qc.invalidateQueries({ queryKey: ['fbc-cron'] })
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Tổng lần chạy</p>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-2xl font-bold">
              {statsLoading ? '…' : formatNumber(stats?.total_runs ?? 0)}
            </div>
            {successRate !== null && (
              <p className="mt-1 text-xs text-muted-foreground">
                {successRate}% thành công
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Success / Fail</p>
              <CheckCircle2 className="h-4 w-4 text-green-400" />
            </div>
            <div className="mt-2 text-2xl font-bold">
              <span className="text-green-400">{formatNumber(stats?.successes ?? 0)}</span>
              <span className="text-muted-foreground"> / </span>
              <span className="text-red-400">{formatNumber(stats?.failures ?? 0)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Lần chạy cuối</p>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-sm font-semibold">
              {stats?.last_run_at ? fmtTime(stats.last_run_at) : '—'}
            </div>
            <div className="mt-1">
              {stats?.last_run_status ? <StatusBadge status={stats.last_run_status} /> : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Cron Schedule</p>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-sm font-semibold">
              {describeCron(stats?.next_cron_schedule ?? null)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {cronJobs ? `${cronJobs.length} job đang active` : '…'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Product-level backfill progress (variant_id grain) */}
      <ProductBackfillProgress />

      {/* Match-level panel (latest successful run window vs facebook_ad_spend) */}
      <MatchLevelPanel title="Mức độ khớp FB spend · lần chạy mới nhất" />

      {/* Trigger panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chạy thủ công</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Dry-run không động vào catalog — chỉ log proposal. Apply sẽ mutate product set
            <code className="mx-1 text-xs">642690975425656</code>.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => triggerMutation.mutate(true)}
              disabled={triggerMutation.isPending}
            >
              <TestTube className="mr-2 h-4 w-4" />
              Dry-run
            </Button>
            <Button
              variant="default"
              onClick={() => {
                if (window.confirm('Chạy THẬT? Thao tác này sẽ mutate product set Best Seller.')) {
                  triggerMutation.mutate(false)
                }
              }}
              disabled={triggerMutation.isPending}
            >
              <Play className="mr-2 h-4 w-4" />
              Apply (thật)
            </Button>
          </div>
          {triggerMsg && (
            <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
              {triggerMsg}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Cron jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lịch cron</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Mô tả</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(cronJobs ?? []).map((j) => (
                <TableRow key={j.jobid}>
                  <TableCell className="font-mono text-xs">{j.jobname}</TableCell>
                  <TableCell className="font-mono text-xs">{j.schedule}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {describeCron(j.schedule)}
                  </TableCell>
                  <TableCell>
                    {j.active ? (
                      <Badge variant="success">active</Badge>
                    ) : (
                      <Badge variant="secondary">paused</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(!cronJobs || cronJobs.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    Chưa có cron job
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent runs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">20 lần chạy gần nhất</CardTitle>
          {runs && runs.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Tự refresh mỗi 15s
            </p>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Khi nào</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Elapsed</TableHead>
                <TableHead className="text-right">Prev → New</TableHead>
                <TableHead className="text-right">+Add</TableHead>
                <TableHead className="text-right">−Rem</TableHead>
                <TableHead className="text-right">Shopify 90d</TableHead>
                <TableHead>Strategy</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runsLoading && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-sm text-muted-foreground">
                    Đang tải…
                  </TableCell>
                </TableRow>
              )}
              {!runsLoading && runs && runs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-sm text-muted-foreground">
                    Chưa có lần chạy nào
                  </TableCell>
                </TableRow>
              )}
              {(runs ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-xs">{fmtTime(r.started_at)}</TableCell>
                  <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground" title={r.triggered_by ?? ''}>
                    {r.triggered_by ?? '—'}
                  </TableCell>
                  <TableCell>
                    {r.dry_run ? (
                      <Badge variant="secondary">dry</Badge>
                    ) : (
                      <Badge variant="default">apply</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">{r.elapsed_sec}s</TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {r.prev_member_count ?? '—'} → {r.new_member_count ?? '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-green-400">
                    {r.added_count ?? 0}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-red-400">
                    {r.removed_count ?? 0}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {r.shopify_revenue_window != null ? formatCurrency(r.shopify_revenue_window) : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.strategy ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Link to={`/fb-curator/runs/${r.id}`}>
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {runs && runs.some(r => r.status === 'failed') && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm">
              <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
              <div>
                <p className="font-medium text-red-400">Có lần chạy failed trong lịch sử</p>
                <p className="text-xs text-muted-foreground">
                  Click "ExternalLink" bên cạnh mỗi hàng để xem chi tiết error_msg và report_json.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
