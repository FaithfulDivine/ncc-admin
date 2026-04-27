import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { QUERY_STALE } from '@/lib/queryDefaults'
import { formatCurrency, formatNumber, formatDateTimeVN } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ArrowUpRight, ArrowDownRight, Minus, ExternalLink, Search, Info } from 'lucide-react'

interface Compare {
  this_id: string
  this_started_at: string
  this_status: string
  this_dry_run: boolean
  this_new_member_count: number | null
  this_added: number | null
  this_removed: number | null
  this_kept: number | null
  this_grace: number | null
  this_shopify_revenue: number | null
  this_fb_spend: number | null
  this_window_since: string | null
  this_window_until: string | null
  prev_id: string | null
  prev_started_at: string | null
  prev_triggered_by: string | null
  prev_new_member_count: number | null
  prev_added: number | null
  prev_removed: number | null
  prev_kept: number | null
  prev_grace: number | null
  prev_shopify_revenue: number | null
  prev_fb_spend: number | null
  prev_window_since: string | null
  prev_window_until: string | null
  delta_member_count: number | null
  delta_member_pct: number | null
  delta_added: number | null
  delta_removed: number | null
  delta_kept: number | null
  delta_grace: number | null
  delta_shopify_revenue: number | null
  delta_fb_spend: number | null
  hours_since_prev: number | null
}

interface DiffRow {
  kind: string
  variant_id: string
  product_id: string | null
  product_title: string | null
  variant_title: string | null
  shopify_units: number | null
  shopify_revenue: number | null
  recommended_action: string | null
  reason: string | null
}

function DeltaArrow({ value, unit = '', invertColor = false }: { value: number | null; unit?: string; invertColor?: boolean }) {
  if (value == null) return <span className="text-muted-foreground">—</span>
  const positive = value > 0
  const negative = value < 0
  const good = invertColor ? negative : positive
  const bad = invertColor ? positive : negative
  const cls = good ? 'text-green-500' : bad ? 'text-red-500' : 'text-muted-foreground'
  const Icon = positive ? ArrowUpRight : negative ? ArrowDownRight : Minus
  const sign = positive ? '+' : ''
  return (
    <span className={`inline-flex items-center gap-0.5 font-mono text-sm ${cls}`}>
      <Icon className="h-3.5 w-3.5" />
      {sign}
      {unit === '$' ? formatCurrency(value) : formatNumber(value)}
      {unit && unit !== '$' ? unit : ''}
    </span>
  )
}

