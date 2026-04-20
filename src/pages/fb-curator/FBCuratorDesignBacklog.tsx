import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { QUERY_STALE } from '@/lib/queryDefaults'
import { formatCurrency, formatDateTimeVN } from '@/lib/utils'
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
  ArrowLeft,
  CheckCircle2,
  Trash2,
  Palette,
  RefreshCw,
  Clock,
} from 'lucide-react'

type Status = 'pending' | 'redesigned' | 'abandoned'

interface BacklogRow {
  id: string
  variant_id: string
  product_id: string | null
  product_title: string | null
  variant_title: string | null
  removed_from_run_id: string | null
  removed_at: string
  spend_at_removal: number
  roas_at_removal: number | null
  units_at_removal: number
  reason: string | null
  status: Status
  redesigned_at: string | null
  redesigned_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

interface BacklogStatsRow {
  status: Status
  cnt: number
  total_spend: number
  avg_roas: number | null
}

interface BacklogStats {
  pending: number
  redesigned: number
  abandoned: number
  total: number
  pending_spend: number
}

const STATUS_LABELS: Record<Status, string> = {
  pending: 'Chờ thiết kế lại',
  redesigned: 'Đã làm lại',
  abandoned: 'Đã bỏ',
}

const STATUS_VARIANTS: Record<Status, 'default' | 'success' | 'secondary'> = {
  pending: 'default',
  redesigned: 'success',
  abandoned: 'secondary',
}

export default function FBCuratorDesignBacklog() {
  const qc = useQueryClient()
  const [filterStatus, setFilterStatus] = useState<Status | 'all'>('pending')
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  const { data: rows, isLoading } = useQuery({
    queryKey: ['fbc-design-backlog', filterStatus],
    enabled: supabaseConfigured,
    staleTime: QUERY_STALE.shortLived,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fbc_design_backlog_list', {
        p_status: filterStatus === 'all' ? null : filterStatus,
      })
      if (error) throw error
      return (data ?? []) as BacklogRow[]
    },
  })

  const { data: stats } = useQuery({
    queryKey: ['fbc-design-backlog-stats'],
    enabled: supabaseConfigured,
    staleTime: QUERY_STALE.shortLived,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fbc_design_backlog_stats')
      if (error) throw error
      const rows = (data ?? []) as BacklogStatsRow[]
      const pick = (s: Status) => rows.find((r) => r.status === s)
      const pending = pick('pending')
      const redesigned = pick('redesigned')
      const abandoned = pick('abandoned')
      const totalCnt = rows.reduce((a, r) => a + Number(r.cnt || 0), 0)
      const stats: BacklogStats = {
        pending: Number(pending?.cnt ?? 0),
        redesigned: Number(redesigned?.cnt ?? 0),
        abandoned: Number(abandoned?.cnt ?? 0),
        total: totalCnt,
        pending_spend: Number(pending?.total_spend ?? 0),
      }
      return stats
    },
  })

  const markRedesigned = useMutation({
    mutationFn: async (id: string) => {
      setPendingAction(id)
      const { error } = await supabase.rpc('fbc_design_backlog_update_status', {
        p_id: id,
        p_status: 'redesigned',
        p_notes: null,
        p_actor: null,
      })
      if (error) throw error
    },
    onSettled: () => {
      setPendingAction(null)
      qc.invalidateQueries({ queryKey: ['fbc-design-backlog'] })
      qc.invalidateQueries({ queryKey: ['fbc-design-backlog-stats'] })
    },
  })

  const deleteRow = useMutation({
    mutationFn: async (id: string) => {
      setPendingAction(id)
      const { error } = await supabase.rpc('fbc_design_backlog_delete', { p_id: id })
      if (error) throw error
    },
    onSettled: () => {
      setPendingAction(null)
      qc.invalidateQueries({ queryKey: ['fbc-design-backlog'] })
      qc.invalidateQueries({ queryKey: ['fbc-design-backlog-stats'] })
    },
  })

  const sorted = useMemo(() => {
    if (!rows) return []
    return [...rows].sort((a, b) =>
      new Date(b.removed_at).getTime() - new Date(a.removed_at).getTime(),
    )
  }, [rows])

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
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Palette className="h-6 w-6" />
            Danh sách thiết kế tiềm năng
          </h1>
          <p className="text-sm text-muted-foreground">
            Các variant bị curator remove ở Tier 3 nhưng ROAS nằm trong ngưỡng tiềm năng
            (≥ Tier 2 min ROAS, &lt; Tier 3 min ROAS) — nhân viên thiết kế cải tiến lại, rồi đánh dấu trạng thái.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            qc.invalidateQueries({ queryKey: ['fbc-design-backlog'] })
            qc.invalidateQueries({ queryKey: ['fbc-design-backlog-stats'] })
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Clock className="h-4 w-4" />
                Chờ thiết kế
              </div>
              <div className="text-2xl font-bold">{stats.pending ?? 0}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Spend đã tiêu: {formatCurrency(stats.pending_spend ?? 0)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <CheckCircle2 className="h-4 w-4" />
                Đã làm lại
              </div>
              <div className="text-2xl font-bold">{stats.redesigned ?? 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Trash2 className="h-4 w-4" />
                Đã bỏ
              </div>
              <div className="text-2xl font-bold">{stats.abandoned ?? 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                Tổng
              </div>
              <div className="text-2xl font-bold">{stats.total ?? 0}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-3">
            <span>Variants</span>
            <div className="flex gap-1">
              {(['pending', 'redesigned', 'abandoned', 'all'] as const).map((s) => (
                <Button
                  key={s}
                  variant={filterStatus === s ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus(s)}
                >
                  {s === 'all' ? 'Tất cả' : STATUS_LABELS[s]}
                </Button>
              ))}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 text-center text-muted-foreground">Đang tải…</div>
          ) : sorted.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              Chưa có variant nào trong danh sách này.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product / Variant</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                  <TableHead className="text-right">ROAS</TableHead>
                  <TableHead>Removed</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Lý do</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((r) => {
                  const busy = pendingAction === r.id
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{r.product_title ?? '?'}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.variant_title ?? ''} <span className="font-mono">· {r.variant_id}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{r.units_at_removal}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.spend_at_removal)}</TableCell>
                      <TableCell className="text-right">
                        {r.roas_at_removal == null ? '—' : `${Number(r.roas_at_removal).toFixed(2)}x`}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatDateTimeVN(r.removed_at)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANTS[r.status]}>
                          {STATUS_LABELS[r.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-muted-foreground" title={r.reason ?? ''}>
                        {r.reason ?? '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {r.status !== 'redesigned' && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => {
                                if (confirm(`Đánh dấu "${r.product_title ?? r.variant_id}" là đã làm lại thiết kế mới?`)) {
                                  markRedesigned.mutate(r.id)
                                }
                              }}
                            >
                              <CheckCircle2 className="mr-1 h-4 w-4" />
                              Đã làm lại
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => {
                              if (confirm(`Xoá "${r.product_title ?? r.variant_id}" khỏi danh sách? (Không còn cải tiến được.)`)) {
                                deleteRow.mutate(r.id)
                              }
                            }}
                          >
                            <Trash2 className="mr-1 h-4 w-4" />
                            Xoá
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
