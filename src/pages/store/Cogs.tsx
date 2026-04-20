import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  useCogsMapping,
  useSaveCogs,
  useDeleteCogs,
  useDeleteCogsGroup,
  useUpdateGroupMapping,
  useCogsExclusions,
  useSaveExclusion,
  useDeleteExclusion,
  usePhysicalProducts,
  useSavePhysicalProduct,
  useDeletePhysicalProduct,
  type CogsMapping,
  type CogsGroup,
  type CogsExclusion,
  type PhysicalProduct,
} from '@/hooks/useCogs'
import { sortSizes, formatCurrency } from '@/lib/utils'
import { QUERY_STALE } from '@/lib/queryDefaults'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import {
  ChevronDown,
  ChevronRight,
  Edit2,
  Trash2,
  Save,
  X,
  Plus,
  Check,
  Package,
  AlertTriangle,
  RefreshCw,
  Ban,
  ShoppingBag,
  Printer,
} from 'lucide-react'

// Extract product type from SKU using known types, with fallback
function extractTypeFromSku(sku: string, knownTypes: string[]): string {
  if (!sku) return ''
  const skuLower = sku.toLowerCase()

  const sorted = [...knownTypes].filter(Boolean).sort((a, b) => b.length - a.length)
  for (const kt of sorted) {
    if (skuLower.includes(kt.toLowerCase())) return kt.toLowerCase()
  }

  // Fallback A: space-split → first half → after underscore
  const spaceIdx = sku.indexOf(' ')
  if (spaceIdx > 0) {
    const firstHalf = sku.slice(0, spaceIdx)
    const uIdx = firstHalf.indexOf('_')
    if (uIdx >= 0) return firstHalf.slice(uIdx + 1).toLowerCase()
  }

  // Fallback B: underscore split → index 1
  const parts = sku.split('_')
  return parts.length >= 2 ? parts[1].toLowerCase() : ''
}

function parseItemType(sku: string, variantTitle: string, knownTypes: string[]): { type: string; size: string } {
  const vtParts = (variantTitle || '').split(' / ').map(p => p.trim())
  const size = vtParts[vtParts.length - 1] || ''
  const type = extractTypeFromSku(sku, knownTypes)
  return { type, size }
}

type TabKey = 'mapping' | 'pod' | 'exclusions' | 'physical'

