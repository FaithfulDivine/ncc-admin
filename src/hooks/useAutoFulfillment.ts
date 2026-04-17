import { useState, useEffect, useCallback } from 'react'
import { supabase, supabaseConfigured } from '@/lib/supabase'

/**
 * Auto Fulfillment hook
 * Manages Google Sheets integration, order syncing, and Shopify fulfillments
 * Settings priority: Supabase → localStorage → defaults
 */

/** Single field mapping row */
export interface FieldMappingRow {
  shopifyField: string    // Shopify data source key
  column: string          // Sheet column letter (A-Z)
  headerName: string      // Column header name in sheet
  type: 'string' | 'number'
  source: 'shopify' | 'other_sheet'  // Where data comes from
}

/** Available Shopify fields for dropdown */
export const SHOPIFY_FIELDS = [
  { value: 'order_name', label: 'Order Name', group: 'Order' },
  { value: 'order_number', label: 'Order Number', group: 'Order' },
  { value: 'line_item_title', label: 'Line Item Title', group: 'Line Item' },
  { value: 'line_item_quantity', label: 'Line Item Quantity', group: 'Line Item' },
  { value: 'line_item_sku', label: 'Line Item SKU', group: 'Line Item' },
  { value: 'line_item_price', label: 'Line Item Price', group: 'Line Item' },
  { value: 'variant_color', label: 'Variant Color', group: 'Variant' },
  { value: 'variant_size', label: 'Variant Size', group: 'Variant' },
  { value: 'tracking_number', label: 'Tracking Number', group: 'Fulfillment' },
  { value: 'carrier', label: 'Carrier', group: 'Fulfillment' },
  { value: 'fulfillment_status', label: 'Fulfillment Status', group: 'Fulfillment' },
  { value: 'shipping_name', label: 'Shipping Name', group: 'Shipping' },
  { value: 'shipping_address1', label: 'Shipping Address 1', group: 'Shipping' },
  { value: 'shipping_address2', label: 'Shipping Address 2', group: 'Shipping' },
  { value: 'shipping_address_combined', label: 'Shipping Address (1+2)', group: 'Shipping' },
  { value: 'shipping_city', label: 'Shipping City', group: 'Shipping' },
  { value: 'shipping_province', label: 'Shipping Province', group: 'Shipping' },
  { value: 'shipping_zip', label: 'Shipping Zip', group: 'Shipping' },
  { value: 'shipping_country_code', label: 'Shipping Country Code', group: 'Shipping' },
  { value: 'shipping_phone', label: 'Shipping Phone', group: 'Shipping' },
  { value: 'mockup', label: 'Mockup (from other sheet)', group: 'POD Data' },
  { value: 'front_design', label: 'Front Design (from other sheet)', group: 'POD Data' },
  { value: 'back_design', label: 'Back Design (from other sheet)', group: 'POD Data' },
] as const

/** Column letters A-Z */
export const COLUMN_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

/** Legacy flat mapping (for backward compatibility) */
export interface LegacyFieldMapping {
  orderNumber: string
  itemCode: string
  trackingNumber: string
  carrier: string
  fulfillmentStatus: string
}

export interface AutoFulfillmentSettings {
  orderSheetId: string
  dataPngSheetId: string
  fieldMappings: FieldMappingRow[]
  orderTab: string
  pasterOrdersTab: string
  dataPngTab: string
}

const DEFAULT_FIELD_MAPPINGS: FieldMappingRow[] = [
  { shopifyField: 'order_name', column: 'B', headerName: 'ITEM-CODE', type: 'string', source: 'shopify' },
  { shopifyField: 'line_item_quantity', column: 'C', headerName: 'Quantity', type: 'number', source: 'shopify' },
  { shopifyField: 'line_item_title', column: 'D', headerName: 'PRODUCT', type: 'string', source: 'shopify' },
  { shopifyField: 'variant_color', column: 'E', headerName: 'Color', type: 'string', source: 'shopify' },
  { shopifyField: 'variant_size', column: 'F', headerName: 'Size', type: 'string', source: 'shopify' },
  { shopifyField: 'mockup', column: 'G', headerName: 'Mockup', type: 'string', source: 'other_sheet' },
  { shopifyField: 'front_design', column: 'H', headerName: 'Front Design', type: 'string', source: 'other_sheet' },
  { shopifyField: 'shipping_name', column: 'P', headerName: 'BUYER NAME', type: 'string', source: 'shopify' },
  { shopifyField: 'shipping_address_combined', column: 'Q', headerName: 'ADDRESS', type: 'string', source: 'shopify' },
  { shopifyField: 'shipping_city', column: 'R', headerName: 'CITY', type: 'string', source: 'shopify' },
  { shopifyField: 'shipping_province', column: 'S', headerName: 'PROVINCE', type: 'string', source: 'shopify' },
  { shopifyField: 'shipping_zip', column: 'T', headerName: 'POSTCODE', type: 'string', source: 'shopify' },
  { shopifyField: 'shipping_country_code', column: 'U', headerName: 'COUNTRY CODE', type: 'string', source: 'shopify' },
]

