import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { QUERY_STALE } from '@/lib/queryDefaults'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Pencil, Check, X, Building2 } from 'lucide-react'

interface FixedCost {
  id: number
  name: string
  amount: number
  frequency: string
  active: boolean
  created_at: string
}

export default function FixedCosts() {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newFreq, setNewFreq] = useState('monthly')
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editFreq, setEditFreq] = useState('monthly')

  const { data: costs, isLoading } = useQuery({
    queryKey: ['fixed-costs'],
    enabled: supabaseConfigured,
    staleTime: QUERY_STALE.longLived,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fixed_costs')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as FixedCost[]
    },
  })

  const addMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(newAmount)
      if (!newName.trim() || isNaN(amount)) throw new Error('Invalid input')
      const { error } = await supabase.from('fixed_costs').insert({
        name: newName.trim(),
        amount,
        frequency: newFreq,
        active: true,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fixed-costs'] })
      setAdding(false)
      setNewName('')
      setNewAmount('')
      setNewFreq('monthly')
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (id: number) => {
      const amount = parseFloat(editAmount)
      if (!editName.trim() || isNaN(amount)) throw new Error('Invalid input')
      const { error } = await supabase.from('fixed_costs').update({
        name: editName.trim(),
        amount,
        frequency: editFreq,
        updated_at: new Date().toISOString(),
      }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fixed-costs'] })
      setEditId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('fixed_costs').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fixed-costs'] })
    },
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const { error } = await supabase.from('fixed_costs').update({ active, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fixed-costs'] })
    },
  })

  const totalMonthly = (costs || [])
    .filter(c => c.active)
    .reduce((s, c) => {
      if (c.frequency === 'monthly') return s + c.amount
      if (c.frequency === 'yearly') return s + c.amount / 12
      if (c.frequency === 'daily') return s + c.amount * 30
      return s + c.amount
    }, 0)

  const startEdit = (cost: FixedCost) => {
    setEditId(cost.id)
    setEditName(cost.name)
    setEditAmount(String(cost.amount))
    setEditFreq(cost.frequency)
  }

  const freqLabel = (f: string) => {
    if (f === 'monthly') return 'Tháng'
    if (f === 'yearly') return 'Năm'
    if (f === 'daily') return 'Ngày'
    return f
  }

  if (!supabaseConfigured) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Supabase chưa được cấu hình. Vào Settings để thiết lập.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Chi phí cố định</h1>
          <p className="text-muted-foreground">Quản lý chi phí cố định hàng tháng/năm cho P&L</p>
        </div>
        <Button onClick={() => setAdding(true)} disabled={adding}>
          <Plus className="mr-2 h-4 w-4" /> Thêm chi phí
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="bg-slate-500/10 border-slate-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Tổng/tháng</p>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-bold">{formatCurrency(totalMonthly)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Tổng/ngày</p>
            <p className="mt-2 text-2xl font-bold">{formatCurrency(totalMonthly / 30)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Số khoản</p>
            <p className="mt-2 text-2xl font-bold">{(costs || []).filter(c => c.active).length} / {(costs || []).length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Danh sách chi phí</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-3 text-left font-medium text-muted-foreground">Tên chi phí</th>
                  <th className="py-3 text-right font-medium text-muted-foreground">Số tiền (USD)</th>
                  <th className="py-3 text-center font-medium text-muted-foreground">Chu kỳ</th>
                  <th className="py-3 text-center font-medium text-muted-foreground">Trạng thái</th>
                  <th className="py-3 text-center font-medium text-muted-foreground">Quy tháng</th>
                  <th className="py-3 text-right font-medium text-muted-foreground w-28"></th>
                </tr>
              </thead>
              <tbody>
                {/* Add new row */}
                {adding && (
                  <tr className="border-b bg-primary/5">
                    <td className="py-2">
                      <Input
                        placeholder="Tên chi phí..."
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="h-8"
                        autoFocus
                      />
                    </td>
                    <td className="py-2">
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={newAmount}
                        onChange={(e) => setNewAmount(e.target.value)}
                        className="h-8 text-right"
                        step="0.01"
                      />
                    </td>
                    <td className="py-2">
                      <Select value={newFreq} onValueChange={setNewFreq}>
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Ngày</SelectItem>
                          <SelectItem value="monthly">Tháng</SelectItem>
                          <SelectItem value="yearly">Năm</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td />
                    <td />
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => addMutation.mutate()}>
                          <Check className="h-4 w-4 text-green-400" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setAdding(false)}>
                          <X className="h-4 w-4 text-red-400" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}

                {isLoading && (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Đang tải...</td></tr>
                )}

                {!isLoading && (!costs || costs.length === 0) && !adding && (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">
                    Chưa có chi phí nào. Bấm "Thêm chi phí" để bắt đầu.
                  </td></tr>
                )}

                {(costs || []).map((cost) => (
                  <tr key={cost.id} className={`border-b last:border-0 ${!cost.active ? 'opacity-50' : ''}`}>
                    {editId === cost.id ? (
                      <>
                        <td className="py-2">
                          <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8" />
                        </td>
                        <td className="py-2">
                          <Input
                            type="number"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="h-8 text-right"
                            step="0.01"
                          />
                        </td>
                        <td className="py-2">
                          <Select value={editFreq} onValueChange={setEditFreq}>
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="daily">Ngày</SelectItem>
                              <SelectItem value="monthly">Tháng</SelectItem>
                              <SelectItem value="yearly">Năm</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td />
                        <td />
                        <td className="py-2 text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => updateMutation.mutate(cost.id)}>
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
                        <td className="py-3 font-medium">{cost.name}</td>
                        <td className="py-3 text-right font-medium">{formatCurrency(cost.amount)}</td>
                        <td className="py-3 text-center">
                          <Badge variant="secondary">{freqLabel(cost.frequency)}</Badge>
                        </td>
                        <td className="py-3 text-center">
                          <button
                            className="cursor-pointer"
                            onClick={() => toggleMutation.mutate({ id: cost.id, active: !cost.active })}
                          >
                            <Badge variant={cost.active ? 'success' : 'outline'}>
                              {cost.active ? 'Active' : 'Off'}
                            </Badge>
                          </button>
                        </td>
                        <td className="py-3 text-center text-muted-foreground">
                          {formatCurrency(
                            cost.frequency === 'monthly' ? cost.amount
                            : cost.frequency === 'yearly' ? cost.amount / 12
                            : cost.amount * 30
                          )}/mo
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(cost)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                              onClick={() => { if (confirm(`Xóa "${cost.name}"?`)) deleteMutation.mutate(cost.id) }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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
