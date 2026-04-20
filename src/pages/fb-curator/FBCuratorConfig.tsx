import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Save, RotateCcw } from 'lucide-react'

interface Criteria {
  id: number
  name: string
  is_active: boolean
  product_set_id: string
  window_days: number
  add_min_units: number
  add_min_roas: number
  add_organic_units_threshold: number
  add_momentum_recent_units: number
  remove_max_units: number
  remove_max_refund_pct: number
  remove_max_roas: number
  remove_min_spend_for_roas: number
  grace_first_order_days: number
  grace_low_spend_threshold: number
  cooldown_removed_days: number
  churn_cap_pct: number
  max_adds_per_cycle: number
  priority_aov_benchmark: number
  notes: string | null
  created_at: string
  updated_at: string
}

type EditableKey =
  | 'window_days'
  | 'add_min_units'
  | 'add_min_roas'
  | 'add_organic_units_threshold'
  | 'add_momentum_recent_units'
  | 'remove_max_units'
  | 'remove_max_refund_pct'
  | 'remove_max_roas'
  | 'remove_min_spend_for_roas'
  | 'grace_first_order_days'
  | 'grace_low_spend_threshold'
  | 'cooldown_removed_days'
  | 'churn_cap_pct'
  | 'max_adds_per_cycle'
  | 'priority_aov_benchmark'
  | 'notes'

interface FieldDef {
  key: EditableKey
  label: string
  hint: string
  group: 'window' | 'add' | 'remove' | 'grace' | 'churn'
  type: 'int' | 'num' | 'text'
  step?: string
}

const FIELDS: FieldDef[] = [
  // Window
  { key: 'window_days', label: 'Window (days)', hint: 'Số ngày nhìn lại Shopify orders', group: 'window', type: 'int' },
  // Add rules
  { key: 'add_min_units', label: 'Add – min units', hint: 'Đơn vị bán tối thiểu để được đề xuất add (có FB)', group: 'add', type: 'int' },
  { key: 'add_min_roas', label: 'Add – min ROAS', hint: 'ROAS tối thiểu nếu có FB spend', group: 'add', type: 'num', step: '0.1' },
  { key: 'add_organic_units_threshold', label: 'Add – organic units', hint: 'Units để add mà không cần FB data', group: 'add', type: 'int' },
  { key: 'add_momentum_recent_units', label: 'Add – momentum 30d units', hint: 'Units 30 ngày gần nhất để coi là momentum', group: 'add', type: 'int' },
  // Remove rules
  { key: 'remove_max_units', label: 'Remove – max units', hint: 'Dưới ngưỡng này thì đề xuất remove', group: 'remove', type: 'int' },
  { key: 'remove_max_refund_pct', label: 'Remove – max refund %', hint: 'Tỷ lệ refund vượt ngưỡng thì remove', group: 'remove', type: 'num', step: '0.5' },
  { key: 'remove_max_roas', label: 'Remove – max ROAS', hint: 'ROAS dưới ngưỡng và có spend thì remove', group: 'remove', type: 'num', step: '0.1' },
  { key: 'remove_min_spend_for_roas', label: 'Remove – min spend for ROAS', hint: 'Chỉ áp dụng rule ROAS nếu spend ≥ ngưỡng', group: 'remove', type: 'num', step: '5' },
  // Grace rules
  { key: 'grace_first_order_days', label: 'Grace – first order (days)', hint: 'Sản phẩm mới trong N ngày được miễn remove', group: 'grace', type: 'int' },
  { key: 'grace_low_spend_threshold', label: 'Grace – low spend $', hint: 'FB spend dưới ngưỡng thì miễn rule ROAS', group: 'grace', type: 'num', step: '5' },
  // Churn control
  { key: 'cooldown_removed_days', label: 'Cooldown (days)', hint: 'Variant vừa bị remove không được re-add trong N ngày', group: 'churn', type: 'int' },
  { key: 'churn_cap_pct', label: 'Churn cap %', hint: 'Giới hạn % thay đổi set mỗi lần chạy', group: 'churn', type: 'num', step: '1' },
  { key: 'max_adds_per_cycle', label: 'Max adds/cycle', hint: 'Tối đa variants được add mỗi lần', group: 'churn', type: 'int' },
  { key: 'priority_aov_benchmark', label: 'Priority AOV benchmark', hint: 'Dùng để xếp priority khi cắt tới churn cap', group: 'churn', type: 'num', step: '1' },
]

