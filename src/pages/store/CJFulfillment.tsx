/**
 * CJ Fulfillment Module
 *
 * 4 tabs:
 *   1. Dashboard    — connection status, wallet balance, KPI
 *   2. Order Queue  — cj_orders list, retry button
 *   3. SKU Mapping  — cj_product_map CRUD
 *   4. Settings     — inline link sang /settings để cấu hình credential
 */
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import * as Tabs from '@radix-ui/react-tabs'
import {
  Package2,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Plus,
  Trash2,
  ExternalLink,
  ShoppingCart,
} from 'lucide-react'
import {
  useCJStatus,
  useCJWallet,
  useCJOrders,
  useCJSkuMap,
  useCJFulfillOrder,
  useCJUpsertMap,
  useCJDeleteMap,
  CJ_STATUS_BADGE,
  type CJProductMapRow,
} from '@/hooks/useCJFulfillment'

export default function CJFulfillment() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <Package2 className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">CJ Fulfillment</h1>
        </div>
        <p className="mt-1 text-muted-foreground">
          Tích hợp CJ Dropshipping: map SKU · gửi order · sync tracking ngược về Shopify
        </p>
      </div>

      <Tabs.Root defaultValue="dashboard" className="w-full">
        <Tabs.List className="grid w-full grid-cols-4 gap-2 rounded-lg bg-muted p-1">
          {[
            { v: 'dashboard', label: 'Dashboard' },
            { v: 'queue', label: 'Order Queue' },
            { v: 'mapping', label: 'SKU Mapping' },
            { v: 'settings', label: 'Settings' },
          ].map((t) => (
            <Tabs.Trigger
              key={t.v}
              value={t.v}
              className="rounded-md py-2 px-4 text-sm font-medium transition-colors
                data-[state=active]:bg-background data-[state=active]:text-foreground
                data-[state=inactive]:text-muted-foreground hover:text-foreground"
            >
              {t.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="dashboard" className="space-y-6 pt-4">
          <DashboardTab />
        </Tabs.Content>

        <Tabs.Content value="queue" className="space-y-6 pt-4">
          <QueueTab />
        </Tabs.Content>

        <Tabs.Content value="mapping" className="space-y-6 pt-4">
          <MappingTab />
        </Tabs.Content>

        <Tabs.Content value="settings" className="space-y-6 pt-4">
          <SettingsTab />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Dashboard tab
// ─────────────────────────────────────────────────────────
function DashboardTab() {
  const status = useCJStatus()
  const wallet = useCJWallet()
  const orders = useCJOrders({ limit: 100 })

  const kpi = computeKPI(orders.data || [])

  return (
    <>
      {/* Connection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>CJ Connection</CardTitle>
              <CardDescription>Trạng thái kết nối CJ Developer API</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`h-3 w-3 rounded-full ${
                  status.data?.connected ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <span className="text-sm font-medium">
                {status.isLoading
                  ? 'Checking...'
                  : status.data?.connected
                    ? 'Connected'
                    : 'Disconnected'}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {status.data?.connected ? (
            <div className="flex items-center gap-2 rounded-lg bg-green-500/10 p-3">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <p className="text-sm text-green-300">Token CJ hợp lệ, sẵn sàng nhận order.</p>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 p-3">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <p className="text-sm text-red-300">
                {status.data?.reason || 'Chưa cấu hình CJ credential. Vào tab Settings.'}
              </p>
            </div>
          )}
          <Button
            onClick={() => status.refetch()}
            disabled={status.isFetching}
            variant="outline"
            className="mt-4 w-full"
          >
            {status.isFetching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Test Connection
          </Button>
        </CardContent>
      </Card>

      {/* KPI grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard
          icon={<Wallet className="h-4 w-4" />}
          label="Wallet Balance"
          value={
            wallet.data
              ? `${wallet.data.amount.toFixed(2)} ${wallet.data.currency}`
              : wallet.isLoading
                ? '...'
                : 'N/A'
          }
          warning={wallet.data?.low_balance}
          sub={
            wallet.data?.low_balance
              ? `Dưới ngưỡng $${wallet.data.min_balance_threshold}`
              : wallet.data
                ? `Frozen: $${wallet.data.frozen.toFixed(2)}`
                : undefined
          }
        />
        <KpiCard
          icon={<ShoppingCart className="h-4 w-4" />}
          label="Queued"
          value={String(kpi.queued)}
          sub="Chưa gửi CJ"
        />
        <KpiCard
          icon={<Package2 className="h-4 w-4" />}
          label="In Flight"
          value={String(kpi.inFlight)}
          sub="submitted / paid / shipped"
        />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Errors"
          value={String(kpi.error)}
          warning={kpi.error > 0}
          sub="Cần can thiệp tay"
        />
      </div>
    </>
  )
}

function KpiCard(props: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  warning?: boolean
}) {
  return (
    <Card className={props.warning ? 'border-yellow-500/50' : ''}>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">
          {props.icon}
          {props.label}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${props.warning ? 'text-yellow-400' : ''}`}>
          {props.value}
        </div>
        {props.sub && <p className="text-xs text-muted-foreground">{props.sub}</p>}
      </CardContent>
    </Card>
  )
}

function computeKPI(orders: ReturnType<typeof useCJOrders>['data'] extends (infer T)[] | undefined ? T[] : never[]) {
  let queued = 0,
    inFlight = 0,
    delivered = 0,
    error = 0
  for (const o of orders) {
    if (o.status === 'queued') queued++
    else if (['submitted', 'paid', 'in_production', 'shipped'].includes(o.status)) inFlight++
    else if (o.status === 'delivered') delivered++
    else if (o.status === 'error') error++
  }
  return { queued, inFlight, delivered, error }
}

// ─────────────────────────────────────────────────────────
// Queue tab
// ─────────────────────────────────────────────────────────
function QueueTab() {
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const orders = useCJOrders({ status: statusFilter, limit: 100 })
  const fulfill = useCJFulfillOrder()

  const toggleStatus = (s: string) => {
    setStatusFilter((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  const STATUS_CHIPS = ['queued', 'submitted', 'paid', 'shipped', 'delivered', 'error']

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Order Queue</CardTitle>
            <CardDescription>
              Các order đã nhận từ Shopify và trạng thái xử lý phía CJ
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => orders.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filter chips */}
        <div className="mb-4 flex flex-wrap gap-2">
          {STATUS_CHIPS.map((s) => {
            const cfg = CJ_STATUS_BADGE[s as keyof typeof CJ_STATUS_BADGE]
            const active = statusFilter.includes(s)
            return (
              <button
                key={s}
                onClick={() => toggleStatus(s)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  active ? `${cfg.color} text-white` : 'bg-muted text-muted-foreground'
                }`}
              >
                {cfg.label}
              </button>
            )
          })}
        </div>

        {orders.isLoading ? (
          <div className="py-8 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-6 w-6 animate-spin" />
          </div>
        ) : (orders.data?.length || 0) === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Chưa có order nào.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shopify #</TableHead>
                <TableHead>CJ Order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ship to</TableHead>
                <TableHead>Tracking</TableHead>
                <TableHead>Queued</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.data?.map((o) => {
                const cfg = CJ_STATUS_BADGE[o.status]
                const ship = o.cj_shipments?.[0]
                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">#{o.shopify_order_number}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {o.cj_order_number || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${cfg.color} text-white`}>{cfg.label}</Badge>
                      {o.error_message && (
                        <div className="mt-1 text-xs text-red-400">{o.error_message}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {o.ship_to_name}
                      <div className="text-muted-foreground">{o.ship_to_country}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {ship ? (
                        <>
                          {ship.tracking_number}
                          <div className="text-muted-foreground">{ship.carrier}</div>
                        </>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(o.queued_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {(o.status === 'queued' || o.status === 'error') && (
                        <Button
                          size="sm"
                          disabled={fulfill.isPending}
                          onClick={() => fulfill.mutate({ shopifyOrderId: o.shopify_order_id })}
                        >
                          {fulfill.isPending && fulfill.variables?.shopifyOrderId === o.shopify_order_id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            'Submit'
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────
// Mapping tab
// ─────────────────────────────────────────────────────────
function MappingTab() {
  const maps = useCJSkuMap()
  const upsert = useCJUpsertMap()
  const del = useCJDeleteMap()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Partial<CJProductMapRow>>({
    shopify_variant_id: undefined,
    shopify_sku: '',
    shopify_title: '',
    cj_product_id: '',
    cj_variant_id: '',
    cj_cost_usd: undefined,
    is_pod: false,
  })

  const resetForm = () => {
    setForm({
      shopify_variant_id: undefined,
      shopify_sku: '',
      shopify_title: '',
      cj_product_id: '',
      cj_variant_id: '',
      cj_cost_usd: undefined,
      is_pod: false,
    })
  }

  const handleSubmit = async () => {
    if (!form.shopify_variant_id || !form.cj_product_id || !form.cj_variant_id) return
    await upsert.mutateAsync(form)
    resetForm()
    setShowForm(false)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>SKU Mapping</CardTitle>
              <CardDescription>
                Liên kết Shopify variant với CJ product variant. Order chỉ auto-fulfill khi variant
                đã được map.
              </CardDescription>
            </div>
            <Button onClick={() => setShowForm(!showForm)}>
              <Plus className="mr-2 h-4 w-4" />
              {showForm ? 'Cancel' : 'Add Mapping'}
            </Button>
          </div>
        </CardHeader>
        {showForm && (
          <CardContent className="border-t pt-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Shopify Variant ID *</Label>
                <Input
                  type="number"
                  value={form.shopify_variant_id ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, shopify_variant_id: Number(e.target.value) || undefined })
                  }
                  placeholder="e.g. 46123456789"
                />
              </div>
              <div>
                <Label>Shopify SKU</Label>
                <Input
                  value={form.shopify_sku ?? ''}
                  onChange={(e) => setForm({ ...form, shopify_sku: e.target.value })}
                  placeholder="FD-TEE-001"
                />
              </div>
              <div className="md:col-span-2">
                <Label>Shopify Title</Label>
                <Input
                  value={form.shopify_title ?? ''}
                  onChange={(e) => setForm({ ...form, shopify_title: e.target.value })}
                  placeholder="Faith Over Fear Tee - Black / M"
                />
              </div>
              <div>
                <Label>CJ Product ID *</Label>
                <Input
                  value={form.cj_product_id ?? ''}
                  onChange={(e) => setForm({ ...form, cj_product_id: e.target.value })}
                />
              </div>
              <div>
                <Label>CJ Variant ID *</Label>
                <Input
                  value={form.cj_variant_id ?? ''}
                  onChange={(e) => setForm({ ...form, cj_variant_id: e.target.value })}
                />
              </div>
              <div>
                <Label>CJ Cost (USD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.cj_cost_usd ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, cj_cost_usd: Number(e.target.value) || undefined })
                  }
                />
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!form.is_pod}
                    onChange={(e) => setForm({ ...form, is_pod: e.target.checked })}
                  />
                  POD (Print on Demand)
                </label>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={handleSubmit} disabled={upsert.isPending}>
                {upsert.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Mapping
              </Button>
              {upsert.isError && (
                <span className="text-sm text-red-400">{upsert.error.message}</span>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardContent className="pt-6">
          {maps.isLoading ? (
            <Loader2 className="mx-auto h-6 w-6 animate-spin" />
          ) : (maps.data?.length || 0) === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Chưa có mapping nào. Bấm "Add Mapping" để bắt đầu.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shopify Variant</TableHead>
                  <TableHead>SKU / Title</TableHead>
                  <TableHead>CJ Product</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>POD</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {maps.data?.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">{m.shopify_variant_id}</TableCell>
                    <TableCell>
                      <div className="text-xs font-medium">{m.shopify_sku}</div>
                      <div className="text-xs text-muted-foreground">{m.shopify_title}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <div>{m.cj_product_id}</div>
                      <div className="text-muted-foreground">var: {m.cj_variant_id}</div>
                    </TableCell>
                    <TableCell>{m.cj_cost_usd ? `$${m.cj_cost_usd}` : '—'}</TableCell>
                    <TableCell>
                      {m.is_pod ? <Badge className="bg-purple-500 text-white">POD</Badge> : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm('Xoá mapping này?')) del.mutate(m.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  )
}

// ─────────────────────────────────────────────────────────
// Settings tab
// ─────────────────────────────────────────────────────────
function SettingsTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>CJ Credentials & Options</CardTitle>
        <CardDescription>
          Cấu hình CJ lưu chung trong bảng <code>system_settings</code>. Để chỉnh, mở trang
          Settings tổng.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium">Các setting key cần cấu hình:</p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            <li>
              <code>CJ_API_EMAIL</code> — email đăng ký CJ Developer
            </li>
            <li>
              <code>CJ_API_PASSWORD</code> — password CJ (⚠ nên dùng sub-account)
            </li>
            <li>
              <code>CJ_AUTO_FULFILL_ENABLED</code> — auto submit khi có order mới
            </li>
            <li>
              <code>CJ_AUTO_PAY_ENABLED</code> — auto pay từ ví CJ
            </li>
            <li>
              <code>CJ_WALLET_MIN_BALANCE</code> — ngưỡng cảnh báo ví (USD)
            </li>
            <li>
              <code>CJ_DEFAULT_SHIPPING</code> — carrier mặc định (CJPacket, YunExpress, USPS)
            </li>
            <li>
              <code>CJ_SKU_PREFIX_FILTER</code> — chỉ auto-fulfill SKU có prefix này
            </li>
            <li>
              <code>CJ_WEBHOOK_SECRET</code> — HMAC secret verify webhook
            </li>
          </ul>
        </div>
        <Button asChild variant="outline">
          <a href="/settings" className="flex items-center gap-2">
            <ExternalLink className="h-4 w-4" /> Mở trang Settings
          </a>
        </Button>
        <div className="rounded-lg bg-muted p-4 text-xs">
          <p className="font-medium">Webhook URL</p>
          <code className="mt-1 block break-all">
            {typeof window !== 'undefined' ? window.location.origin : ''}/api/cj/tracking-webhook
          </code>
          <p className="mt-2 text-muted-foreground">
            Paste URL này vào CJ Dashboard → Developer → Webhook Settings.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
