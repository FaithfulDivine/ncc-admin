import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Pencil, Check, X, Megaphone, Upload, AlertCircle, Calendar, RefreshCw } from 'lucide-react'

interface AdSpendRow {
  id: number
  date: string
  spend: number
  impressions: number
  clicks: number
  reach: number
  cpc: number
  cpm: number
  campaign_name: string
}

// ── Date range presets ──
type DatePreset = '7d' | '30d' | '60d' | '90d' | 'custom'

function getDateRange(preset: DatePreset, customFrom?: string, customTo?: string) {
  const today = new Date()
  const to = today.toISOString().slice(0, 10)

  if (preset === 'custom' && customFrom && customTo) {
    return { from: customFrom, to: customTo }
  }

  const daysMap: Record<string, number> = { '7d': 7, '30d': 30, '60d': 60, '90d': 90 }
  const days = daysMap[preset] || 30
  const from = new Date(today.getTime() - days * 86400000).toISOString().slice(0, 10)
  return { from, to }
}

export default function AdSpend() {
  const qc = useQueryClient()

  // ── Date range state ──
  const [datePreset, setDatePreset] = useState<DatePreset>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const { from: dateFrom, to: dateTo } = getDateRange(datePreset, customFrom, customTo)

  // ── Edit state ──
  const [editId, setEditId] = useState<number | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editSpend, setEditSpend] = useState('')
  const [editImpressions, setEditImpressions] = useState('')
  const [editClicks, setEditClicks] = useState('')
  const [editCampaign, setEditCampaign] = useState('')

  // ── Bulk add state ──
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkFrom, setBulkFrom] = useState('')
  const [bulkTo, setBulkTo] = useState('')
  const [bulkSpend, setBulkSpend] = useState('')
  const [bulkCampaign, setBulkCampaign] = useState('')

  // ── Sync error state ──
  const [syncError, setSyncError] = useState<string | null>(null)
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null)

  // ── Fetch ad spend from Supabase filtered by date range ──
  const { data: adSpend, isLoading } = useQuery({
    queryKey: ['fb-ad-spend-all', dateFrom, dateTo],
    enabled: supabaseConfigured,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('facebook_ad_spend')
        .select('*')
        .gte('date', dateFrom)
        .lte('date', dateTo)
        .order('date', { ascending: false })
        .limit(500)
      if (error) throw error
      return data as AdSpendRow[]
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (id: number) => {
      const spend = parseFloat(editSpend)
      if (isNaN(spend)) throw new Error('Invalid')
      const clicks = parseInt(editClicks) || 0
      const impressions = parseInt(editImpressions) || 0
      const { error } = await supabase.from('facebook_ad_spend').update({
        date: editDate,
        spend,
        impressions,
        clicks,
        campaign_name: editCampaign.trim(),
        cpc: clicks > 0 ? spend / clicks : 0,
        cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
        updated_at: new Date().toISOString(),
      }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fb-ad-spend-all'] })
      setEditId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('facebook_ad_spend').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fb-ad-spend-all'] }),
  })

  // ── Sync Facebook data: fetch from API and import to Supabase ──
  const syncFbMutation = useMutation({
    mutationFn: async () => {
      setSyncError(null)
      setSyncSuccess(null)

      const res = await fetch(`/api/facebook/ad-spend?from=${encodeURIComponent(dateFrom)}&to=${encodeURIComponent(dateTo)}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Facebook API error: ${res.status}`)
      }
      const data = await res.json()

      // Upsert all records to Supabase
      if (data && Array.isArray(data) && data.length > 0) {
        const rows = data.map((r: any) => ({
          ...r,
          cpc: r.clicks > 0 ? r.spend / r.clicks : 0,
          cpm: r.impressions > 0 ? (r.spend / r.impressions) * 1000 : 0,
        }))
        const { error } = await supabase.from('facebook_ad_spend').upsert(rows, { onConflict: 'date,campaign_name' })
        if (error) throw error
        return data.length
      }

      return 0
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ['fb-ad-spend-all'] })
      setSyncSuccess(`Import thành công ${count} bản ghi từ Facebook!`)
      setTimeout(() => setSyncSuccess(null), 5000)
    },
    onError: (err: Error) => {
      setSyncError(err.message)
    },
  })

  // ── Bulk add: spread spend evenly across date range ──
  const bulkAddMutation = useMutation({
    mutationFn: async () => {
      const totalSpend = parseFloat(bulkSpend)
      if (!bulkFrom || !bulkTo || isNaN(totalSpend)) throw new Error('Invalid')
      const fromDate = new Date(bulkFrom)
      const toDate = new Date(bulkTo)
      const days = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1)
      const dailySpend = totalSpend / days

      const rows = []
      for (let i = 0; i < days; i++) {
        const d = new Date(fromDate.getTime() + i * 86400000)
        rows.push({
          date: d.toISOString().slice(0, 10),
          spend: Math.round(dailySpend * 100) / 100,
          campaign_name: bulkCampaign.trim() || '',
          impressions: 0,
          clicks: 0,
          cpc: 0,
          cpm: 0,
        })
      }

      const { error } = await supabase.from('facebook_ad_spend').upsert(rows, { onConflict: 'date,campaign_name' })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fb-ad-spend-all'] })
      setBulkMode(false)
      setBulkSpend('')
      setBulkFrom('')
      setBulkTo('')
      setBulkCampaign('')
    },
  })

  const startEdit = (row: AdSpendRow) => {
    setEditId(row.id)
    setEditDate(row.date)
    setEditSpend(String(row.spend))
    setEditImpressions(String(row.impressions))
    setEditClicks(String(row.clicks))
    setEditCampaign(row.campaign_name)
  }

  const totalSpend = (adSpend || []).reduce((s, r) => s + r.spend, 0)
  const totalClicks = (adSpend || []).reduce((s, r) => s + r.clicks, 0)
  const totalImpressions = (adSpend || []).reduce((s, r) => s + r.impressions, 0)

  if (!supabaseConfigured) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Supabase chưa được cấu hình. Vào Settings để thiết lập.</p>
      </div>
    )
  }

  const presets: { key: DatePreset; label: string }[] = [
    { key: '7d', label: '7 ngày' },
    { key: '30d', label: '30 ngày' },
    { key: '60d', label: '60 ngày' },
    { key: '90d', label: '90 ngày' },
    { key: 'custom', label: 'Tùy chọn' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Chi phí quảng cáo</h1>
          <p className="text-muted-foreground">Quản lý chi phí Facebook Ads theo ngày</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => syncFbMutation.mutate()} disabled={syncFbMutation.isPending}>
            <Megaphone className="mr-2 h-4 w-4" />
            {syncFbMutation.isPending ? 'Đang tải...' : 'Nhập từ Facebook'}
          </Button>
          <Button variant="outline" onClick={() => setBulkMode(!bulkMode)}>
            <Upload className="mr-2 h-4 w-4" /> Nhập nhanh
          </Button>
        </div>
      </div>

      {/* Date Range Picker */}
      <div className="flex items-center gap-2 flex-wrap">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        {presets.map((p) => (
          <Button
            key={p.key}
            size="sm"
            variant={datePreset === p.key ? 'default' : 'outline'}
            onClick={() => setDatePreset(p.key)}
            className="h-8"
          >
            {p.label}
          </Button>
        ))}
        {datePreset === 'custom' && (
          <div className="flex items-center gap-2 ml-2">
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-8 w-36"
            />
            <span className="text-muted-foreground text-sm">—</span>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-8 w-36"
            />
          </div>
        )}
        <span className="text-xs text-muted-foreground ml-2">
          {dateFrom} → {dateTo}
        </span>
      </div>

      {/* Sync error/success messages */}
      {syncError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{syncError}</span>
          <Button size="sm" variant="ghost" className="ml-auto h-6 w-6 p-0" onClick={() => setSyncError(null)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
      {syncSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-400">
          <Check className="h-4 w-4 shrink-0" />
          <span>{syncSuccess}</span>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card className="bg-purple-500/10 border-purple-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Tổng chi</p>
              <Megaphone className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-bold">{formatCurrency(totalSpend)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Tổng clicks</p>
            <p className="mt-2 text-2xl font-bold">{formatNumber(totalClicks)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Tổng impressions</p>
            <p className="mt-2 text-2xl font-bold">{formatNumber(totalImpressions)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">CPC trung bình</p>
            <p className="mt-2 text-2xl font-bold">
              {totalClicks > 0 ? formatCurrency(totalSpend / totalClicks) : '$0.00'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Add */}
      {bulkMode && (
        <Card className="border-purple-500/30 bg-purple-500/5">
          <CardHeader>
            <CardTitle className="text-base">Nhập nhanh — chia đều chi phí theo ngày</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="text-xs text-muted-foreground">Từ ngày</label>
                <Input type="date" value={bulkFrom} onChange={(e) => setBulkFrom(e.target.value)} className="h-9 w-40" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Đến ngày</label>
                <Input type="date" value={bulkTo} onChange={(e) => setBulkTo(e.target.value)} className="h-9 w-40" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Tổng chi phí (USD)</label>
                <Input type="number" placeholder="500.00" value={bulkSpend} onChange={(e) => setBulkSpend(e.target.value)} className="h-9 w-32" step="0.01" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Campaign (tùy chọn)</label>
                <Input placeholder="All campaigns" value={bulkCampaign} onChange={(e) => setBulkCampaign(e.target.value)} className="h-9 w-44" />
              </div>
              <Button onClick={() => bulkAddMutation.mutate()} disabled={bulkAddMutation.isPending}>
                {bulkAddMutation.isPending ? 'Đang lưu...' : 'Lưu'}
              </Button>
              <Button variant="ghost" onClick={() => setBulkMode(false)}>Hủy</Button>
            </div>
            {bulkFrom && bulkTo && bulkSpend && (
              <p className="mt-2 text-xs text-muted-foreground">
                Sẽ chia {formatCurrency(parseFloat(bulkSpend) || 0)} đều cho{' '}
                {Math.max(1, Math.round((new Date(bulkTo).getTime() - new Date(bulkFrom).getTime()) / 86400000) + 1)} ngày
                = {formatCurrency((parseFloat(bulkSpend) || 0) / Math.max(1, Math.round((new Date(bulkTo).getTime() - new Date(bulkFrom).getTime()) / 86400000) + 1))}/ngày
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Chi tiết theo ngày ({adSpend?.length || 0} bản ghi)
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={() => qc.invalidateQueries({ queryKey: ['fb-ad-spend-all'] })}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="relative overflow-auto max-h-[600px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b">
                  <th className="py-3 text-left font-medium text-muted-foreground">Ngày</th>
                  <th className="py-3 text-left font-medium text-muted-foreground">Campaign</th>
                  <th className="py-3 text-right font-medium text-muted-foreground">Spend (USD)</th>
                  <th className="py-3 text-right font-medium text-muted-foreground">Impressions</th>
                  <th className="py-3 text-right font-medium text-muted-foreground">Clicks</th>
                  <th className="py-3 text-right font-medium text-muted-foreground">CPC</th>
                  <th className="py-3 text-right font-medium text-muted-foreground w-24"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Đang tải...</td></tr>
                )}

                {!isLoading && (!adSpend || adSpend.length === 0) && (
                  <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">
                    Chưa có dữ liệu. Bấm "Nhập từ Facebook" hoặc "Nhập nhanh" để bắt đầu.
                  </td></tr>
                )}

                {(adSpend || []).map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    {editId === row.id ? (
                      <>
                        <td className="py-2">
                          <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="h-8 w-36" />
                        </td>
                        <td className="py-2">
                          <Input value={editCampaign} onChange={(e) => setEditCampaign(e.target.value)} className="h-8" />
                        </td>
                        <td className="py-2">
                          <Input type="number" value={editSpend} onChange={(e) => setEditSpend(e.target.value)} className="h-8 text-right w-24" step="0.01" />
                        </td>
                        <td className="py-2">
                          <Input type="number" value={editImpressions} onChange={(e) => setEditImpressions(e.target.value)} className="h-8 text-right w-24" />
                        </td>
                        <td className="py-2">
                          <Input type="number" value={editClicks} onChange={(e) => setEditClicks(e.target.value)} className="h-8 text-right w-20" />
                        </td>
                        <td />
                        <td className="py-2 text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => updateMutation.mutate(row.id)}>
                              <Check className="h-4 w-4 text-green-400" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditId(null)}>
                              <X className="h-4 w-4 text-red-400" />
                            </Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-3 font-medium">{row.date}</td>
                        <td className="py-3 text-muted-foreground">{row.campaign_name || '—'}</td>
                        <td className="py-3 text-right font-medium">{formatCurrency(row.spend)}</td>
                        <td className="py-3 text-right">{formatNumber(row.impressions)}</td>
                        <td className="py-3 text-right">{formatNumber(row.clicks)}</td>
                        <td className="py-3 text-right text-muted-foreground">
                          {row.clicks > 0 ? formatCurrency(row.spend / row.clicks) : '—'}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(row)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
