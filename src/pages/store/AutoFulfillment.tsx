import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  useAutoFulfillment,
  SHOPIFY_FIELDS,
  COLUMN_LETTERS,
  type FieldMappingRow,
} from '@/hooks/useAutoFulfillment'
import { detectCarrier } from '@/lib/carriers'
import { Truck, AlertCircle, CheckCircle2, Loader2, Plus, Trash2, GripVertical } from 'lucide-react'
import * as Tabs from '@radix-ui/react-tabs'

interface Order {
  id: string
  order_number: string
  created_at: string
  line_items?: Array<{ sku: string; quantity: number; title: string }>
  tracking_number?: string
  carrier?: string
  fulfillment_status?: string
}

interface PastOrder {
  orderNumber: string
  itemCode: string
  trackingNumber: string
  carrier: string
  fulfillmentStatus: string
}

export default function AutoFulfillment() {
  const {
    settings,
    gsheetStatus,
    loading,
    error,
    saveSettings,
    checkGsheetStatus,
    readSheet,
    writeSheet,
    getSheetMeta,
    syncOrdersToSheet,
    fulfillOrder,
  } = useAutoFulfillment()

  // ── Tab 1: Settings ──
  const [orderSheetId, setOrderSheetId] = useState(settings.orderSheetId)
  const [dataPngSheetId, setDataPngSheetId] = useState(settings.dataPngSheetId)
  const [fieldMappings, setFieldMappings] = useState<FieldMappingRow[]>(settings.fieldMappings)
  const [orderTab, setOrderTab] = useState(settings.orderTab)
  const [pasterOrdersTab, setPasterOrdersTab] = useState(settings.pasterOrdersTab)

  // ── Tab 2: Order Sync ──
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [pastOrders, setPastOrders] = useState<PastOrder[]>([])
  const [syncingOrder, setSyncingOrder] = useState<string | null>(null)

  // ── Tab 3: POD Lookup ──
  const [podOrders, setPodOrders] = useState<Order[]>([])
  const [podDataMap, setPodDataMap] = useState<Record<string, any>>({})

  // Fetch orders from Shopify
  const fetchOrders = async () => {
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.append('from', dateFrom)
      if (dateTo) params.append('to', dateTo)

      const res = await fetch(`/api/shopify/orders?${params}`)
      if (!res.ok) throw new Error('Failed to fetch orders')

      const data = await res.json()
      const fetchedOrders = Array.isArray(data) ? data : []

      // Enhance with carrier detection
      const enhanced = fetchedOrders.map((order: any) => ({
        ...order,
        tracking_number: order.tracking_number || '',
        carrier: order.carrier || '',
        fulfillment_status: order.fulfillment_status || 'pending',
      }))

      setOrders(enhanced)
    } catch (err: any) {
      console.error('Error fetching orders:', err)
    }
  }

  // Sync selected orders to sheet
  const handleSyncOrders = async () => {
    const toSync = orders.filter((o) => selectedOrders.has(o.id))
    if (toSync.length === 0) return

    const success = await syncOrdersToSheet(toSync)
    if (success) {
      setSelectedOrders(new Set())
    }
  }

  // Fetch past orders from pasterorders tab
  const handleImportTracking = async () => {
    if (!settings.orderSheetId) return

    // Find max column to determine read range
    const maxCol = settings.fieldMappings.reduce((max, m) => {
      const idx = m.column.charCodeAt(0) - 65
      return Math.max(max, idx)
    }, 4) // At least E
    const lastColLetter = String.fromCharCode(65 + maxCol)
    const range = `${settings.pasterOrdersTab}!A2:${lastColLetter}1000`
    const data = await readSheet(settings.orderSheetId, range)

    if (data) {
      const mappings = settings.fieldMappings

      // Helper: get value by shopifyField key from a row
      const getVal = (row: string[], shopifyField: string): string => {
        const m = mappings.find((fm) => fm.shopifyField === shopifyField)
        if (!m) return ''
        const idx = m.column.charCodeAt(0) - 65
        return row[idx] || ''
      }

      const past = data
        .filter((row) => getVal(row, 'tracking_number'))
        .map((row) => ({
          orderNumber: getVal(row, 'order_name') || getVal(row, 'order_number'),
          itemCode: getVal(row, 'line_item_sku'),
          trackingNumber: getVal(row, 'tracking_number'),
          carrier: getVal(row, 'carrier'),
          fulfillmentStatus: getVal(row, 'fulfillment_status'),
        }))

      setPastOrders(past)
    }
  }

  // Push tracking back to Shopify
  const handlePushTracking = async (order: PastOrder) => {
    setSyncingOrder(order.orderNumber)
    try {
      // Find matching Shopify order - simplified; in production would use order number lookup
      const success = await fulfillOrder(order.orderNumber, order.trackingNumber, order.carrier)
      if (success) {
        // Update local state
        setPastOrders((prev) =>
          prev.map((o) =>
            o.orderNumber === order.orderNumber ? { ...o, fulfillmentStatus: 'fulfilled' } : o
          )
        )
      }
    } finally {
      setSyncingOrder(null)
    }
  }

  // Load POD orders and their data
  const handleLoadPODOrders = async () => {
    // Filter orders with specific SKU patterns (e.g., start with "POD-")
    const podsWithTracking = orders.filter((o) => {
      const sku = o.line_items?.[0]?.sku || ''
      return sku.startsWith('POD-') && o.tracking_number
    })

    if (podsWithTracking.length > 0 && settings.dataPngSheetId) {
      // Try to read data from PNG sheet
      const range = `${settings.orderTab}!A2:E1000`
      const data = await readSheet(settings.dataPngSheetId, range)

      if (data) {
        const dataMap: Record<string, any> = {}
        data.forEach((row) => {
          if (row[0]) {
            dataMap[row[0]] = row
          }
        })
        setPodDataMap(dataMap)
      }
    }

    setPodOrders(podsWithTracking)
  }

  // Handle mapping row update
  const updateMappingRow = (index: number, field: keyof FieldMappingRow, value: string) => {
    const updated = [...fieldMappings]
    updated[index] = { ...updated[index], [field]: value }
    // Auto-detect source from shopifyField
    if (field === 'shopifyField') {
      const sf = SHOPIFY_FIELDS.find((f) => f.value === value)
      updated[index].source = sf?.group === 'POD Data' ? 'other_sheet' : 'shopify'
    }
    setFieldMappings(updated)
  }

  // Add new mapping row
  const addMappingRow = () => {
    // Find next unused column letter
    const usedCols = new Set(fieldMappings.map((m) => m.column))
    const nextCol = COLUMN_LETTERS.find((c) => !usedCols.has(c)) || 'A'
    setFieldMappings([
      ...fieldMappings,
      { shopifyField: '', column: nextCol, headerName: '', type: 'string', source: 'shopify' },
    ])
  }

  // Remove mapping row
  const removeMappingRow = (index: number) => {
    setFieldMappings(fieldMappings.filter((_, i) => i !== index))
  }

  // Save all settings
  const handleSaveSettings = () => {
    saveSettings({
      orderSheetId,
      dataPngSheetId,
      fieldMappings,
      orderTab,
      pasterOrdersTab,
    })
  }

  // Toggle order selection
  const toggleOrderSelection = (orderId: string) => {
    const updated = new Set(selectedOrders)
    if (updated.has(orderId)) {
      updated.delete(orderId)
    } else {
      updated.add(orderId)
    }
    setSelectedOrders(updated)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <Truck className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Auto Fulfillment</h1>
        </div>
        <p className="mt-1 text-muted-foreground">Manage order fulfillment with Google Sheets integration</p>
      </div>

      {/* Error Alert */}
      {error && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="flex items-center gap-2 pt-6">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs.Root defaultValue="settings" className="w-full">
        <Tabs.List className="grid w-full grid-cols-3 gap-2 rounded-lg bg-muted p-1">
          <Tabs.Trigger
            value="settings"
            className="rounded-md py-2 px-4 text-sm font-medium transition-colors
              data-[state=active]:bg-background data-[state=active]:text-foreground
              data-[state=inactive]:text-muted-foreground hover:text-foreground"
          >
            Settings
          </Tabs.Trigger>
          <Tabs.Trigger
            value="sync"
            className="rounded-md py-2 px-4 text-sm font-medium transition-colors
              data-[state=active]:bg-background data-[state=active]:text-foreground
              data-[state=inactive]:text-muted-foreground hover:text-foreground"
          >
            Order Sync
          </Tabs.Trigger>
          <Tabs.Trigger
            value="pod"
            className="rounded-md py-2 px-4 text-sm font-medium transition-colors
              data-[state=active]:bg-background data-[state=active]:text-foreground
              data-[state=inactive]:text-muted-foreground hover:text-foreground"
          >
            POD Lookup
          </Tabs.Trigger>
        </Tabs.List>

        {/* ── Tab 1: Settings ── */}
        <Tabs.Content value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Google Sheets Connection</CardTitle>
                  <CardDescription>Verify your Google Sheets setup</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`h-3 w-3 rounded-full ${gsheetStatus.connected ? 'bg-green-500' : 'bg-red-500'}`}
                  />
                  <span className="text-sm font-medium">
                    {gsheetStatus.connected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {gsheetStatus.connected && (
                <div className="flex items-center gap-2 rounded-lg bg-green-500/10 p-3">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <div className="text-sm">
                    <p className="font-medium text-green-300">Connected as: {gsheetStatus.email}</p>
                    <p className="text-xs text-green-400">Project: {gsheetStatus.projectId}</p>
                  </div>
                </div>
              )}
              {!gsheetStatus.connected && error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-500/10 p-3">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}
              <Button
                onClick={checkGsheetStatus}
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Test Connection
              </Button>
            </CardContent>
          </Card>

          {/* Sheet IDs */}
          <Card>
            <CardHeader>
              <CardTitle>Sheet Configuration</CardTitle>
              <CardDescription>Configure your Google Sheet IDs and tab names</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="order-sheet-id">Order Sheet ID</Label>
                <Input
                  id="order-sheet-id"
                  placeholder="1uJtHy3riFYq-hIM8WA183gUijfTEDrwPWvrqaCPpu_U"
                  value={orderSheetId}
                  onChange={(e) => setOrderSheetId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Find this in the Google Sheet URL: /spreadsheets/d/{' '}
                  <code className="bg-muted px-1 py-0.5">SHEET_ID</code>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="data-png-sheet-id">Data PNG Sheet ID</Label>
                <Input
                  id="data-png-sheet-id"
                  placeholder="1_MizdnjcYvu61APLFlFMsKQLFLQly7SU7AYNJyKIta8"
                  value={dataPngSheetId}
                  onChange={(e) => setDataPngSheetId(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="order-tab">Order Tab Name</Label>
                  <Input
                    id="order-tab"
                    placeholder="order"
                    value={orderTab}
                    onChange={(e) => setOrderTab(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paster-orders-tab">Paster Orders Tab Name</Label>
                  <Input
                    id="paster-orders-tab"
                    placeholder="pasterorders"
                    value={pasterOrdersTab}
                    onChange={(e) => setPasterOrdersTab(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Field Mapping */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Field Mapping</CardTitle>
                  <CardDescription>Map Shopify fields to Google Sheet columns</CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                  {fieldMappings.length} field{fieldMappings.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Header row */}
              <div className="grid grid-cols-[2fr_80px_1.5fr_100px_40px] gap-2 text-xs font-medium text-muted-foreground px-1">
                <span>Shopify Field</span>
                <span className="text-center">Column</span>
                <span>Header Name</span>
                <span className="text-center">Type</span>
                <span />
              </div>

              {/* Mapping rows */}
              <div className="space-y-2">
                {fieldMappings.map((mapping, index) => {
                  const fieldInfo = SHOPIFY_FIELDS.find((f) => f.value === mapping.shopifyField)
                  const isOtherSheet = mapping.source === 'other_sheet'

                  return (
                    <div
                      key={index}
                      className={`grid grid-cols-[2fr_80px_1.5fr_100px_40px] gap-2 items-center rounded-lg border p-2 ${
                        isOtherSheet ? 'border-purple-500/30 bg-purple-500/5' : 'border-border'
                      }`}
                    >
                      {/* Shopify Field dropdown */}
                      <select
                        value={mapping.shopifyField}
                        onChange={(e) => updateMappingRow(index, 'shopifyField', e.target.value)}
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">-- Select Field --</option>
                        {(() => {
                          const groups = [...new Set(SHOPIFY_FIELDS.map((f) => f.group))]
                          return groups.map((group) => (
                            <optgroup key={group} label={group}>
                              {SHOPIFY_FIELDS.filter((f) => f.group === group).map((f) => (
                                <option key={f.value} value={f.value}>
                                  {f.label}
                                </option>
                              ))}
                            </optgroup>
                          ))
                        })()}
                      </select>

                      {/* Column letter */}
                      <select
                        value={mapping.column}
                        onChange={(e) => updateMappingRow(index, 'column', e.target.value)}
                        className="h-9 rounded-md border border-input bg-background px-2 text-center font-mono text-sm font-bold ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {COLUMN_LETTERS.map((letter) => (
                          <option key={letter} value={letter}>
                            {letter}
                          </option>
                        ))}
                      </select>

                      {/* Header name */}
                      <Input
                        value={mapping.headerName}
                        onChange={(e) => updateMappingRow(index, 'headerName', e.target.value)}
                        placeholder="Column header"
                        className="h-9 text-sm"
                      />

                      {/* Type */}
                      <select
                        value={mapping.type}
                        onChange={(e) => updateMappingRow(index, 'type', e.target.value)}
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="string">String</option>
                        <option value="number">Number</option>
                      </select>

                      {/* Remove button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMappingRow(index)}
                        className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>

              {/* Add field button */}
              <Button variant="outline" onClick={addMappingRow} className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Add Field
              </Button>

              {/* Legend */}
              <div className="flex items-center gap-4 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full border border-border" />
                  <span>Shopify data</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full border border-purple-500/50 bg-purple-500/20" />
                  <span>From other sheet (POD Data)</span>
                </div>
              </div>

              <Button onClick={handleSaveSettings} className="w-full">
                Save Settings
              </Button>
            </CardContent>
          </Card>
        </Tabs.Content>

        {/* ── Tab 2: Order Sync ── */}
        <Tabs.Content value="sync" className="space-y-6">
          {/* Fetch Orders */}
          <Card>
            <CardHeader>
              <CardTitle>Fetch Orders</CardTitle>
              <CardDescription>Select date range and fetch Shopify orders</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date-from">From Date</Label>
                  <Input
                    id="date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date-to">To Date</Label>
                  <Input
                    id="date-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>

              <Button onClick={fetchOrders} disabled={loading} className="w-full">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Fetch Orders ({orders.length})
              </Button>
            </CardContent>
          </Card>

          {/* Orders Table */}
          {orders.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Orders</CardTitle>
                    <CardDescription>
                      {selectedOrders.size} of {orders.length} selected
                    </CardDescription>
                  </div>
                  <Button
                    onClick={handleSyncOrders}
                    disabled={selectedOrders.size === 0 || loading}
                    size="sm"
                  >
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Sync to Sheet
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <input
                            type="checkbox"
                            checked={
                              orders.length > 0 &&
                              selectedOrders.size === orders.length
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedOrders(new Set(orders.map((o) => o.id)))
                              } else {
                                setSelectedOrders(new Set())
                              }
                            }}
                            className="rounded border"
                          />
                        </TableHead>
                        <TableHead>Order #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Item Code</TableHead>
                        <TableHead>Tracking</TableHead>
                        <TableHead>Carrier</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => {
                        const carrier = detectCarrier(order.tracking_number || '')
                        return (
                          <TableRow key={order.id}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selectedOrders.has(order.id)}
                                onChange={() => toggleOrderSelection(order.id)}
                                className="rounded border"
                              />
                            </TableCell>
                            <TableCell className="font-medium">{order.order_number}</TableCell>
                            <TableCell className="text-sm">
                              {new Date(order.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-sm">
                              {order.line_items?.[0]?.sku || '-'}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {order.tracking_number || '-'}
                            </TableCell>
                            <TableCell>
                              {carrier.carrier !== 'Unknown' && (
                                <Badge variant="outline">{carrier.carrier}</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={order.fulfillment_status === 'fulfilled' ? 'default' : 'secondary'}>
                                {order.fulfillment_status || 'pending'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Import Tracking */}
          <Card>
            <CardHeader>
              <CardTitle>Import Tracking Numbers</CardTitle>
              <CardDescription>
                Import tracking numbers from the pasterorders tab and push to Shopify
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={handleImportTracking} disabled={loading} className="w-full">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Load from Paster Orders Tab
              </Button>

              {pastOrders.length > 0 && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order #</TableHead>
                        <TableHead>Item Code</TableHead>
                        <TableHead>Tracking</TableHead>
                        <TableHead>Carrier</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-24">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pastOrders.map((order) => (
                        <TableRow key={order.orderNumber}>
                          <TableCell className="font-medium">{order.orderNumber}</TableCell>
                          <TableCell>{order.itemCode}</TableCell>
                          <TableCell className="font-mono text-sm">{order.trackingNumber}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{order.carrier}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                order.fulfillmentStatus === 'fulfilled' ? 'default' : 'secondary'
                              }
                            >
                              {order.fulfillmentStatus}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              onClick={() => handlePushTracking(order)}
                              disabled={
                                syncingOrder === order.orderNumber ||
                                order.fulfillmentStatus === 'fulfilled'
                              }
                              size="sm"
                              variant="outline"
                            >
                              {syncingOrder === order.orderNumber ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Push'
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </Tabs.Content>

        {/* ── Tab 3: POD Lookup ── */}
        <Tabs.Content value="pod" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Print-on-Demand Orders</CardTitle>
              <CardDescription>
                View and manage orders with POD SKU prefix and lookup data from Data PNG sheet
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={handleLoadPODOrders} disabled={loading} className="w-full">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Load POD Orders
              </Button>

              {podOrders.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg bg-blue-50 p-3">
                    <p className="text-sm font-medium text-blue-900">
                      Found {podOrders.length} POD order{podOrders.length !== 1 ? 's' : ''}
                    </p>
                    <Button size="sm" variant="outline">
                      Fill Order Sheet
                    </Button>
                  </div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Order #</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>Tracking</TableHead>
                          <TableHead>Carrier</TableHead>
                          <TableHead>PNG Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {podOrders.map((order) => {
                          const sku = order.line_items?.[0]?.sku || ''
                          const podData = podDataMap[sku]
                          const carrier = detectCarrier(order.tracking_number || '')

                          return (
                            <TableRow key={order.id}>
                              <TableCell className="font-medium">{order.order_number}</TableCell>
                              <TableCell className="font-mono text-sm">{sku}</TableCell>
                              <TableCell className="font-mono text-sm">
                                {order.tracking_number || '-'}
                              </TableCell>
                              <TableCell>
                                {carrier.carrier !== 'Unknown' && (
                                  <Badge variant="outline">{carrier.carrier}</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {podData ? (
                                  <Badge variant="default">Found</Badge>
                                ) : (
                                  <Badge variant="secondary">-</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {podOrders.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted py-8">
                  <Truck className="mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium text-muted-foreground">No POD orders found</p>
                  <p className="text-xs text-muted-foreground">
                    Click "Load POD Orders" to search for orders with POD SKU prefix
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}