export default function Cogs() {
  const [activeTab, setActiveTab] = useState<TabKey>('mapping')
  const { data: cogsData, isLoading } = useCogsMapping()
  const saveCogs = useSaveCogs()
  const deleteCogs = useDeleteCogs()
  const deleteGroup = useDeleteCogsGroup()
  const updateMapping = useUpdateGroupMapping()

  // Exclusions
  const { data: exclusions } = useCogsExclusions()
  const saveExclusion = useSaveExclusion()
  const deleteExclusion = useDeleteExclusion()
  const [newExclPattern, setNewExclPattern] = useState('')
  const [newExclReason, setNewExclReason] = useState('')

  // Physical products
  const { data: physicalProducts } = usePhysicalProducts()
  const savePhysical = useSavePhysicalProduct()
  const deletePhysical = useDeletePhysicalProduct()
  const [addingPhysical, setAddingPhysical] = useState(false)
  const [newPhysical, setNewPhysical] = useState<Partial<PhysicalProduct>>({})
  const [editingPhysicalId, setEditingPhysicalId] = useState<string | null>(null)
  const [editPhysical, setEditPhysical] = useState<Partial<PhysicalProduct>>({})

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRow, setEditRow] = useState<Partial<CogsMapping>>({})
  const [addingToGroup, setAddingToGroup] = useState<string | null>(null)
  const [newRow, setNewRow] = useState<Partial<CogsMapping>>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [addingNewStyle, setAddingNewStyle] = useState(false)
  const [newStyleName, setNewStyleName] = useState('')
  const [newStyleRow, setNewStyleRow] = useState<Partial<CogsMapping>>({
    base_cost: 0, shipping_cost: 0, shipping_extra: 0,
  })

  // Build grouped data
  const groups = useMemo<CogsGroup[]>(() => {
    if (!cogsData) return []

    const map = new Map<string, CogsMapping[]>()
    for (const item of cogsData) {
      const key = item.product_title
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }

    const result: CogsGroup[] = []
    for (const [style, items] of map) {
      items.sort((a, b) => sortSizes(a.variant_title || '', b.variant_title || ''))
      // Get shopify_variant_name from first item (same for all in group)
      const shopifyVariant = items[0]?.shopify_variant_name || ''
      result.push({ style, shopifyVariant, items })
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      return result.filter(
        (g) =>
          g.style.toLowerCase().includes(q) ||
          g.shopifyVariant?.toLowerCase().includes(q) ||
          g.items.some((i) => i.variant_title?.toLowerCase().includes(q)),
      )
    }

    return result.sort((a, b) => a.style.localeCompare(b.style))
  }, [cogsData, searchTerm])

  const toggleGroup = useCallback((style: string) => {
    setCollapsed((prev) => ({ ...prev, [style]: !prev[style] }))
  }, [])

  // Inline edit
  const startEdit = (item: CogsMapping) => {
    setEditingId(item.id)
    setEditRow({ ...item })
  }
  const cancelEdit = () => { setEditingId(null); setEditRow({}) }
  const saveEdit = async () => {
    if (!editRow.product_title || editRow.base_cost == null) return
    await saveCogs.mutateAsync(editRow as any)
    setEditingId(null); setEditRow({})
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa dòng này?')) return
    await deleteCogs.mutateAsync(id)
  }
  const handleDeleteGroup = async (group: CogsGroup) => {
    if (!confirm(`Xóa tất cả ${group.items.length} dòng của "${group.style}"?`)) return
    await deleteGroup.mutateAsync(group.items.map((i) => i.id))
  }

  // Add size to group
  const startAddToGroup = (style: string) => {
    setAddingToGroup(style)
    setNewRow({ product_title: style, base_cost: 0, shipping_cost: 0, shipping_extra: 0 })
  }
  const cancelAdd = () => { setAddingToGroup(null); setNewRow({}) }
  const saveNewRow = async () => {
    if (!newRow.product_title || newRow.base_cost == null) return
    await saveCogs.mutateAsync(newRow as any)
    setAddingToGroup(null); setNewRow({})
  }

  // Add new style group
  const saveNewStyle = async () => {
    if (!newStyleName.trim()) return
    await saveCogs.mutateAsync({
      product_title: newStyleName.trim(),
      variant_title: newStyleRow.variant_title || null,
      base_cost: Number(newStyleRow.base_cost || 0),
      shipping_cost: Number(newStyleRow.shipping_cost || 0),
      shipping_extra: Number(newStyleRow.shipping_extra || 0),
      shopify_variant_name: '',
    } as any)
    setAddingNewStyle(false)
    setNewStyleName('')
    setNewStyleRow({ base_cost: 0, shipping_cost: 0, shipping_extra: 0 })
  }

  const totalCost = useMemo(() => {
    if (!cogsData) return 0
    return cogsData.reduce((sum, i) => sum + i.base_cost + i.shipping_cost + i.shipping_extra, 0)
  }, [cogsData])

  // ── Known product types for SKU matching ──
  const knownTypes = useMemo(() => {
    if (!cogsData) return [] as string[]
    const set = new Set<string>()
    for (const c of cogsData) {
      if (c.shopify_variant_name) set.add(c.shopify_variant_name.trim())
      if (c.product_title) set.add(c.product_title.trim())
    }
    return Array.from(set)
  }, [cogsData])

  // ── Fetch recent orders to find unmapped variants ──
  const { data: orders, isLoading: ordersLoading, refetch: refetchOrders } = useQuery({
    queryKey: ['shopify-orders-for-cogs'],
    staleTime: QUERY_STALE.medium, // orders 90-ngày thay đổi chậm
    queryFn: async () => {
      const now = new Date()
      const from90 = new Date(now.getTime() - 90 * 86400000).toISOString()
      const res = await fetch(`/api/shopify/orders?from=${encodeURIComponent(from90)}&to=${encodeURIComponent(now.toISOString())}`)
      if (!res.ok) throw new Error('Không tải được đơn hàng')
      const data = await res.json()
      return Array.isArray(data) ? data as Array<{ line_items: Array<{ title: string; variant_title: string; sku: string; quantity: number }> }> : []
    },
    enabled: activeTab === 'pod',
  })

  // ── Helper: check if an item title matches any exclusion pattern ──
  const isExcluded = useCallback((title: string) => {
    if (!exclusions || exclusions.length === 0) return false
    const titleLower = title.toLowerCase()
    return exclusions.some(e => titleLower.includes(e.pattern.toLowerCase()))
  }, [exclusions])

  // ── Helper: check if an item matches a physical product ──
  const isPhysical = useCallback((title: string) => {
    if (!physicalProducts || physicalProducts.length === 0) return false
    const titleLower = title.toLowerCase()
    return physicalProducts.some(p => titleLower.includes(p.product_name.toLowerCase()))
  }, [physicalProducts])

  // ── Build POD unmapped variants list (excludes: mapped POD + exclusions + physical) ──
  const unmappedVariants = useMemo(() => {
    if (!orders || !cogsData) return []

    // Build set of mapped keys (lowercase)
    const mappedKeys = new Set<string>()
    for (const c of cogsData) {
      if (c.shopify_variant_name) {
        mappedKeys.add(`${c.shopify_variant_name.trim().toLowerCase()}||${(c.variant_title || '').trim().toLowerCase()}`)
      }
      mappedKeys.add(`${c.product_title.trim().toLowerCase()}||${(c.variant_title || '').trim().toLowerCase()}`)
    }

    const seen = new Map<string, { type: string; size: string; count: number; sampleTitle: string; sampleSku: string }>()
    for (const order of orders) {
      for (const item of order.line_items) {
        // Skip excluded products (upsells, add-ons)
        if (isExcluded(item.title)) continue
        // Skip physical products
        if (isPhysical(item.title)) continue

        const { type, size } = parseItemType(item.sku || '', item.variant_title, knownTypes)
        const displayType = type || item.title || item.variant_title || '(không rõ)'
        const key = `${displayType.toLowerCase()}||${size.toLowerCase()}`
        if (mappedKeys.has(key)) continue

        if (seen.has(key)) {
          seen.get(key)!.count += item.quantity
        } else {
          seen.set(key, { type: displayType, size, count: item.quantity, sampleTitle: item.title, sampleSku: item.sku || '' })
        }
      }
    }

    return Array.from(seen.values()).sort((a, b) => b.count - a.count)
  }, [orders, cogsData, knownTypes, isExcluded, isPhysical])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">COGS Management</h1>
          <p className="text-muted-foreground">
            Quản lý giá vốn theo supplier. {cogsData?.length || 0} dòng trong {groups.length} nhóm.
          </p>
        </div>
        {activeTab === 'mapping' && (
          <Button size="sm" onClick={() => setAddingNewStyle(true)} disabled={addingNewStyle}>
            <Plus className="mr-2 h-4 w-4" /> Thêm Supplier
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {([
          { key: 'mapping' as TabKey, icon: Package, label: 'Giá vốn POD', badge: cogsData?.length || 0, variant: 'secondary' as const },
          { key: 'pod' as TabKey, icon: Printer, label: 'Chưa có giá vốn', badge: unmappedVariants.length, variant: 'destructive' as const },
          { key: 'physical' as TabKey, icon: ShoppingBag, label: 'Sản phẩm vật lý', badge: physicalProducts?.length || 0, variant: 'secondary' as const },
          { key: 'exclusions' as TabKey, icon: Ban, label: 'Loại trừ', badge: exclusions?.length || 0, variant: 'secondary' as const },
        ]).map(tab => (
          <button
            key={tab.key}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.badge > 0 && <Badge variant={tab.variant} className="ml-1">{tab.badge}</Badge>}
          </button>
        ))}
      </div>

      {/* ════════ TAB 1: Giá vốn (existing COGS mapping) ════════ */}
      {activeTab === 'mapping' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{groups.length}</div>
                <p className="text-xs text-muted-foreground">Supplier Groups</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{cogsData?.length || 0}</div>
                <p className="text-xs text-muted-foreground">Total Entries</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  {cogsData && cogsData.length > 0
                    ? formatCurrency(totalCost / cogsData.length)
                    : '$0.00'}
                </div>
                <p className="text-xs text-muted-foreground">Avg Unit Cost</p>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <Input
            placeholder="Tìm theo supplier, size, hoặc Shopify variant..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />

          {/* Add New Style Form */}
          {addingNewStyle && (
            <Card className="border-primary/50">
              <CardContent className="pt-6">
                <p className="mb-3 text-sm font-medium">Thêm Supplier mới</p>
                <div className="flex items-end gap-3 flex-wrap">
                  <div>
                    <label className="text-xs text-muted-foreground">Supplier Name *</label>
                    <Input
                      className="mt-1 w-52"
                      value={newStyleName}
                      onChange={(e) => setNewStyleName(e.target.value)}
                      placeholder="e.g. US Hoodie 2D"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">First Size</label>
                    <Input
                      className="mt-1 w-24"
                      value={newStyleRow.variant_title || ''}
                      onChange={(e) => setNewStyleRow({ ...newStyleRow, variant_title: e.target.value })}
                      placeholder="e.g. S"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Base Cost</label>
                    <Input
                      className="mt-1 w-24"
                      type="number" step="0.01"
                      value={newStyleRow.base_cost ?? ''}
                      onChange={(e) => setNewStyleRow({ ...newStyleRow, base_cost: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Shipping</label>
                    <Input
                      className="mt-1 w-24"
                      type="number" step="0.01"
                      value={newStyleRow.shipping_cost ?? ''}
                      onChange={(e) => setNewStyleRow({ ...newStyleRow, shipping_cost: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Ship Extra</label>
                    <Input
                      className="mt-1 w-24"
                      type="number" step="0.01"
                      value={newStyleRow.shipping_extra ?? ''}
                      onChange={(e) => setNewStyleRow({ ...newStyleRow, shipping_extra: parseFloat(e.target.value) })}
                    />
                  </div>
                  <Button size="sm" onClick={saveNewStyle} disabled={!newStyleName.trim() || saveCogs.isPending}>
                    <Save className="mr-2 h-4 w-4" /> Lưu
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setAddingNewStyle(false); setNewStyleName('') }}>
                    <X className="mr-2 h-4 w-4" /> Hủy
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              Đang tải dữ liệu COGS...
            </div>
          ) : groups.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-20">
                <Package className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-lg font-medium">Chưa có dữ liệu COGS</p>
                <p className="text-sm text-muted-foreground">
                  Thêm supplier hoặc import dữ liệu để bắt đầu.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Supplier / Size</TableHead>
                    <TableHead>Shopify Variant</TableHead>
                    <TableHead className="text-right">Base Cost</TableHead>
                    <TableHead className="text-right">Shipping</TableHead>
                    <TableHead className="text-right">Ship Extra</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((group) => (
                    <GroupRows
                      key={group.style}
                      group={group}
                      isCollapsed={!!collapsed[group.style]}
                      onToggle={() => toggleGroup(group.style)}
                      onMappingSave={(name) =>
                        updateMapping.mutateAsync({ productTitle: group.style, shopifyVariantName: name })
                      }
                      editingId={editingId}
                      editRow={editRow}
                      onStartEdit={startEdit}
                      onCancelEdit={cancelEdit}
                      onSaveEdit={saveEdit}
                      onEditChange={setEditRow}
                      onDelete={handleDelete}
                      onDeleteGroup={() => handleDeleteGroup(group)}
                      addingToGroup={addingToGroup}
                      newRow={newRow}
                      onStartAdd={() => startAddToGroup(group.style)}
                      onCancelAdd={cancelAdd}
                      onSaveNewRow={saveNewRow}
                      onNewRowChange={setNewRow}
                      isSaving={saveCogs.isPending}
                    />
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}

      {/* ════════ TAB 2: Print on Demand — chưa có giá vốn ════════ */}
      {activeTab === 'pod' && (
        <>
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Sản phẩm POD trong 90 ngày gần đây chưa có giá vốn.
              Đã loại trừ sản phẩm vật lý và sản phẩm trong danh sách loại trừ.
            </p>
            <Button variant="outline" size="sm" onClick={() => refetchOrders()} disabled={ordersLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${ordersLoading ? 'animate-spin' : ''}`} />
              Tải lại
            </Button>
          </div>

          {ordersLoading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              Đang tải đơn hàng từ Shopify...
            </div>
          ) : unmappedVariants.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-20">
                <Check className="mb-4 h-12 w-12 text-emerald-500" />
                <p className="text-lg font-medium">Tất cả sản phẩm POD đã có giá vốn</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Loại SP (từ SKU)</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead className="text-right">Số lượng bán</TableHead>
                    <TableHead>Sản phẩm mẫu</TableHead>
                    <TableHead>SKU mẫu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unmappedVariants.map((v, i) => (
                    <TableRow key={`${v.type}||${v.size}`}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-orange-400 border-orange-400/30">
                          {v.type || '(trống)'}
                        </Badge>
                      </TableCell>
                      <TableCell>{v.size || '—'}</TableCell>
                      <TableCell className="text-right font-medium">{v.count}</TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[250px] truncate">
                        {v.sampleTitle}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate font-mono">
                        {v.sampleSku}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="border-t px-4 py-3 text-sm text-muted-foreground">
                Tổng: {unmappedVariants.length} loại chưa có giá vốn,{' '}
                {unmappedVariants.reduce((s, v) => s + v.count, 0)} sản phẩm đã bán.
              </div>
            </Card>
          )}
        </>
      )}

      {/* ════════ TAB 3: Sản phẩm vật lý ════════ */}
      {activeTab === 'physical' && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Sản phẩm vật lý — nhập thủ công giá vốn. Matching theo tên sản phẩm (chứa keyword).
            </p>
            <Button size="sm" onClick={() => { setAddingPhysical(true); setNewPhysical({}) }} disabled={addingPhysical}>
              <Plus className="mr-2 h-4 w-4" /> Thêm sản phẩm
            </Button>
          </div>

          {addingPhysical && (
            <Card className="border-primary/50">
              <CardContent className="pt-6">
                <p className="mb-3 text-sm font-medium">Thêm sản phẩm vật lý</p>
                <div className="flex items-end gap-3 flex-wrap">
                  <div>
                    <label className="text-xs text-muted-foreground">Tên / Keyword *</label>
                    <Input className="mt-1 w-60" value={newPhysical.product_name || ''}
                      onChange={e => setNewPhysical({ ...newPhysical, product_name: e.target.value })}
                      placeholder="e.g. Stainless Steel Tumbler" autoFocus />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Variant</label>
                    <Input className="mt-1 w-24" value={newPhysical.variant || ''}
                      onChange={e => setNewPhysical({ ...newPhysical, variant: e.target.value })}
                      placeholder="e.g. 20oz" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Base Cost</label>
                    <Input className="mt-1 w-24" type="number" step="0.01"
                      value={newPhysical.base_cost ?? ''} onChange={e => setNewPhysical({ ...newPhysical, base_cost: parseFloat(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Shipping</label>
                    <Input className="mt-1 w-24" type="number" step="0.01"
                      value={newPhysical.shipping_cost ?? ''} onChange={e => setNewPhysical({ ...newPhysical, shipping_cost: parseFloat(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Ship Extra</label>
                    <Input className="mt-1 w-24" type="number" step="0.01"
                      value={newPhysical.shipping_extra ?? ''} onChange={e => setNewPhysical({ ...newPhysical, shipping_extra: parseFloat(e.target.value) })} />
                  </div>
                  <Button size="sm" disabled={!newPhysical.product_name?.trim() || savePhysical.isPending}
                    onClick={async () => {
                      await savePhysical.mutateAsync(newPhysical as any)
                      setAddingPhysical(false); setNewPhysical({})
                    }}>
                    <Save className="mr-2 h-4 w-4" /> Lưu
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAddingPhysical(false)}>
                    <X className="mr-2 h-4 w-4" /> Hủy
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {!physicalProducts || physicalProducts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-20">
                <ShoppingBag className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-lg font-medium">Chưa có sản phẩm vật lý</p>
                <p className="text-sm text-muted-foreground">Thêm sản phẩm vật lý để tính giá vốn riêng.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên sản phẩm / Keyword</TableHead>
                    <TableHead>Variant</TableHead>
                    <TableHead className="text-right">Base Cost</TableHead>
                    <TableHead className="text-right">Shipping</TableHead>
                    <TableHead className="text-right">Ship Extra</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {physicalProducts.map(p => {
                    const isEditing = editingPhysicalId === p.id
                    const total = p.base_cost + p.shipping_cost + p.shipping_extra

                    if (isEditing) {
                      return (
                        <TableRow key={p.id} className="bg-primary/5">
                          <TableCell>
                            <Input className="h-8 w-60" value={editPhysical.product_name || ''}
                              onChange={e => setEditPhysical({ ...editPhysical, product_name: e.target.value })} />
                          </TableCell>
                          <TableCell>
                            <Input className="h-8 w-24" value={editPhysical.variant || ''}
                              onChange={e => setEditPhysical({ ...editPhysical, variant: e.target.value })} />
                          </TableCell>
                          <TableCell>
                            <Input className="h-8 w-24 text-right" type="number" step="0.01"
                              value={editPhysical.base_cost ?? ''} onChange={e => setEditPhysical({ ...editPhysical, base_cost: parseFloat(e.target.value) })} />
                          </TableCell>
                          <TableCell>
                            <Input className="h-8 w-24 text-right" type="number" step="0.01"
                              value={editPhysical.shipping_cost ?? ''} onChange={e => setEditPhysical({ ...editPhysical, shipping_cost: parseFloat(e.target.value) })} />
                          </TableCell>
                          <TableCell>
                            <Input className="h-8 w-24 text-right" type="number" step="0.01"
                              value={editPhysical.shipping_extra ?? ''} onChange={e => setEditPhysical({ ...editPhysical, shipping_extra: parseFloat(e.target.value) })} />
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency((editPhysical.base_cost || 0) + (editPhysical.shipping_cost || 0) + (editPhysical.shipping_extra || 0))}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={savePhysical.isPending}
                                onClick={async () => {
                                  await savePhysical.mutateAsync(editPhysical as any)
                                  setEditingPhysicalId(null)
                                }}>
                                <Save className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingPhysicalId(null)}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    }

                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.product_name}</TableCell>
                        <TableCell className="text-muted-foreground">{p.variant || '—'}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.base_cost)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.shipping_cost)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.shipping_extra)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(total)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => { setEditingPhysicalId(p.id); setEditPhysical({ ...p }) }}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                              onClick={async () => { if (confirm('Xóa sản phẩm này?')) await deletePhysical.mutateAsync(p.id) }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}

      {/* ════════ TAB 4: Loại trừ ════════ */}
      {activeTab === 'exclusions' && (
        <>
          <p className="text-sm text-muted-foreground">
            Sản phẩm có tên chứa keyword dưới đây sẽ bị loại khỏi tính COGS (upsell, add-on, bảo hiểm...).
          </p>

          {/* Add new exclusion */}
          <Card className="border-dashed">
            <CardContent className="pt-6">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Keyword (tên sản phẩm chứa) *</label>
                  <Input className="mt-1" value={newExclPattern}
                    onChange={e => setNewExclPattern(e.target.value)}
                    placeholder="e.g. Peace Of Mind Protection, Upgrade to 1-Day"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newExclPattern.trim()) {
                        saveExclusion.mutateAsync({ pattern: newExclPattern.trim(), reason: newExclReason.trim() || undefined })
                        setNewExclPattern(''); setNewExclReason('')
                      }
                    }} />
                </div>
                <div className="w-48">
                  <label className="text-xs text-muted-foreground">Lý do</label>
                  <Input className="mt-1" value={newExclReason}
                    onChange={e => setNewExclReason(e.target.value)}
                    placeholder="e.g. Upsell" />
                </div>
                <Button size="sm" disabled={!newExclPattern.trim() || saveExclusion.isPending}
                  onClick={async () => {
                    await saveExclusion.mutateAsync({ pattern: newExclPattern.trim(), reason: newExclReason.trim() || undefined })
                    setNewExclPattern(''); setNewExclReason('')
                  }}>
                  <Plus className="mr-2 h-4 w-4" /> Thêm
                </Button>
              </div>
            </CardContent>
          </Card>

          {!exclusions || exclusions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-20">
                <Ban className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-lg font-medium">Chưa có sản phẩm loại trừ</p>
                <p className="text-sm text-muted-foreground">Thêm keyword để loại trừ sản phẩm upsell/add-on khỏi COGS.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    <TableHead>Lý do</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exclusions.map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.pattern}</TableCell>
                      <TableCell className="text-muted-foreground">{e.reason || '—'}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                          onClick={async () => { if (confirm(`Xóa "${e.pattern}"?`)) await deleteExclusion.mutateAsync(e.id) }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

// ── Group Rows Component ──
interface GroupRowsProps {
  group: CogsGroup
  isCollapsed: boolean
  onToggle: () => void
  onMappingSave: (name: string) => Promise<any>
  editingId: string | null
  editRow: Partial<CogsMapping>
  onStartEdit: (item: CogsMapping) => void
  onCancelEdit: () => void
  onSaveEdit: () => void
  onEditChange: (row: Partial<CogsMapping>) => void
  onDelete: (id: string) => void
  onDeleteGroup: () => void
  addingToGroup: string | null
  newRow: Partial<CogsMapping>
  onStartAdd: () => void
  onCancelAdd: () => void
  onSaveNewRow: () => void
  onNewRowChange: (row: Partial<CogsMapping>) => void
  isSaving: boolean
}

function GroupRows({
  group, isCollapsed, onToggle, onMappingSave,
  editingId, editRow, onStartEdit, onCancelEdit, onSaveEdit, onEditChange,
  onDelete, onDeleteGroup,
  addingToGroup, newRow, onStartAdd, onCancelAdd, onSaveNewRow, onNewRowChange,
  isSaving,
}: GroupRowsProps) {
  const [editingMapping, setEditingMapping] = useState(false)
  const [mappingValue, setMappingValue] = useState(group.shopifyVariant || '')
  const [savingMapping, setSavingMapping] = useState(false)

  const avgCost = group.items.reduce(
    (s, i) => s + i.base_cost + i.shipping_cost + i.shipping_extra, 0,
  ) / group.items.length

  const handleMappingSave = async () => {
    setSavingMapping(true)
    try {
      await onMappingSave(mappingValue.trim())
      setEditingMapping(false)
    } finally {
      setSavingMapping(false)
    }
  }

  return (
    <>
      {/* Group Header */}
      <TableRow className="cursor-pointer bg-muted/30 hover:bg-muted/50" onClick={onToggle}>
        <TableCell>
          {isCollapsed
            ? <ChevronRight className="h-4 w-4" />
            : <ChevronDown className="h-4 w-4" />}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{group.style}</span>
            <Badge variant="secondary">{group.items.length} sizes</Badge>
          </div>
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          {editingMapping ? (
            <div className="flex items-center gap-1">
              <Input
                className="h-8 w-48"
                value={mappingValue}
                onChange={(e) => setMappingValue(e.target.value)}
                placeholder="Shopify variant name..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleMappingSave()
                  if (e.key === 'Escape') setEditingMapping(false)
                }}
              />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleMappingSave} disabled={savingMapping}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingMapping(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <button
              className="flex items-center gap-1.5 rounded px-2 py-1 text-sm hover:bg-accent transition-colors"
              onClick={() => { setMappingValue(group.shopifyVariant || ''); setEditingMapping(true) }}
            >
              {group.shopifyVariant ? (
                <span className="text-foreground">{group.shopifyVariant}</span>
              ) : (
                <span className="text-muted-foreground italic">Chưa ánh xạ</span>
              )}
              <Edit2 className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </TableCell>
        <TableCell className="text-right font-medium" colSpan={3}>
          Avg: {formatCurrency(avgCost)}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onStartAdd}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDeleteGroup}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {/* Size Detail Rows */}
      {!isCollapsed && group.items.map((item) => {
        const isEditing = editingId === item.id
        const total = item.base_cost + item.shipping_cost + item.shipping_extra

        if (isEditing) {
          return (
            <TableRow key={item.id} className="bg-primary/5">
              <TableCell></TableCell>
              <TableCell>
                <Input className="h-8 w-32" value={editRow.variant_title || ''}
                  onChange={(e) => onEditChange({ ...editRow, variant_title: e.target.value })}
                  placeholder="Size" />
              </TableCell>
              <TableCell></TableCell>
              <TableCell>
                <Input className="h-8 w-24 text-right" type="number" step="0.01"
                  value={editRow.base_cost ?? ''} onChange={(e) => onEditChange({ ...editRow, base_cost: parseFloat(e.target.value) })} />
              </TableCell>
              <TableCell>
                <Input className="h-8 w-24 text-right" type="number" step="0.01"
                  value={editRow.shipping_cost ?? ''} onChange={(e) => onEditChange({ ...editRow, shipping_cost: parseFloat(e.target.value) })} />
              </TableCell>
              <TableCell>
                <Input className="h-8 w-24 text-right" type="number" step="0.01"
                  value={editRow.shipping_extra ?? ''} onChange={(e) => onEditChange({ ...editRow, shipping_extra: parseFloat(e.target.value) })} />
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency((editRow.base_cost || 0) + (editRow.shipping_cost || 0) + (editRow.shipping_extra || 0))}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onSaveEdit} disabled={isSaving}>
                    <Save className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCancelEdit}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )
        }

        return (
          <TableRow key={item.id}>
            <TableCell></TableCell>
            <TableCell className="pl-10 text-muted-foreground">{item.variant_title || '—'}</TableCell>
            <TableCell></TableCell>
            <TableCell className="text-right">{formatCurrency(item.base_cost)}</TableCell>
            <TableCell className="text-right">{formatCurrency(item.shipping_cost)}</TableCell>
            <TableCell className="text-right">{formatCurrency(item.shipping_extra)}</TableCell>
            <TableCell className="text-right font-medium">{formatCurrency(total)}</TableCell>
            <TableCell>
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onStartEdit(item)}>
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(item.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        )
      })}

      {/* Add New Size Row */}
      {!isCollapsed && addingToGroup === group.style && (
        <TableRow className="bg-green-500/5">
          <TableCell></TableCell>
          <TableCell>
            <Input className="h-8 w-32" value={newRow.variant_title || ''}
              onChange={(e) => onNewRowChange({ ...newRow, variant_title: e.target.value })}
              placeholder="Size (e.g. M)" autoFocus />
          </TableCell>
          <TableCell></TableCell>
          <TableCell>
            <Input className="h-8 w-24 text-right" type="number" step="0.01"
              value={newRow.base_cost ?? ''} onChange={(e) => onNewRowChange({ ...newRow, base_cost: parseFloat(e.target.value) })} placeholder="0.00" />
          </TableCell>
          <TableCell>
            <Input className="h-8 w-24 text-right" type="number" step="0.01"
              value={newRow.shipping_cost ?? ''} onChange={(e) => onNewRowChange({ ...newRow, shipping_cost: parseFloat(e.target.value) })} placeholder="0.00" />
          </TableCell>
          <TableCell>
            <Input className="h-8 w-24 text-right" type="number" step="0.01"
              value={newRow.shipping_extra ?? ''} onChange={(e) => onNewRowChange({ ...newRow, shipping_extra: parseFloat(e.target.value) })} placeholder="0.00" />
          </TableCell>
          <TableCell></TableCell>
          <TableCell>
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onSaveNewRow} disabled={isSaving}>
                <Save className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCancelAdd}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
