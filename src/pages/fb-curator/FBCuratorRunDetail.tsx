import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft, Search } from 'lucide-react'

interface RunDetail {
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
  cooldown_blocked_count: number | null
  churn_capped: boolean | null
  shopify_revenue_window: number | null
  fb_spend_window: number | null
  window_since: string | null
  window_until: string | null
  report_json: Record<string, any> | null
  report_md: string | null
  error_msg: string | null
}

interface Decision {
  variant_id: string
  product_id: string | null
  product_title: string | null
  variant_title: string | null
  shopify_units: number | null
  shopify_revenue: number | null
  shopify_refund_pct: number | null
  shopify_recent_units_30d: number | null
  fb_spend: number | null
  fb_purchases: number | null
  fb_purchase_value: number | null
  fb_roas: number | null
  was_in_set: boolean | null
  recommended_action: string | null
  reason: string | null
  priority_score: number | null
  applied: boolean | null
  apply_error: string | null
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'success') return <Badge variant="success">success</Badge>
  if (status === 'failed') return <Badge variant="destructive">failed</Badge>
  if (status === 'running') return <Badge variant="warning">running</Badge>
  return <Badge variant="secondary">{status}</Badge>
}

function ActionBadge({ action }: { action: string | null }) {
  if (!action) return <span className="text-muted-foreground">—</span>
  if (action === 'add') return <Badge variant="success">+ add</Badge>
  if (action === 'remove') return <Badge variant="destructive">− remove</Badge>
  if (action === 'keep') return <Badge variant="default">keep</Badge>
  if (action === 'grace') return <Badge variant="warning">grace</Badge>
  return <Badge variant="secondary">{action}</Badge>
}