const GROUP_LABELS: Record<FieldDef['group'], string> = {
  window: 'Cửa sổ thời gian',
  add: 'Quy tắc ADD (thêm vào set)',
  remove: 'Quy tắc REMOVE (loại khỏi set)',
  grace: 'Grace period (miễn trừ)',
  churn: 'Kiểm soát churn + priority',
}

function groupBy<T, K extends string>(items: T[], key: (t: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>
  for (const it of items) {
    const k = key(it)
    if (!out[k]) out[k] = []
    out[k].push(it)
  }
  return out
}

export default function FBCuratorConfig() {
  const qc = useQueryClient()
  const [form, setForm] = useState<Record<string, string>>({})
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  const { data: criteria, isLoading } = useQuery({
    queryKey: ['fbc-criteria'],
    enabled: supabaseConfigured,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fbc_criteria_get').single()
      if (error) throw error
      return data as Criteria
    },
  })

  useEffect(() => {
    if (criteria) {
      const next: Record<string, string> = {}
      for (const f of FIELDS) {
        const v = (criteria as any)[f.key]
        next[f.key] = v == null ? '' : String(v)
      }
      setForm(next)
    }
  }, [criteria])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const patch: Record<string, any> = {}
      for (const f of FIELDS) {
        const raw = form[f.key]
        if (raw === undefined) continue
        if (f.type === 'text') {
          patch[f.key] = raw
        } else if (raw === '') {
          // skip empty → keep existing
        } else {
          const n = Number(raw)
          if (Number.isNaN(n)) throw new Error(`Giá trị "${f.label}" không hợp lệ`)
          patch[f.key] = n
        }
      }
      const { data, error } = await supabase.rpc('fbc_criteria_update', { p_patch: patch })
      if (error) throw error
      return data as Criteria[]
    },
    onSuccess: () => {
      setSaveMsg('Đã lưu ngưỡng mới. Lần chạy cron kế tiếp sẽ dùng giá trị này.')
      qc.invalidateQueries({ queryKey: ['fbc-criteria'] })
      setTimeout(() => setSaveMsg(null), 5000)
    },
    onError: (e: any) => {
      setSaveMsg(`Lỗi: ${e?.message || 'unknown'}`)
    },
  })

  const onChange = (k: string, v: string) => {
    setForm((prev) => ({ ...prev, [k]: v }))
  }

  const onReset = () => {
    if (!criteria) return
    const next: Record<string, string> = {}
    for (const f of FIELDS) {
      const v = (criteria as any)[f.key]
      next[f.key] = v == null ? '' : String(v)
    }
    setForm(next)
    setSaveMsg('Đã khôi phục giá trị hiện tại.')
    setTimeout(() => setSaveMsg(null), 3000)
  }

  const grouped = groupBy(FIELDS, (f) => f.group)

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
          <h1 className="text-2xl font-bold tracking-tight">Ngưỡng & quy tắc</h1>
          <p className="text-sm text-muted-foreground">
            Cấu hình cách curator quyết định ADD / REMOVE / GRACE variant
          </p>
        </div>
      </div>

      {isLoading && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">Đang tải…</CardContent>
        </Card>
      )}

      {criteria && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-base">
                Thông tin chung
                {criteria.is_active && <Badge variant="success">active</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">Name</dt>
                  <dd className="text-sm font-medium">{criteria.name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Product set</dt>
                  <dd className="font-mono text-xs">{criteria.product_set_id}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Updated at</dt>
                  <dd className="text-sm font-medium">
                    {new Date(criteria.updated_at).toLocaleString('vi-VN')}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">ID</dt>
                  <dd className="font-mono text-xs">{criteria.id}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {(Object.keys(grouped) as FieldDef['group'][]).map((g) => (
            <Card key={g}>
              <CardHeader>
                <CardTitle className="text-base">{GROUP_LABELS[g]}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {grouped[g].map((f) => (
                    <div key={f.key} className="space-y-1">
                      <Label htmlFor={f.key}>{f.label}</Label>
                      <Input
                        id={f.key}
                        type={f.type === 'text' ? 'text' : 'number'}
                        step={f.step}
                        value={form[f.key] ?? ''}
                        onChange={(e) => onChange(f.key, e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">{f.hint}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                value={form.notes ?? ''}
                onChange={(e) => onChange('notes', e.target.value)}
                placeholder="Ghi chú nội bộ (tuỳ chọn)"
              />
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center gap-3 sticky bottom-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-4 border-t">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {saveMutation.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
            </Button>
            <Button variant="outline" onClick={onReset} disabled={saveMutation.isPending}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Khôi phục
            </Button>
            {saveMsg && (
              <span className="text-sm text-muted-foreground">{saveMsg}</span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
