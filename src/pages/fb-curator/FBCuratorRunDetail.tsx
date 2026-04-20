import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { formatCurrency, formatDateTimeVN } from '@/lib/utils'
import { QUERY_STALE } from '@/lib/queryDefaults'
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
import { ArrowLeft, ArrowRight, Search, Copy, Download, TrendingUp, TrendingDown } from 'lucide-react'
import MatchLevelPanel from '@/components/MatchLevelPanel'

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

const fmtTime = (iso: string | null): string => formatDateTimeVN(iso, { showSeconds: true })

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

// ── Report helpers ───────────────────────────────────────────────────────────
function topByPriority(decisions: Decision[], action: string, n = 10): Decision[] {
  return decisions
    .filter((d) => d.recommended_action === action)
    .sort((a, b) => {
      const pa = Number(a.priority_score ?? 0)
      const pb = Number(b.priority_score ?? 0)
      if (pb !== pa) return pb - pa
      return Number(b.shopify_revenue ?? 0) - Number(a.shopify_revenue ?? 0)
    })
    .slice(0, n)
}

function groupReasons(decisions: Decision[], action: string): { reason: string; count: number }[] {
  const acc = new Map<string, number>()
  for (const d of decisions) {
    if (d.recommended_action !== action) continue
    const r = (d.reason ?? '').trim() || '(không có lý do)'
    acc.set(r, (acc.get(r) ?? 0) + 1)
  }
  return Array.from(acc.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
}

function sumBy(decisions: Decision[], action: string, field: keyof Decision): number {
  let s = 0
  for (const d of decisions) {
    if (d.recommended_action !== action) continue
    const v = d[field]
    if (typeof v === 'number' && !Number.isNaN(v)) s += v
  }
  return s
}

function buildNarrative(run: RunDetail, decisions: Decision[]): string {
  const prev = run.prev_member_count ?? 0
  const next = run.new_member_count ?? 0
  const delta = next - prev
  const added = run.added_count ?? 0
  const removed = run.removed_count ?? 0
  const kept = run.kept_count ?? 0
  const grace = run.grace_count ?? 0

  const topAdd = topByPriority(decisions, 'add', 1)[0]
  const topRemove = topByPriority(decisions, 'remove', 1)[0]
  const addRevenue = sumBy(decisions, 'add', 'shopify_revenue')
  const removedRevenueLost = sumBy(decisions, 'remove', 'shopify_revenue')

  const addedTitle = topAdd?.product_title ?? topAdd?.variant_title ?? ''
  const removedTitle = topRemove?.product_title ?? topRemove?.variant_title ?? ''

  const lines: string[] = []
  lines.push(
    `Lần chạy ${run.dry_run ? 'DRY-RUN (thử)' : 'APPLY (thật)'} — status: ${run.status}. ` +
      `Cửa sổ ${run.window_since ?? '?'} → ${run.window_until ?? '?'}. ` +
      `Product set bắt đầu với ${prev} members, kết thúc ${next} members ` +
      `(${delta >= 0 ? '+' : ''}${delta}${prev > 0 ? `, ${((delta / prev) * 100).toFixed(1)}%` : ''}).`,
  )
  lines.push(
    `Hành động: +${added} ADD, −${removed} REMOVE, giữ ${kept} KEEP, ${grace} GRACE.` +
      (run.churn_capped ? ' Churn-cap đã kích hoạt (giới hạn bớt để tránh xóa hàng loạt).' : ''),
  )
  if (added > 0 && topAdd) {
    lines.push(
      `Top ADD: "${addedTitle}" (priority ${Number(topAdd.priority_score ?? 0).toFixed(1)}, ` +
        `${topAdd.shopify_units ?? 0} units, ${formatCurrency(Number(topAdd.shopify_revenue ?? 0))} doanh thu 90d). ` +
        `Tổng doanh thu lịch sử các variant mới thêm: ${formatCurrency(addRevenue)}.`,
    )
  }
  if (removed > 0 && topRemove) {
    lines.push(
      `Top REMOVE: "${removedTitle}" (lý do: ${topRemove.reason ?? '—'}). ` +
        `Tổng doanh thu 90d các variant bị bớt: ${formatCurrency(removedRevenueLost)}.`,
    )
  }
  if (run.dry_run) {
    lines.push('⚠ Đây là dry-run — không có thay đổi thực tế trên Facebook catalog.')
  }
  return lines.join(' ')
}

function buildMarkdownReport(run: RunDetail, decisions: Decision[]): string {
  const prev = run.prev_member_count ?? 0
  const next = run.new_member_count ?? 0
  const delta = next - prev
  const topAdds = topByPriority(decisions, 'add', 10)
  const topRemoves = topByPriority(decisions, 'remove', 10)
  const addReasons = groupReasons(decisions, 'add')
  const removeReasons = groupReasons(decisions, 'remove')

  const fmt = (n: number | null | undefined): string =>
    n != null && Number.isFinite(Number(n)) ? formatCurrency(Number(n)) : '—'

  const lines: string[] = []
  lines.push(`# FB Best Seller Curator — Báo cáo lần chạy`)
  lines.push('')
  lines.push(`- **Run ID**: \`${run.id}\``)
  lines.push(`- **Chế độ**: ${run.dry_run ? 'DRY-RUN (thử)' : 'APPLY (thật)'}`)
  lines.push(`- **Status**: ${run.status}`)
  lines.push(`- **Trigger**: ${run.triggered_by ?? '—'}`)
  lines.push(`- **Bắt đầu**: ${run.started_at}`)
  lines.push(`- **Kết thúc**: ${run.finished_at ?? '(chưa xong)'} (elapsed ${run.elapsed_sec}s)`)
  lines.push(`- **Product set**: \`${run.product_set_id ?? '—'}\``)
  lines.push(`- **Window**: ${run.window_since ?? '—'} → ${run.window_until ?? '—'}`)
  lines.push(`- **Shopify revenue window**: ${fmt(run.shopify_revenue_window)}`)
  lines.push(`- **FB spend window**: ${fmt(run.fb_spend_window)}`)
  lines.push('')
  lines.push(`## Tóm tắt`)
  lines.push('')
  lines.push(buildNarrative(run, decisions))
  lines.push('')
  lines.push(`## Số lượng đầu → cuối`)
  lines.push('')
  lines.push(`| Trước | Sau | Δ | ADD | REMOVE | KEEP | GRACE |`)
  lines.push(`|------:|----:|--:|----:|-------:|-----:|------:|`)
  lines.push(
    `| ${prev} | ${next} | ${delta >= 0 ? '+' : ''}${delta} | +${run.added_count ?? 0} | −${
      run.removed_count ?? 0
    } | ${run.kept_count ?? 0} | ${run.grace_count ?? 0} |`,
  )
  lines.push('')
  lines.push(`## TOP ${topAdds.length} ADD`)
  lines.push('')
  if (topAdds.length === 0) {
    lines.push('_(không có variant nào được ADD lần này)_')
  } else {
    lines.push(`| # | Product / Variant | Units | Rev 90d | ROAS | Priority | Lý do |`)
    lines.push(`|--:|-------------------|------:|--------:|-----:|---------:|-------|`)
    topAdds.forEach((d, i) => {
      const title = `${d.product_title ?? ''} — ${d.variant_title ?? d.variant_id}`.trim()
      lines.push(
        `| ${i + 1} | ${title.replace(/\|/g, '/')} | ${d.shopify_units ?? 0} | ${fmt(
          d.shopify_revenue,
        )} | ${d.fb_roas != null ? Number(d.fb_roas).toFixed(2) : '—'} | ${
          d.priority_score != null ? Number(d.priority_score).toFixed(1) : '—'
        } | ${(d.reason ?? '').replace(/\|/g, '/')} |`,
      )
    })
  }
  lines.push('')
  lines.push(`## TOP ${topRemoves.length} REMOVE`)
  lines.push('')
  if (topRemoves.length === 0) {
    lines.push('_(không có variant nào bị REMOVE lần này)_')
  } else {
    lines.push(`| # | Product / Variant | Units | Rev 90d | Refund% | ROAS | Lý do |`)
    lines.push(`|--:|-------------------|------:|--------:|--------:|-----:|-------|`)
    topRemoves.forEach((d, i) => {
      const title = `${d.product_title ?? ''} — ${d.variant_title ?? d.variant_id}`.trim()
      lines.push(
        `| ${i + 1} | ${title.replace(/\|/g, '/')} | ${d.shopify_units ?? 0} | ${fmt(
          d.shopify_revenue,
        )} | ${
          d.shopify_refund_pct != null ? `${Number(d.shopify_refund_pct).toFixed(1)}%` : '—'
        } | ${d.fb_roas != null ? Number(d.fb_roas).toFixed(2) : '—'} | ${(d.reason ?? '').replace(
          /\|/g,
          '/',
        )} |`,
      )
    })
  }
  lines.push('')
  if (addReasons.length > 0 || removeReasons.length > 0) {
    lines.push(`## Phân tích lý do`)
    lines.push('')
    if (addReasons.length > 0) {
      lines.push(`### ADD — ${addReasons.reduce((s, r) => s + r.count, 0)} variants`)
      addReasons.forEach((r) => lines.push(`- ${r.reason}: **${r.count}**`))
      lines.push('')
    }
    if (removeReasons.length > 0) {
      lines.push(`### REMOVE — ${removeReasons.reduce((s, r) => s + r.count, 0)} variants`)
      removeReasons.forEach((r) => lines.push(`- ${r.reason}: **${r.count}**`))
      lines.push('')
    }
  }
  if (run.report_md) {
    lines.push(`## Phụ lục — report_md từ edge function`)
    lines.push('')
    lines.push(run.report_md)
  }
  return lines.join('\n')
}

function downloadTextFile(text: string, filename: string) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function FBCuratorRunDetail() {
  const { runId } = useParams<{ runId: string }>()
  const [filter, setFilter] = useState('')
  const [actionFilter, setActionFilter] = useState<string | null>(null)

  const { data: run, isLoading: runLoading } = useQuery({
    queryKey: ['fbc-run', runId],
    enabled: supabaseConfigured && !!runId,
    staleTime: QUERY_STALE.longLived, // một run đã hoàn tất thì immutable
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fbc_run_get', { p_run_id: runId! }).single()
      if (error) throw error
      return data as RunDetail
    },
  })

  const { data: decisions, isLoading: decLoading } = useQuery({
    queryKey: ['fbc-run-decisions', runId],
    enabled: supabaseConfigured && !!runId,
    staleTime: QUERY_STALE.longLived,
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

  // Derived data for report sections
  const topAdds = useMemo(() => topByPriority(decisions ?? [], 'add', 10), [decisions])
  const topRemoves = useMemo(() => topByPriority(decisions ?? [], 'remove', 10), [decisions])
  const addReasons = useMemo(() => groupReasons(decisions ?? [], 'add'), [decisions])
  const removeReasons = useMemo(() => groupReasons(decisions ?? [], 'remove'), [decisions])
  const narrative = useMemo(
    () => (run ? buildNarrative(run, decisions ?? []) : ''),
    [run, decisions],
  )
  const markdownReport = useMemo(
    () => (run ? buildMarkdownReport(run, decisions ?? []) : ''),
    [run, decisions],
  )

  const [copied, setCopied] = useState<'idle' | 'ok' | 'err'>('idle')
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdownReport)
      setCopied('ok')
    } catch {
      setCopied('err')
    }
    setTimeout(() => setCopied('idle'), 2500)
  }
  const handleDownload = () => {
    if (!run) return
    const shortId = run.id.slice(0, 8)
    const datePart = run.started_at?.slice(0, 10) ?? 'run'
    downloadTextFile(markdownReport, `fb-curator-${datePart}-${shortId}.md`)
  }

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

          {/* ─── Báo cáo tường thuật ──────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CardTitle className="text-base">Báo cáo tường thuật</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    <Copy className="mr-2 h-3.5 w-3.5" />
                    {copied === 'ok' ? 'Đã copy ✓' : copied === 'err' ? 'Lỗi copy' : 'Copy Markdown'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownload}>
                    <Download className="mr-2 h-3.5 w-3.5" />
                    Tải .md
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-foreground">{narrative}</p>
              {run.report_md && (
                <details className="mt-4 rounded-md border border-border bg-muted/30">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                    Xem báo cáo markdown đầy đủ từ edge function ({run.report_md.length} ký tự)
                  </summary>
                  <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words px-3 pb-3 text-xs">
                    {run.report_md}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>

          {/* ─── Before → After visualization ─────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Số lượng đầu → cuối</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center justify-around gap-6">
                <div className="text-center">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Trước</div>
                  <div className="font-mono text-4xl font-bold">{run.prev_member_count ?? 0}</div>
                  <div className="text-xs text-muted-foreground">members</div>
                </div>
                <ArrowRight className="h-8 w-8 text-muted-foreground" />
                <div className="text-center">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Sau</div>
                  <div className="font-mono text-4xl font-bold">{run.new_member_count ?? 0}</div>
                  <div className="text-xs text-muted-foreground">members</div>
                </div>
                {(() => {
                  const prev = run.prev_member_count ?? 0
                  const next = run.new_member_count ?? 0
                  const delta = next - prev
                  const pct = prev > 0 ? ((delta / prev) * 100).toFixed(1) : null
                  const cls =
                    delta > 0 ? 'text-green-500' : delta < 0 ? 'text-red-500' : 'text-muted-foreground'
                  return (
                    <div className="text-center">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Δ</div>
                      <div className={`font-mono text-4xl font-bold ${cls}`}>
                        {delta >= 0 ? '+' : ''}
                        {delta}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {pct !== null ? `(${pct}%)` : '—'}
                      </div>
                    </div>
                  )
                })()}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3 border-t border-border pt-3 text-sm">
                <span className="inline-flex items-center gap-1 text-green-500">
                  <TrendingUp className="h-4 w-4" />+{run.added_count ?? 0} thêm
                </span>
                <span className="inline-flex items-center gap-1 text-red-500">
                  <TrendingDown className="h-4 w-4" />−{run.removed_count ?? 0} bớt
                </span>
                <span className="text-muted-foreground">•</span>
                <span>{run.kept_count ?? 0} giữ</span>
                {run.grace_count ? <span className="text-yellow-500">{run.grace_count} grace</span> : null}
                {run.cooldown_blocked_count ? (
                  <span className="text-muted-foreground">
                    {run.cooldown_blocked_count} bị cooldown chặn
                  </span>
                ) : null}
                {run.churn_capped ? <Badge variant="warning">churn-capped</Badge> : null}
              </div>
            </CardContent>
          </Card>

          {/* ─── TOP ADD + TOP REMOVE ─────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  TOP {Math.min(topAdds.length, 10)} ADD
                  <span className="text-xs font-normal text-muted-foreground">
                    (tổng {counts.add} variants)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topAdds.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Không có variant nào được ADD lần này.</p>
                ) : (
                  <ol className="space-y-2">
                    {topAdds.map((d, i) => (
                      <li
                        key={d.variant_id}
                        className="flex items-start gap-3 rounded-md border border-green-500/20 bg-green-500/5 px-3 py-2"
                      >
                        <span className="mt-0.5 w-6 shrink-0 font-mono text-xs text-muted-foreground">
                          {i + 1}.
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium" title={d.product_title ?? ''}>
                            {d.product_title ?? '—'}
                          </div>
                          <div
                            className="truncate text-xs text-muted-foreground"
                            title={d.variant_title ?? ''}
                          >
                            {d.variant_title ?? d.variant_id}
                          </div>
                          {d.reason && (
                            <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {d.reason}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-mono text-sm font-semibold">
                            {d.shopify_units ?? 0}u
                          </div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {d.shopify_revenue != null ? formatCurrency(d.shopify_revenue) : '—'}
                          </div>
                          {d.priority_score != null && (
                            <div className="font-mono text-[10px] text-green-600">
                              P{Number(d.priority_score).toFixed(1)}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  TOP {Math.min(topRemoves.length, 10)} REMOVE
                  <span className="text-xs font-normal text-muted-foreground">
                    (tổng {counts.remove} variants)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topRemoves.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Không có variant nào bị REMOVE lần này.</p>
                ) : (
                  <ol className="space-y-2">
                    {topRemoves.map((d, i) => (
                      <li
                        key={d.variant_id}
                        className="flex items-start gap-3 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2"
                      >
                        <span className="mt-0.5 w-6 shrink-0 font-mono text-xs text-muted-foreground">
                          {i + 1}.
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium" title={d.product_title ?? ''}>
                            {d.product_title ?? '—'}
                          </div>
                          <div
                            className="truncate text-xs text-muted-foreground"
                            title={d.variant_title ?? ''}
                          >
                            {d.variant_title ?? d.variant_id}
                          </div>
                          {d.reason && (
                            <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {d.reason}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-mono text-sm font-semibold">
                            {d.shopify_units ?? 0}u
                          </div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {d.shopify_revenue != null ? formatCurrency(d.shopify_revenue) : '—'}
                          </div>
                          {d.shopify_refund_pct != null && Number(d.shopify_refund_pct) > 0 && (
                            <div className="font-mono text-[10px] text-red-500">
                              ↩{Number(d.shopify_refund_pct).toFixed(1)}%
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ─── Reasons breakdown ───────────────────────────── */}
          {(addReasons.length > 0 || removeReasons.length > 0) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Phân tích lý do</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-green-500">
                      Lý do ADD ({addReasons.reduce((s, r) => s + r.count, 0)})
                    </h4>
                    {addReasons.length === 0 ? (
                      <p className="text-xs text-muted-foreground">—</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {addReasons.map((r) => {
                          const total = addReasons.reduce((s, x) => s + x.count, 0)
                          const pct = total > 0 ? (r.count / total) * 100 : 0
                          return (
                            <li key={r.reason} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="mr-2 truncate" title={r.reason}>
                                  {r.reason}
                                </span>
                                <span className="shrink-0 font-mono">
                                  {r.count} · {pct.toFixed(0)}%
                                </span>
                              </div>
                              <div className="h-1.5 rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-green-500/60"
                                  style={{ width: `${pct.toFixed(1)}%` }}
                                />
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-red-500">
                      Lý do REMOVE ({removeReasons.reduce((s, r) => s + r.count, 0)})
                    </h4>
                    {removeReasons.length === 0 ? (
                      <p className="text-xs text-muted-foreground">—</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {removeReasons.map((r) => {
                          const total = removeReasons.reduce((s, x) => s + x.count, 0)
                          const pct = total > 0 ? (r.count / total) * 100 : 0
                          return (
                            <li key={r.reason} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="mr-2 truncate" title={r.reason}>
                                  {r.reason}
                                </span>
                                <span className="shrink-0 font-mono">
                                  {r.count} · {pct.toFixed(0)}%
                                </span>
                              </div>
                              <div className="h-1.5 rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-red-500/60"
                                  style={{ width: `${pct.toFixed(1)}%` }}
                                />
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Match-level panel for this specific run */}
          <MatchLevelPanel runId={run.id} title="Mức độ khớp FB spend · lần chạy này" />

          {/* report_json (collapsed) */}
          {run.report_json && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Dữ liệu thô (report_json)</CardTitle>
              </CardHeader>
              <CardContent>
                <details>
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                    Mở rộng JSON
                  </summary>
                  <pre className="mt-3 max-h-96 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs">
                    {JSON.stringify(run.report_json, null, 2)}
                  </pre>
                </details>
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