export default function FBCuratorRunDetail() {
  const { runId } = useParams<{ runId: string }>()
  const [filter, setFilter] = useState('')
  const [actionFilter, setActionFilter] = useState<string | null>(null)

  const { data: run, isLoading: runLoading } = useQuery({
    queryKey: ['fbc-run', runId],
    enabled: supabaseConfigured && !!runId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fbc_run_get', { p_run_id: runId! }).single()
      if (error) throw error
      return data as RunDetail
    },
  })

  const { data: decisions, isLoading: decLoading } = useQuery({
    queryKey: ['fbc-run-decisions', runId],
    enabled: supabaseConfigured && !!runId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fbc_run_decisions', { p_run_id: runId! })
      if (error) throw error
      return data as Decision[]
    },
  })

  const filteredDecisions = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return (decisions ?? []).filter((d) => {
      if (actionFilter && d.recommended_action !== actionFilter) return false
      if (!q) return true
      return (
        (d.product_title ?? '').toLowerCase().includes(q) ||
        (d.variant_title ?? '').toLowerCase().includes(q) ||
        (d.variant_id ?? '').toLowerCase().includes(q) ||
        (d.reason ?? '').toLowerCase().includes(q)
      )
    })
  }, [decisions, filter, actionFilter])

  const counts = useMemo(() => {
    const c = { add: 0, remove: 0, keep: 0, grace: 0, other: 0 }
    for (const d of decisions ?? []) {
      const a = d.recommended_action
      if (a === 'add') c.add++
      else if (a === 'remove') c.remove++
      else if (a === 'keep') c.keep++
      else if (a === 'grace') c.grace++
      else c.other++
    }
    return c
  }, [decisions])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/fb-curator">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Chi tiết lần chạy</h1>
          <p className="font-mono text-xs text-muted-foreground">{runId}</p>
        </div>
      </div>

      {runLoading && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">Đang tải…</CardContent>
        </Card>
      )}

      {run && (
        <>
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-base">
                Tổng quan
                <StatusBadge status={run.status} />
                {run.dry_run ? (
                  <Badge variant="secondary">dry-run</Badge>
                ) : (
                  <Badge variant="default">apply</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">Trigger</dt>
                  <dd className="text-sm font-medium">{run.triggered_by ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Bắt đầu</dt>
                  <dd className="text-sm font-medium">{fmtTime(run.started_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Kết thúc</dt>
                  <dd className="text-sm font-medium">{fmtTime(run.finished_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Elapsed</dt>
                  <dd className="text-sm font-medium">{run.elapsed_sec}s</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Product set</dt>
                  <dd className="font-mono text-xs">{run.product_set_id ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Window</dt>
                  <dd className="text-sm font-medium">
                    {run.window_since} → {run.window_until}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Shopify 90d</dt>
                  <dd className="text-sm font-medium">
                    {run.shopify_revenue_window != null
                      ? formatCurrency(run.shopify_revenue_window)
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">FB spend window</dt>
                  <dd className="text-sm font-medium">
                    {run.fb_spend_window != null ? formatCurrency(run.fb_spend_window) : '—'}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-6">
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-center">
                  <p className="text-xs text-muted-foreground">Prev</p>
                  <p className="text-lg font-bold">{run.prev_member_count ?? '—'}</p>
                </div>
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-center">
                  <p className="text-xs text-muted-foreground">New</p>
                  <p className="text-lg font-bold">{run.new_member_count ?? '—'}</p>
                </div>
                <div className="rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-center">
                  <p className="text-xs text-muted-foreground">Added</p>
                  <p className="text-lg font-bold text-green-400">{run.added_count ?? 0}</p>
                </div>
                <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-center">
                  <p className="text-xs text-muted-foreground">Removed</p>
                  <p className="text-lg font-bold text-red-400">{run.removed_count ?? 0}</p>
                </div>
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-center">
                  <p className="text-xs text-muted-foreground">Kept</p>
                  <p className="text-lg font-bold">{run.kept_count ?? 0}</p>
                </div>
                <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-center">
                  <p className="text-xs text-muted-foreground">Grace</p>
                  <p className="text-lg font-bold text-yellow-400">{run.grace_count ?? 0}</p>
                </div>
              </div>

              {run.error_msg && (
                <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 p-3">
                  <p className="text-xs font-semibold text-red-400">error_msg</p>
                  <pre className="mt-1 whitespace-pre-wrap break-all text-xs">{run.error_msg}</pre>
                </div>
              )}
            </CardContent>
          </Card>

          {/* report_json */}
          {run.report_json && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">report_json</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="max-h-96 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs">
                  {JSON.stringify(run.report_json, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Decisions */}
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CardTitle className="text-base">
                  Quyết định ({decisions?.length ?? 0})
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setActionFilter(null)}
                    className={`rounded-md px-3 py-1 text-xs transition-colors ${
                      actionFilter === null
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    Tất cả
                  </button>
                  <button
                    onClick={() => setActionFilter('add')}
                    className={`rounded-md px-3 py-1 text-xs transition-colors ${
                      actionFilter === 'add'
                        ? 'bg-green-500/30 text-green-400'
                        : 'bg-muted text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    + Add ({counts.add})
                  </button>
                  <button
                    onClick={() => setActionFilter('remove')}
                    className={`rounded-md px-3 py-1 text-xs transition-colors ${
                      actionFilter === 'remove'
                        ? 'bg-red-500/30 text-red-400'
                        : 'bg-muted text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    − Remove ({counts.remove})
                  </button>
                  <button
                    onClick={() => setActionFilter('keep')}
                    className={`rounded-md px-3 py-1 text-xs transition-colors ${
                      actionFilter === 'keep'
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    Keep ({counts.keep})
                  </button>
                  <button
                    onClick={() => setActionFilter('grace')}
                    className={`rounded-md px-3 py-1 text-xs transition-colors ${
                      actionFilter === 'grace'
                        ? 'bg-yellow-500/30 text-yellow-400'
                        : 'bg-muted text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    Grace ({counts.grace})
                  </button>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm theo product/variant/reason…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="max-w-md"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Product / Variant</TableHead>
                      <TableHead className="text-right">Units</TableHead>
                      <TableHead className="text-right">Rev 90d</TableHead>
                      <TableHead className="text-right">30d</TableHead>
                      <TableHead className="text-right">Refund%</TableHead>
                      <TableHead className="text-right">FB spend</TableHead>
                      <TableHead className="text-right">ROAS</TableHead>
                      <TableHead>In set</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="text-right">Priority</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {decLoading && (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center text-sm text-muted-foreground">
                          Đang tải…
                        </TableCell>
                      </TableRow>
                    )}
                    {!decLoading && filteredDecisions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center text-sm text-muted-foreground">
                          {decisions && decisions.length > 0
                            ? 'Không khớp filter'
                            : 'Lần chạy này không có decisions (có thể do status=failed)'}
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredDecisions.map((d) => (
                      <TableRow key={d.variant_id}>
                        <TableCell>
                          <ActionBadge action={d.recommended_action} />
                        </TableCell>
                        <TableCell className="max-w-[260px]">
                          <div className="truncate text-sm font-medium" title={d.product_title ?? ''}>
                            {d.product_title ?? '—'}
                          </div>
                          <div className="truncate text-xs text-muted-foreground" title={d.variant_title ?? ''}>
                            {d.variant_title ?? d.variant_id}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {d.shopify_units ?? 0}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {d.shopify_revenue != null ? formatCurrency(d.shopify_revenue) : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {d.shopify_recent_units_30d ?? 0}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {d.shopify_refund_pct != null ? `${Number(d.shopify_refund_pct).toFixed(1)}%` : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {d.fb_spend != null && d.fb_spend > 0 ? formatCurrency(d.fb_spend) : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {d.fb_roas != null ? Number(d.fb_roas).toFixed(2) : '—'}
                        </TableCell>
                        <TableCell>
                          {d.was_in_set ? (
                            <Badge variant="success">yes</Badge>
                          ) : (
                            <Badge variant="secondary">no</Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground" title={d.reason ?? ''}>
                          {d.reason ?? '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {d.priority_score != null ? Number(d.priority_score).toFixed(1) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