function MetricCard({
  label,
  thisValue,
  prevValue,
  delta,
  pct,
  fmt = 'num',
  invertColor = false,
}: {
  label: string
  thisValue: number | string | null
  prevValue: number | string | null
  delta: number | null
  pct?: number | null
  fmt?: 'num' | 'usd'
  invertColor?: boolean
}) {
  const renderVal = (v: number | string | null): string => {
    if (v == null) return '—'
    if (typeof v === 'string') return v
    return fmt === 'usd' ? formatCurrency(v) : formatNumber(v)
  }
  return (
    <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-lg font-bold font-mono">{renderVal(thisValue)}</span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">trước:</span>
        <span className="font-mono text-muted-foreground">{renderVal(prevValue)}</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <DeltaArrow value={delta} unit={fmt === 'usd' ? '$' : ''} invertColor={invertColor} />
        {pct != null && (
          <span
            className={`font-mono text-xs ${
              (invertColor ? pct < 0 : pct > 0)
                ? 'text-green-500'
                : (invertColor ? pct > 0 : pct < 0)
                  ? 'text-red-500'
                  : 'text-muted-foreground'
            }`}
          >
            ({pct > 0 ? '+' : ''}
            {pct.toFixed(1)}%)
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * One variant row inside the added / kept / removed columns.
 * Colour-coded border so the grouping remains obvious even when scrolling.
 */
function VariantRow({
  row,
  kind,
}: {
  row: DiffRow
  kind: 'added' | 'kept' | 'removed'
}) {
  const border =
    kind === 'added'
      ? 'border-green-500/20 bg-green-500/5'
      : kind === 'removed'
        ? 'border-red-500/20 bg-red-500/5'
        : 'border-border bg-muted/20'

  return (
    <li className={`flex items-start gap-2 rounded-md border px-2 py-1.5 text-xs ${border}`}>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium" title={row.product_title ?? ''}>
          {row.product_title ?? '—'}
        </div>
        <div className="truncate text-muted-foreground" title={row.variant_title ?? ''}>
          {row.variant_title ?? row.variant_id}
        </div>
        {row.reason && (
          <div className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground" title={row.reason}>
            {row.reason}
          </div>
        )}
      </div>
      <div className="shrink-0 text-right">
        <div className="font-mono">{row.shopify_units ?? 0}u</div>
        <div className="font-mono text-muted-foreground">
          {row.shopify_revenue != null ? formatCurrency(row.shopify_revenue) : '—'}
        </div>
        {row.recommended_action && (
          <div className="font-mono text-[10px] text-muted-foreground/70">
            {row.recommended_action}
          </div>
        )}
      </div>
    </li>
  )
}

function VariantColumn({
  title,
  kind,
  rows,
  search,
}: {
  title: string
  kind: 'added' | 'kept' | 'removed'
  rows: DiffRow[]
  search: string
}) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        (r.product_title ?? '').toLowerCase().includes(q) ||
        (r.variant_title ?? '').toLowerCase().includes(q) ||
        (r.variant_id ?? '').toLowerCase().includes(q) ||
        (r.reason ?? '').toLowerCase().includes(q),
    )
  }, [rows, search])

  const totalUnits = useMemo(() => rows.reduce((s, r) => s + (r.shopify_units ?? 0), 0), [rows])
  const totalRevenue = useMemo(
    () => rows.reduce((s, r) => s + Number(r.shopify_revenue ?? 0), 0),
    [rows],
  )

  const titleCls =
    kind === 'added'
      ? 'text-green-500'
      : kind === 'removed'
        ? 'text-red-500'
        : 'text-foreground'

  return (
    <div>
      <h4 className={`mb-2 flex items-baseline gap-2 text-sm font-semibold ${titleCls}`}>
        <span>{title}</span>
        <span className="font-mono text-xs text-muted-foreground">
          {formatNumber(rows.length)}
          {search.trim() && filtered.length !== rows.length ? ` · lọc ${formatNumber(filtered.length)}` : ''}
        </span>
      </h4>
      <div className="mb-2 rounded-md border border-border bg-muted/20 px-2 py-1 text-[11px] text-muted-foreground">
        <span className="font-mono">{formatNumber(totalUnits)}u</span>
        <span className="mx-2">·</span>
        <span className="font-mono">{formatCurrency(totalRevenue)}</span>
        <span className="ml-1">(90d)</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">—</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground">Không variant khớp từ khóa tìm.</p>
      ) : (
        <ul className="max-h-[600px] space-y-1.5 overflow-y-auto pr-1">
          {filtered.map((d) => (
            <VariantRow key={`${kind}-${d.variant_id}`} row={d} kind={kind} />
          ))}
        </ul>
      )}
    </div>
  )
}