const DEFAULT_SETTINGS: AutoFulfillmentSettings = {
  orderSheetId: '',
  dataPngSheetId: '',
  fieldMappings: DEFAULT_FIELD_MAPPINGS,
  orderTab: 'order',
  pasterOrdersTab: 'pasterorders',
  dataPngTab: 'Sheet1',
}

/** Convert legacy flat mapping to new array format */
function migrateLegacyMapping(legacy: LegacyFieldMapping): FieldMappingRow[] {
  return [
    { shopifyField: 'order_name', column: legacy.orderNumber || 'A', headerName: 'Order Number', type: 'string', source: 'shopify' },
    { shopifyField: 'line_item_sku', column: legacy.itemCode || 'B', headerName: 'Item Code', type: 'string', source: 'shopify' },
    { shopifyField: 'tracking_number', column: legacy.trackingNumber || 'C', headerName: 'Tracking', type: 'string', source: 'shopify' },
    { shopifyField: 'carrier', column: legacy.carrier || 'D', headerName: 'Carrier', type: 'string', source: 'shopify' },
    { shopifyField: 'fulfillment_status', column: legacy.fulfillmentStatus || 'E', headerName: 'Status', type: 'string', source: 'shopify' },
  ]
}

/** Parse mapping from storage — handles both legacy and new format */
function parseFieldMappings(raw: unknown): FieldMappingRow[] {
  if (Array.isArray(raw)) return raw as FieldMappingRow[]
  if (raw && typeof raw === 'object' && 'orderNumber' in raw) {
    return migrateLegacyMapping(raw as LegacyFieldMapping)
  }
  return DEFAULT_FIELD_MAPPINGS
}