export default function FBCuratorRunCompare({ runId }: { runId: string }) {
  const [search, setSearch] = useState('')

  const { data: cmp, isLoading } = useQuery({
    queryKey: ['fbc-run-compare', runId],
    enabled: supabaseConfigured && !!runId,
    staleTime: QUERY_STALE.longLived,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fbc_run_compare', { p_run_id: runId }).single()
      if (error) throw error
      return data as Compare
    },
  })

  const { data: diff, isLoading: diffLoading } = useQuery({
    queryKey: ['fbc-run-membership-diff', runId],
    enabled: supabaseConfigured && !!runId,
    staleTime: QUERY_STALE.longLived,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fbc_run_membership_diff', { p_run_id: runId })
      if (error) throw error
      return data as DiffRow[]
    },
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">Đang tải so sánh…</CardContent>
      </Card>
    )
  }
  if (!cmp) return null

  const noPrev = !cmp.prev_id
  const diffAdded = (diff ?? []).filter((d) => d.kind === 'added')
  const diffKept = (diff ?? []).filter((d) => d.kind === 'kept')
  const diffRemoved = (diff ?? []).filter((d) => d.kind === 'removed')

  // Detect "mass-add / external" runs that didn't record any per-variant decisions.
  // Signature: this run has positive member_count nhưng tổng ADD+KEEP+GRACE từ curator = 0.
  const positiveDecisionSum =
    (cmp.this_added ?? 0) + (cmp.this_kept ?? 0) + (cmp.this_grace ?? 0)
  const isExternalRun =
    (cmp.this_new_member_count ?? 0) > 0 &&
    positiveDecisionSum === 0 &&
    diffAdded.length === 0 &&
    diffKept.length === 0

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">So với run trước đó</CardTitle>
        </CardHeader>
        <CardContent>
          {noPrev ? (
            <p className="text-sm text-muted-foreground">Không có run nào trước đây để so sánh.</p>
          ) : (
            <>
              <div className="mb-4 rounded-md border border-border bg-muted/30 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Run trước:</span>
                    <Link
                      to={`/fb-curator/runs/${cmp.prev_id}`}
                      className="inline-flex items-center gap-1 font-mono text-primary hover:underline"
                    >
                      {cmp.prev_id?.slice(0, 8)}…
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                    <Badge variant="secondary">{cmp.prev_triggered_by ?? 'unknown'}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Chạy lúc:</span>
                    <span className="font-mono">{formatDateTimeVN(cmp.prev_started_at)}</span>
                    {cmp.hours_since_prev != null && (
                      <Badge variant="secondary">
                        cách đây {cmp.hours_since_prev < 1 ? `${Math.round(cmp.hours_since_prev * 60)}p` : `${cmp.hours_since_prev.toFixed(1)}h`}
                      </Badge>
                    )}
                  </div>
                </div>
                {(cmp.prev_window_since || cmp.this_window_since) && (
                  <div className="mt-1 flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>
                      Window trước: <span className="font-mono">{cmp.prev_window_since ?? '—'} → {cmp.prev_window_until ?? '—'}</span>
                    </span>
                    <span>
                      Window này: <span className="font-mono">{cmp.this_window_since ?? '—'} → {cmp.this_window_until ?? '—'}</span>
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                <MetricCard
                  label="Member count"
                  thisValue={cmp.this_new_member_count}
                  prevValue={cmp.prev_new_member_count}
                  delta={cmp.delta_member_count}
                  pct={cmp.delta_member_pct}
                />
                <MetricCard
                  label="ADD (trong run)"
                  thisValue={cmp.this_added}
                  prevValue={cmp.prev_added}
                  delta={cmp.delta_added}
                />
                <MetricCard
                  label="REMOVE (trong run)"
                  thisValue={cmp.this_removed}
                  prevValue={cmp.prev_removed}
                  delta={cmp.delta_removed}
                  invertColor
                />
                <MetricCard
                  label="KEEP"
                  thisValue={cmp.this_kept}
                  prevValue={cmp.prev_kept}
                  delta={cmp.delta_kept}
                />
                <MetricCard
                  label="GRACE"
                  thisValue={cmp.this_grace}
                  prevValue={cmp.prev_grace}
                  delta={cmp.delta_grace}
                />
                <MetricCard
                  label="Shopify rev (window)"
                  thisValue={cmp.this_shopify_revenue}
                  prevValue={cmp.prev_shopify_revenue}
                  delta={cmp.delta_shopify_revenue}
                  fmt="usd"
                />
                <MetricCard
                  label="FB spend (window)"
                  thisValue={cmp.this_fb_spend}
                  prevValue={cmp.prev_fb_spend}
                  delta={cmp.delta_fb_spend}
                  fmt="usd"
                  invertColor
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ─── Membership diff: 3 sections ─────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base">Chi tiết thành viên: Mới / Giữ / Loại</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Dựa trên snapshot FB set trước run (<span className="font-mono">was_in_set</span>) và kết quả apply thực tế của run này.
                Mới = ADD thành công trên variant chưa có · Giữ = đã có sẵn trước run · Loại = REMOVE thành công trên variant đã có.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Lọc theo product / variant / lý do…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full md:w-72"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {diffLoading ? (
            <p className="text-sm text-muted-foreground">Đang tải diff…</p>
          ) : isExternalRun ? (
            <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
              <div>
                <p className="font-medium text-yellow-300">Run này không ghi decisions per variant</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Đây là một run bulk / external (ví dụ mass-add từ bên ngoài), không chạy qua
                  logic curator nên không lưu từng quyết định. Danh sách "Bị bỏ" ({formatNumber(diffRemoved.length)})
                  bên dưới là các variant từng được curator đánh dấu trong lần chạy trước nhưng
                  không có trace trong run này — nên tham khảo cẩn trọng.
                </p>
              </div>
            </div>
          ) : (diff?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Không có dữ liệu decisions để so sánh.</p>
          ) : null}

          {!diffLoading && (diff?.length ?? 0) > 0 && (
            <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <VariantColumn
                title="Mới thêm vào set"
                kind="added"
                rows={diffAdded}
                search={search}
              />
              <VariantColumn
                title="Đã có sẵn (giữ nguyên)"
                kind="kept"
                rows={diffKept}
                search={search}
              />
              <VariantColumn
                title="Bị loại khỏi set"
                kind="removed"
                rows={diffRemoved}
                search={search}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