export function useAutoFulfillment() {
  const [settings, setSettings] = useState<AutoFulfillmentSettings>(() => {
    const stored = localStorage.getItem('auto-fulfillment-settings')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        // Migrate legacy fieldMappings if needed
        if (parsed.fieldMappings && !Array.isArray(parsed.fieldMappings)) {
          parsed.fieldMappings = migrateLegacyMapping(parsed.fieldMappings)
        }
        return { ...DEFAULT_SETTINGS, ...parsed }
      } catch { return DEFAULT_SETTINGS }
    }
    return DEFAULT_SETTINGS
  })

  const [gsheetStatus, setGsheetStatus] = useState<{
    connected: boolean
    email?: string
    projectId?: string
  }>({ connected: false })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Helper: extract Sheet ID from URL or return as-is
  const extractSheetId = (input: string): string => {
    const trimmed = (input || '').trim()
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
    return match ? match[1] : trimmed
  }

  // ── Load settings from Supabase on mount ──
  const loadSettingsFromSupabase = useCallback(async () => {
    if (!supabaseConfigured) return
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', [
          'GSHEET_ORDER_SHEET_ID',
          'GSHEET_DATA_PNG_SHEET_ID',
          'GSHEET_ORDER_TAB',
          'GSHEET_PASTERORDERS_TAB',
          'GSHEET_DATA_PNG_TAB',
          'GSHEET_FIELD_MAPPING',
        ])
      if (data && data.length > 0) {
        const map: Record<string, string> = {}
        for (const row of data) map[row.key] = row.value

        const fromDb: Partial<AutoFulfillmentSettings> = {}
        if (map['GSHEET_ORDER_SHEET_ID']) fromDb.orderSheetId = extractSheetId(map['GSHEET_ORDER_SHEET_ID'])
        if (map['GSHEET_DATA_PNG_SHEET_ID']) fromDb.dataPngSheetId = extractSheetId(map['GSHEET_DATA_PNG_SHEET_ID'])
        if (map['GSHEET_ORDER_TAB']) fromDb.orderTab = map['GSHEET_ORDER_TAB']
        if (map['GSHEET_PASTERORDERS_TAB']) fromDb.pasterOrdersTab = map['GSHEET_PASTERORDERS_TAB']
        if (map['GSHEET_DATA_PNG_TAB']) fromDb.dataPngTab = map['GSHEET_DATA_PNG_TAB']
        if (map['GSHEET_FIELD_MAPPING']) {
          try {
            const parsed = JSON.parse(map['GSHEET_FIELD_MAPPING'])
            fromDb.fieldMappings = parseFieldMappings(parsed)
          } catch { /* invalid JSON, keep default */ }
        }

        // Only update if we got something from DB
        if (Object.keys(fromDb).length > 0) {
          setSettings((prev) => {
            const merged = { ...prev, ...fromDb }
            localStorage.setItem('auto-fulfillment-settings', JSON.stringify(merged))
            return merged
          })
        }
      }
    } catch { /* Supabase not available, use localStorage */ }
  }, [])

  // ── Persist settings to localStorage + Supabase ──
  const saveSettings = useCallback((newSettings: Partial<AutoFulfillmentSettings>) => {
    const updated = { ...settings, ...newSettings }
    setSettings(updated)
    localStorage.setItem('auto-fulfillment-settings', JSON.stringify(updated))

    // Also save to Supabase (best-effort, non-blocking)
    if (supabaseConfigured) {
      const upsertSetting = async (key: string, value: string) => {
        try {
          await supabase.from('system_settings').upsert(
            { key, value, category: 'Google Sheets', label: key, setting_type: 'text', updated_at: new Date().toISOString() },
            { onConflict: 'key' },
          )
        } catch { /* best-effort */ }
      }

      if (newSettings.orderSheetId !== undefined) upsertSetting('GSHEET_ORDER_SHEET_ID', updated.orderSheetId)
      if (newSettings.dataPngSheetId !== undefined) upsertSetting('GSHEET_DATA_PNG_SHEET_ID', updated.dataPngSheetId)
      if (newSettings.orderTab !== undefined) upsertSetting('GSHEET_ORDER_TAB', updated.orderTab)
      if (newSettings.pasterOrdersTab !== undefined) upsertSetting('GSHEET_PASTERORDERS_TAB', updated.pasterOrdersTab)
      if (newSettings.dataPngTab !== undefined) upsertSetting('GSHEET_DATA_PNG_TAB', updated.dataPngTab)
      if (newSettings.fieldMappings !== undefined) {
        (async () => {
          try {
            await supabase.from('system_settings').upsert(
              { key: 'GSHEET_FIELD_MAPPING', value: JSON.stringify(updated.fieldMappings), category: 'Google Sheets', label: 'Field mapping', setting_type: 'json', updated_at: new Date().toISOString() },
              { onConflict: 'key' },
            )
          } catch { /* best-effort */ }
        })()
      }
    }
  }, [settings])

  // ── Check Google Sheets connection status ──
  const checkGsheetStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/gsheets/status')
      const data = await res.json()
      // Server always returns 200, check the `connected` field
      if (data.connected) {
        setGsheetStatus({ connected: true, email: data.email, projectId: data.projectId })
      } else {
        setGsheetStatus({ connected: false })
        if (data.error) setError(data.error)
      }
    } catch (err: any) {
      setGsheetStatus({ connected: false })
      setError(err.message || 'Connection error')
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Read from Google Sheet ──
  const readSheet = useCallback(
    async (sheetId: string, range: string) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/gsheets/read?sheetId=${encodeURIComponent(sheetId)}&range=${encodeURIComponent(range)}`
        )
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || 'Read failed')
          return null
        }
        return data as string[][]
      } catch (err: any) {
        setError(err.message || 'Read error')
        return null
      } finally {
        setLoading(false)
      }
    },
    []
  )

  // ── Write to Google Sheet ──
  const writeSheet = useCallback(
    async (sheetId: string, range: string, values: string[][]) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/gsheets/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sheetId, range, values }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || 'Write failed')
          return false
        }
        return true
      } catch (err: any) {
        setError(err.message || 'Write error')
        return false
      } finally {
        setLoading(false)
      }
    },
    []
  )

  // ── Get sheet metadata ──
  const getSheetMeta = useCallback(
    async (sheetId: string) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/gsheets/meta?sheetId=${encodeURIComponent(sheetId)}`)
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || 'Metadata fetch failed')
          return null
        }
        return data.sheets as Array<{ id: number; title: string }>
      } catch (err: any) {
        setError(err.message || 'Metadata fetch error')
        return null
      } finally {
        setLoading(false)
      }
    },
    []
  )

  /** Extract a Shopify field value from an order object */
  const getShopifyFieldValue = useCallback((order: any, fieldKey: string): string => {
    const shipping = order.shipping_address || {}
    const lineItem = order.line_items?.[0] || order.lineItems?.[0] || {}
    const variant = lineItem.variant || {}

    switch (fieldKey) {
      case 'order_name': return order.name || order.order_number || ''
      case 'order_number': return String(order.order_number || order.id || '')
      case 'line_item_title': return lineItem.title || lineItem.name || ''
      case 'line_item_quantity': return String(lineItem.quantity || '')
      case 'line_item_sku': return lineItem.sku || ''
      case 'line_item_price': return String(lineItem.price || '')
      case 'variant_color': {
        // Try variant options for "Color"
        const opts = lineItem.variant_title || ''
        const colorOpt = (lineItem.properties || []).find((p: any) => /color/i.test(p.name))
        if (colorOpt) return colorOpt.value
        // Fallback: first part of variant_title "Red / XL"
        const parts = opts.split(' / ')
        return parts[0] || variant.option1 || ''
      }
      case 'variant_size': {
        const opts = lineItem.variant_title || ''
        const sizeOpt = (lineItem.properties || []).find((p: any) => /size/i.test(p.name))
        if (sizeOpt) return sizeOpt.value
        const parts = opts.split(' / ')
        return parts[1] || variant.option2 || ''
      }
      case 'tracking_number': return order.tracking_number || order.trackingNumber || ''
      case 'carrier': return order.carrier || ''
      case 'fulfillment_status': return order.fulfillment_status || order.fulfillmentStatus || ''
      case 'shipping_name': return `${shipping.first_name || ''} ${shipping.last_name || ''}`.trim() || shipping.name || ''
      case 'shipping_address1': return shipping.address1 || ''
      case 'shipping_address2': return shipping.address2 || ''
      case 'shipping_address_combined': return [shipping.address1, shipping.address2].filter(Boolean).join(', ')
      case 'shipping_city': return shipping.city || ''
      case 'shipping_province': return shipping.province || shipping.province_code || ''
      case 'shipping_zip': return shipping.zip || ''
      case 'shipping_country_code': return shipping.country_code || ''
      case 'shipping_phone': return shipping.phone || ''
      default: return ''
    }
  }, [])

  // ── Sync Shopify orders to Google Sheet ──
  const syncOrdersToSheet = useCallback(
    async (orders: any[]) => {
      if (!settings.orderSheetId) {
        setError('Order Sheet ID not configured')
        return false
      }

      setLoading(true)
      setError(null)

      try {
        const mappings = settings.fieldMappings
        const tab = settings.orderTab

        // Only sync Shopify-sourced fields (not other_sheet fields)
        const shopifyMappings = mappings.filter((m) => m.source === 'shopify')

        // Find max column index to size rows
        const maxCol = mappings.reduce((max, m) => {
          const idx = m.column.charCodeAt(0) - 65
          return Math.max(max, idx)
        }, 0)

        // Transform orders to sheet rows
        const rows = orders.map((order) => {
          const row: string[] = new Array(maxCol + 1).fill('')

          for (const mapping of shopifyMappings) {
            const idx = mapping.column.charCodeAt(0) - 65
            row[idx] = getShopifyFieldValue(order, mapping.shopifyField)
          }

          return row
        })

        // Build range from A to max column
        const lastColLetter = String.fromCharCode(65 + maxCol)
        const range = `${tab}!A2:${lastColLetter}${rows.length + 1}`
        return await writeSheet(settings.orderSheetId, range, rows)
      } finally {
        setLoading(false)
      }
    },
    [settings, writeSheet, getShopifyFieldValue]
  )

  // ── Fulfill order via Shopify API ──
  const fulfillOrder = useCallback(
    async (orderId: string, trackingNumber: string, carrier: string) => {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch('/api/shopify/fulfill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            trackingNumber,
            carrier: carrier || 'other',
          }),
        })

        const data = await res.json()
        if (!res.ok) {
          setError(data.error || 'Fulfillment failed')
          return false
        }

        return true
      } catch (err: any) {
        setError(err.message || 'Fulfillment error')
        return false
      } finally {
        setLoading(false)
      }
    },
    []
  )

  // Load settings from Supabase + check status on mount
  useEffect(() => {
    loadSettingsFromSupabase()
    checkGsheetStatus()
  }, [loadSettingsFromSupabase, checkGsheetStatus])

  return {
    // State
    settings,
    gsheetStatus,
    loading,
    error,

    // Methods
    saveSettings,
    checkGsheetStatus,
    readSheet,
    writeSheet,
    getSheetMeta,
    syncOrdersToSheet,
    fulfillOrder,
    getShopifyFieldValue,
  }
}
