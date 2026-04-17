import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import {
  Settings,
  Database,
  ShoppingCart,
  CheckCircle,
  XCircle,
  RefreshCw,
  Key,
  Megaphone,
  Clock,
  Save,
  FileSpreadsheet,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react'

// ── Types ──
interface ShopifyStatus {
  hasToken: boolean
  hasClientId: boolean
  hasClientSecret: boolean
  hasStoreUrl: boolean
  maskedToken: string | null
  storeUrl: string | null
  tokenSource?: 'env' | 'supabase' | 'none'
  supabaseToken?: string | null
  envToken?: string | null
}

interface FacebookStatus {
  hasToken: boolean
  hasAppId: boolean
  hasAppSecret: boolean
  adAccountId: string | null
  maskedToken: string | null
  tokenValid: boolean
  tokenExpiry: string | null
}

interface GoogleSheetsConfig {
  serviceAccountJson: string
  orderSheetId: string
  dataPngSheetId: string
  orderTab: string
  pasterOrdersTab: string
  dataPngTab: string
  fieldMapping: string
}

interface ScheduleConfig {
  shopifyInterval: string
  autoLoadTime: string
  timezone: string
  pnlRefreshInterval: string
}

interface TimezoneSettings {
  shopifyTimezone: string
  facebookTimezone: string
}

export default function SettingsPage() {
  // ── Supabase ──
  const [testingSupabase, setTestingSupabase] = useState(false)
  const [supabaseOk, setSupabaseOk] = useState<boolean | null>(null)

  // ── Shopify ──
  const [shopifyStatus, setShopifyStatus] = useState<ShopifyStatus | null>(null)
  const [refreshingShopify, setRefreshingShopify] = useState(false)
  const [shopifyResult, setShopifyResult] = useState<string | null>(null)
  const [shopifyError, setShopifyError] = useState<string | null>(null)

  // ── Facebook ──
  const [fbStatus, setFbStatus] = useState<FacebookStatus | null>(null)

  // ── Schedule & Timezone ──
  const [schedule, setSchedule] = useState<ScheduleConfig>({
    shopifyInterval: '12',
    autoLoadTime: '08:00',
    timezone: 'GMT-7',
    pnlRefreshInterval: '1',
  })
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [scheduleResult, setScheduleResult] = useState<string | null>(null)

  // ── Google Sheets ──
  const [gsheetsConfig, setGsheetsConfig] = useState<GoogleSheetsConfig>({
    serviceAccountJson: '',
    orderSheetId: '',
    dataPngSheetId: '',
    orderTab: 'order',
    pasterOrdersTab: 'pasterorders',
    dataPngTab: 'Sheet1',
    fieldMapping: '[{"shopifyField":"order_name","column":"B","headerName":"ITEM-CODE","type":"string","source":"shopify"},{"shopifyField":"line_item_quantity","column":"C","headerName":"Quantity","type":"number","source":"shopify"},{"shopifyField":"line_item_title","column":"D","headerName":"PRODUCT","type":"string","source":"shopify"},{"shopifyField":"variant_color","column":"E","headerName":"Color","type":"string","source":"shopify"},{"shopifyField":"variant_size","column":"F","headerName":"Size","type":"string","source":"shopify"},{"shopifyField":"mockup","column":"G","headerName":"Mockup","type":"string","source":"other_sheet"},{"shopifyField":"front_design","column":"H","headerName":"Front Design","type":"string","source":"other_sheet"},{"shopifyField":"shipping_name","column":"P","headerName":"BUYER NAME","type":"string","source":"shopify"},{"shopifyField":"shipping_address_combined","column":"Q","headerName":"ADDRESS","type":"string","source":"shopify"},{"shopifyField":"shipping_city","column":"R","headerName":"CITY","type":"string","source":"shopify"},{"shopifyField":"shipping_province","column":"S","headerName":"PROVINCE","type":"string","source":"shopify"},{"shopifyField":"shipping_zip","column":"T","headerName":"POSTCODE","type":"string","source":"shopify"},{"shopifyField":"shipping_country_code","column":"U","headerName":"COUNTRY CODE","type":"string","source":"shopify"}]',
  })
  const [savingGsheets, setSavingGsheets] = useState(false)
  const [gsheetsResult, setGsheetsResult] = useState<string | null>(null)
  const [gsheetsError, setGsheetsError] = useState<string | null>(null)
  const [testingGsheets, setTestingGsheets] = useState(false)
  const [gsheetsConnected, setGsheetsConnected] = useState<boolean | null>(null)
  const [gsheetsEmail, setGsheetsEmail] = useState<string | null>(null)
  const [showSaJson, setShowSaJson] = useState(false)

  // ── Timezone ──
  const [timezones, setTimezones] = useState<TimezoneSettings>({
    shopifyTimezone: 'GMT-7',
    facebookTimezone: 'GMT-7',
  })
  const [savingTimezone, setSavingTimezone] = useState(false)
  const [timezoneResult, setTimezoneResult] = useState<string | null>(null)

  // Load statuses on mount
  useEffect(() => {
    fetchShopifyStatus()
    fetchFacebookStatus()
    loadScheduleConfig()
    loadTimezoneSettings()
    loadGsheetsConfig()
  }, [])

  // ── Load Timezone Settings ──
  const loadTimezoneSettings = async () => {
    if (!supabaseConfigured) return
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['TIMEZONE_SHOPIFY', 'TIMEZONE_FACEBOOK'])
      if (data) {
        const map: Record<string, string> = {}
        for (const row of data) map[row.key] = row.value
        setTimezones({
          shopifyTimezone: map['TIMEZONE_SHOPIFY'] || 'GMT-7',
          facebookTimezone: map['TIMEZONE_FACEBOOK'] || 'GMT-7',
        })
      }
    } catch { /* not critical */ }
  }

  // ── Supabase ──
  const testSupabaseConnection = async () => {
    setTestingSupabase(true)
    try {
      const { error } = await supabase.from('cogs_mapping').select('id').limit(1)
      setSupabaseOk(!error)
    } catch {
      setSupabaseOk(false)
    } finally {
      setTestingSupabase(false)
    }
  }

  // ── Shopify ──
  const fetchShopifyStatus = async () => {
    try {
      const res = await fetch('/api/shopify/status')
      setShopifyStatus(await res.json())
    } catch { setShopifyStatus(null) }
  }

  const renewShopifyToken = async () => {
    setRefreshingShopify(true); setShopifyResult(null); setShopifyError(null)
    try {
      const res = await fetch('/api/shopify/renew-token', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.success) {
        // Server already saves to Supabase, but fallback save from frontend too
        if (!data.savedToSupabase && data.newToken && supabaseConfigured) {
          try {
            await supabase.from('system_settings').upsert(
              { key: 'SHOPIFY_ADMIN_TOKEN', value: data.newToken, updated_at: new Date().toISOString() },
              { onConflict: 'key' }
            )
          } catch { /* server-side save is primary */ }
        }
        setShopifyResult(data.message)
        await fetchShopifyStatus()
      } else {
        setShopifyError(data.error || 'Unknown error')
      }
    } catch (err: any) {
      setShopifyError(err.message || 'Network error')
    } finally { setRefreshingShopify(false) }
  }

  // ── Facebook ──
  const fetchFacebookStatus = async () => {
    try {
      const res = await fetch('/api/facebook/status')
      setFbStatus(await res.json())
    } catch { setFbStatus(null) }
  }

  // ── Schedule Config ──
  const loadScheduleConfig = async () => {
    if (!supabaseConfigured) return
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['SCHEDULE_SHOPIFY_INTERVAL', 'SCHEDULE_AUTO_LOAD_TIME', 'TIMEZONE_SYSTEM', 'PNL_REFRESH_INTERVAL'])
      if (data) {
        const map: Record<string, string> = {}
        for (const row of data) map[row.key] = row.value
        setSchedule({
          shopifyInterval: map['SCHEDULE_SHOPIFY_INTERVAL'] || '12',
          autoLoadTime: map['SCHEDULE_AUTO_LOAD_TIME'] || '08:00',
          timezone: map['TIMEZONE_SYSTEM'] || 'GMT-7',
          pnlRefreshInterval: map['PNL_REFRESH_INTERVAL'] || '1',
        })
      }
    } catch { /* not critical */ }
  }

  const saveScheduleConfig = async () => {
    setSavingSchedule(true); setScheduleResult(null)
    try {
      const settings = [
        { key: 'SCHEDULE_SHOPIFY_INTERVAL', value: schedule.shopifyInterval, category: 'Schedule', label: 'Shopify refresh interval (hours)' },
        { key: 'SCHEDULE_AUTO_LOAD_TIME', value: schedule.autoLoadTime, category: 'Schedule', label: 'Auto load time' },
        { key: 'TIMEZONE_SYSTEM', value: schedule.timezone, category: 'Timezone', label: 'System timezone' },
        { key: 'PNL_REFRESH_INTERVAL', value: schedule.pnlRefreshInterval, category: 'Schedule', label: 'PnL refresh interval (hours)' },
      ]
      for (const s of settings) {
        await supabase.from('system_settings').upsert(
          { ...s, setting_type: 'text', updated_at: new Date().toISOString() },
          { onConflict: 'key' },
        )
      }
      setScheduleResult('Schedule saved!')
      setTimeout(() => setScheduleResult(null), 3000)
    } catch (err: any) {
      setScheduleResult('Error: ' + err.message)
    } finally { setSavingSchedule(false) }
  }

  // ── Google Sheets ──
  const loadGsheetsConfig = async () => {
    if (!supabaseConfigured) return
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', [
          'GSHEET_SERVICE_ACCOUNT_JSON',
          'GSHEET_ORDER_SHEET_ID',
          'GSHEET_DATA_PNG_SHEET_ID',
          'GSHEET_ORDER_TAB',
          'GSHEET_PASTERORDERS_TAB',
          'GSHEET_DATA_PNG_TAB',
          'GSHEET_FIELD_MAPPING',
        ])
      if (data) {
        const map: Record<string, string> = {}
        for (const row of data) map[row.key] = row.value
        setGsheetsConfig({
          serviceAccountJson: map['GSHEET_SERVICE_ACCOUNT_JSON'] || '',
          orderSheetId: map['GSHEET_ORDER_SHEET_ID'] || '',
          dataPngSheetId: map['GSHEET_DATA_PNG_SHEET_ID'] || '',
          orderTab: map['GSHEET_ORDER_TAB'] || 'order',
          pasterOrdersTab: map['GSHEET_PASTERORDERS_TAB'] || 'pasterorders',
          dataPngTab: map['GSHEET_DATA_PNG_TAB'] || 'Sheet1',
          fieldMapping: map['GSHEET_FIELD_MAPPING'] || '[]',
        })
        // Check if we have a valid SA email
        if (map['GSHEET_SERVICE_ACCOUNT_JSON']) {
          try {
            const sa = JSON.parse(map['GSHEET_SERVICE_ACCOUNT_JSON'])
            setGsheetsEmail(sa.client_email || null)
          } catch { /* invalid JSON */ }
        }
      }
    } catch { /* not critical */ }
  }

  // Helper: extract Google Sheet ID from URL or return as-is
  const extractSheetId = (input: string): string => {
    const trimmed = (input || '').trim()
    // Match: https://docs.google.com/spreadsheets/d/{SHEET_ID}/...
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
    if (match) return match[1]
    // Already just an ID
    return trimmed
  }

  const saveGsheetsConfig = async () => {
    setSavingGsheets(true); setGsheetsResult(null); setGsheetsError(null)
    try {
      // Clean and validate Service Account JSON if provided
      let saJsonToSave = gsheetsConfig.serviceAccountJson
        .trim()
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width chars
        .replace(/\r\n/g, '\n') // Normalize line endings
      if (saJsonToSave) {
        try {
          const parsed = JSON.parse(saJsonToSave)
          if (!parsed.client_email || !parsed.private_key) {
            setGsheetsError('Service Account JSON thiếu client_email hoặc private_key')
            setSavingGsheets(false)
            return
          }
          // Re-serialize to ensure clean JSON
          saJsonToSave = JSON.stringify(parsed)
        } catch (parseErr) {
          setGsheetsError(`Service Account JSON lỗi format: ${parseErr}. Hãy paste lại toàn bộ nội dung file .json`)
          setSavingGsheets(false)
          return
        }
      }

      // Auto-extract Sheet IDs from URLs
      const orderSheetId = extractSheetId(gsheetsConfig.orderSheetId)
      const dataPngSheetId = extractSheetId(gsheetsConfig.dataPngSheetId)

      const settings = [
        { key: 'GSHEET_SERVICE_ACCOUNT_JSON', value: saJsonToSave, category: 'Google Sheets', label: 'Service Account JSON' },
        { key: 'GSHEET_ORDER_SHEET_ID', value: orderSheetId, category: 'Google Sheets', label: 'Order Sheet ID' },
        { key: 'GSHEET_DATA_PNG_SHEET_ID', value: dataPngSheetId, category: 'Google Sheets', label: 'Data PNG Sheet ID' },
        { key: 'GSHEET_ORDER_TAB', value: gsheetsConfig.orderTab, category: 'Google Sheets', label: 'Order tab name' },
        { key: 'GSHEET_PASTERORDERS_TAB', value: gsheetsConfig.pasterOrdersTab, category: 'Google Sheets', label: 'Paster Orders tab name' },
        { key: 'GSHEET_DATA_PNG_TAB', value: gsheetsConfig.dataPngTab, category: 'Google Sheets', label: 'Data PNG tab name' },
        { key: 'GSHEET_FIELD_MAPPING', value: gsheetsConfig.fieldMapping, category: 'Google Sheets', label: 'Field mapping' },
      ]
      for (const s of settings) {
        await supabase.from('system_settings').upsert(
          { ...s, setting_type: s.key.includes('JSON') || s.key.includes('MAPPING') ? 'json' : 'text', updated_at: new Date().toISOString() },
          { onConflict: 'key' },
        )
      }

      // Update local state with cleaned values
      setGsheetsConfig(prev => ({
        ...prev,
        orderSheetId: orderSheetId,
        dataPngSheetId: dataPngSheetId,
      }))

      if (saJsonToSave) {
        try {
          const sa = JSON.parse(saJsonToSave)
          setGsheetsEmail(sa.client_email || null)
        } catch { /* */ }
      }

      setGsheetsResult('Google Sheets config saved to Supabase!')
      setTimeout(() => setGsheetsResult(null), 3000)
    } catch (err: any) {
      setGsheetsError('Error: ' + err.message)
    } finally { setSavingGsheets(false) }
  }

  const testGsheetsConnection = async () => {
    setTestingGsheets(true); setGsheetsConnected(null); setGsheetsError(null)
    try {
      const res = await fetch('/api/gsheets/status')
      const data = await res.json()
      if (res.ok && data.connected) {
        setGsheetsConnected(true)
        setGsheetsEmail(data.email || null)
      } else {
        setGsheetsConnected(false)
        setGsheetsError(data.error || 'Connection failed')
      }
    } catch (err: any) {
      setGsheetsConnected(false)
      setGsheetsError(err.message || 'Network error')
    } finally { setTestingGsheets(false) }
  }

  const saveTimezoneSettings = async () => {
    setSavingTimezone(true); setTimezoneResult(null)
    try {
      const settings = [
        { key: 'TIMEZONE_SHOPIFY', value: timezones.shopifyTimezone, category: 'Timezone', label: 'Shopify API timezone' },
        { key: 'TIMEZONE_FACEBOOK', value: timezones.facebookTimezone, category: 'Timezone', label: 'Facebook Ads timezone' },
      ]
      for (const s of settings) {
        await supabase.from('system_settings').upsert(
          { ...s, setting_type: 'text', updated_at: new Date().toISOString() },
          { onConflict: 'key' },
        )
      }
      setTimezoneResult('Timezone settings saved!')
      setTimeout(() => setTimezoneResult(null), 3000)
    } catch (err: any) {
      setTimezoneResult('Error: ' + err.message)
    } finally { setSavingTimezone(false) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Application configuration</p>
      </div>

      {/* Row 1: Supabase + Shopify */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Supabase */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4" /> Supabase Connection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">URL</label>
              <Input value={import.meta.env.VITE_SUPABASE_URL || 'Not configured'} disabled className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Anon Key</label>
              <Input value={import.meta.env.VITE_SUPABASE_ANON_KEY ? '••••••••' : 'Not configured'} disabled className="mt-1" />
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={testSupabaseConnection} disabled={testingSupabase}>
                {testingSupabase ? 'Testing...' : 'Test Connection'}
              </Button>
              {supabaseOk === true && <Badge variant="success" className="gap-1"><CheckCircle className="h-3 w-3" /> Connected</Badge>}
              {supabaseOk === false && <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Failed</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env file.</p>
          </CardContent>
        </Card>

        {/* Shopify */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="h-4 w-4" /> Shopify Connection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Store URL</label>
              <Input value={shopifyStatus?.storeUrl || import.meta.env.VITE_SHOPIFY_STORE_URL || 'Not configured'} disabled className="mt-1" />
            </div>
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Access Token</span>
                {shopifyStatus?.hasToken
                  ? <Badge variant="success" className="gap-1"><Key className="h-3 w-3" /> {shopifyStatus.maskedToken}</Badge>
                  : <Badge variant="warning" className="gap-1"><XCircle className="h-3 w-3" /> No token</Badge>}
              </div>
              <div className="flex gap-2 text-xs text-muted-foreground">
                <span>Client ID: {shopifyStatus?.hasClientId ? '✓' : '✗'}</span>
                <span>Client Secret: {shopifyStatus?.hasClientSecret ? '✓' : '✗'}</span>
              </div>
              {shopifyStatus?.tokenSource && (
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <span>Source: <strong>{shopifyStatus.tokenSource}</strong></span>
                  {shopifyStatus.envToken && <span>Env: {shopifyStatus.envToken}</span>}
                  {shopifyStatus.supabaseToken && <span>DB: {shopifyStatus.supabaseToken}</span>}
                </div>
              )}
            </div>
            <Button onClick={renewShopifyToken} disabled={refreshingShopify} className="w-full"
              variant={shopifyStatus?.hasToken ? 'outline' : 'default'}>
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshingShopify ? 'animate-spin' : ''}`} />
              {refreshingShopify ? 'Refreshing...' : 'Refresh Token'}
            </Button>
            {shopifyResult && <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-400">{shopifyResult}</div>}
            {shopifyError && <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-400">{shopifyError}</div>}
            <p className="text-xs text-muted-foreground">
              Token auto-saved to Supabase on renewal. Fallback: env → Supabase DB.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Facebook + Schedule */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Facebook Ads */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-4 w-4" /> Facebook Ads API
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status */}
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Access Token</span>
                {fbStatus?.hasToken
                  ? <Badge variant="success" className="gap-1"><Key className="h-3 w-3" /> {fbStatus.maskedToken}</Badge>
                  : <Badge variant="warning" className="gap-1"><XCircle className="h-3 w-3" /> No token</Badge>}
              </div>
              <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                <span>App ID: {fbStatus?.hasAppId ? '✓' : '✗'}</span>
                <span>App Secret: {fbStatus?.hasAppSecret ? '✓' : '✗'}</span>
                <span>Ad Account: {fbStatus?.adAccountId || '✗'}</span>
              </div>
              <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                <span>Valid: {fbStatus?.tokenValid ? '✓' : '✗'}</span>
                <span>Expiry: {fbStatus?.tokenExpiry ?? 'Never (System User)'}</span>
              </div>
            </div>

            <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">System User Token — không hết hạn</p>
              <p>
                Token được lưu ở biến môi trường <code>FB_ACCESS_TOKEN</code> (Vercel + .env local).
                Khi cần đổi token, cập nhật trực tiếp trên Vercel Dashboard rồi redeploy.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Auto-Load Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" /> Auto-Load Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                System Timezone
              </label>
              <Input
                type="text"
                value={schedule.timezone}
                onChange={(e) => setSchedule({ ...schedule, timezone: e.target.value })}
                placeholder="GMT-7"
                className="mt-1 w-40"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Used for all data calculations (Shopify, Facebook Ads)
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Daily auto-load time
              </label>
              <Input
                type="time"
                value={schedule.autoLoadTime}
                onChange={(e) => setSchedule({ ...schedule, autoLoadTime: e.target.value })}
                className="mt-1 w-40"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                App will auto-fetch Shopify orders and Facebook ad spend at this time daily.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">
                P&L refresh interval (hours)
              </label>
              <Input
                type="number" min="1" max="24"
                value={schedule.pnlRefreshInterval}
                onChange={(e) => setSchedule({ ...schedule, pnlRefreshInterval: e.target.value })}
                className="mt-1 w-24"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                How often P&L data is refreshed automatically
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Shopify token refresh interval (hours)
              </label>
              <Input
                type="number" min="1" max="72"
                value={schedule.shopifyInterval}
                onChange={(e) => setSchedule({ ...schedule, shopifyInterval: e.target.value })}
                className="mt-1 w-24"
              />
            </div>

            <Button onClick={saveScheduleConfig} disabled={savingSchedule} className="w-full">
              <Save className={`mr-2 h-4 w-4`} />
              {savingSchedule ? 'Saving...' : 'Save Schedule'}
            </Button>

            {scheduleResult && (
              <div className={`rounded-md p-3 text-sm ${scheduleResult.startsWith('Error') ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                {scheduleResult}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Google Sheets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="h-4 w-4" /> Google Sheets (Auto Fulfillment)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Connection Status */}
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={testGsheetsConnection} disabled={testingGsheets}>
              {testingGsheets ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              {testingGsheets ? 'Testing...' : 'Test Connection'}
            </Button>
            {gsheetsConnected === true && <Badge variant="success" className="gap-1"><CheckCircle className="h-3 w-3" /> Connected</Badge>}
            {gsheetsConnected === false && <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Failed</Badge>}
            {gsheetsEmail && <span className="text-xs text-muted-foreground">{gsheetsEmail}</span>}
          </div>

          {/* Service Account JSON */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">Service Account JSON</label>
            {gsheetsConfig.serviceAccountJson && !showSaJson ? (
              <div className="mt-1 flex items-center gap-2">
                <div className="flex-1 rounded-md border border-input bg-muted/50 px-3 py-2 text-sm">
                  <span className="text-green-400">Configured</span>
                  {gsheetsEmail && <span className="ml-2 text-xs text-muted-foreground">({gsheetsEmail})</span>}
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowSaJson(true)}>
                  <Eye className="mr-1 h-3 w-3" /> Sửa
                </Button>
              </div>
            ) : (
              <div className="mt-1">
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  rows={6}
                  placeholder={'Paste toàn bộ nội dung file .json Service Account vào đây...\n\n{\n  "type": "service_account",\n  "project_id": "...",\n  "private_key": "...",\n  "client_email": "...@....iam.gserviceaccount.com",\n  ...\n}'}
                  value={gsheetsConfig.serviceAccountJson}
                  onChange={(e) => setGsheetsConfig({ ...gsheetsConfig, serviceAccountJson: e.target.value })}
                />
                {gsheetsConfig.serviceAccountJson && (
                  <div className="mt-1 flex items-center gap-2">
                    {(() => {
                      try {
                        const parsed = JSON.parse(gsheetsConfig.serviceAccountJson)
                        return parsed.client_email ? (
                          <span className="text-xs text-green-400">Valid JSON - Email: {parsed.client_email}</span>
                        ) : (
                          <span className="text-xs text-yellow-400">JSON thiếu client_email</span>
                        )
                      } catch {
                        return <span className="text-xs text-red-400">JSON không hợp lệ</span>
                      }
                    })()}
                    {showSaJson && (
                      <Button variant="ghost" size="sm" onClick={() => setShowSaJson(false)} className="ml-auto h-6 px-2 text-xs">
                        <EyeOff className="mr-1 h-3 w-3" /> Ẩn
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Mở file JSON từ Google Cloud Console, copy toàn bộ nội dung và paste vào đây. Nhớ share Google Sheet cho email service account (quyền Editor).
            </p>
          </div>

          {/* Sheet IDs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Order Sheet ID</label>
              <Input
                value={gsheetsConfig.orderSheetId}
                onChange={(e) => setGsheetsConfig({ ...gsheetsConfig, orderSheetId: e.target.value })}
                placeholder="Paste link Google Sheet hoặc ID"
                className="mt-1"
              />
              <p className="mt-0.5 text-xs text-muted-foreground">Paste link hoặc ID đều được — tự extract</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Data PNG Sheet ID</label>
              <Input
                value={gsheetsConfig.dataPngSheetId}
                onChange={(e) => setGsheetsConfig({ ...gsheetsConfig, dataPngSheetId: e.target.value })}
                placeholder="Paste link Google Sheet hoặc ID"
                className="mt-1"
              />
              <p className="mt-0.5 text-xs text-muted-foreground">Paste link hoặc ID đều được — tự extract</p>
            </div>
          </div>

          {/* Tab Names */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Order Tab</label>
              <Input
                value={gsheetsConfig.orderTab}
                onChange={(e) => setGsheetsConfig({ ...gsheetsConfig, orderTab: e.target.value })}
                placeholder="order"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Paster Orders Tab</label>
              <Input
                value={gsheetsConfig.pasterOrdersTab}
                onChange={(e) => setGsheetsConfig({ ...gsheetsConfig, pasterOrdersTab: e.target.value })}
                placeholder="pasterorders"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Data PNG Tab</label>
              <Input
                value={gsheetsConfig.dataPngTab}
                onChange={(e) => setGsheetsConfig({ ...gsheetsConfig, dataPngTab: e.target.value })}
                placeholder="Sheet1"
                className="mt-1"
              />
            </div>
          </div>

          {/* Field Mapping (JSON) */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">Field Mapping (JSON)</label>
            <textarea
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              rows={4}
              value={gsheetsConfig.fieldMapping}
              onChange={(e) => setGsheetsConfig({ ...gsheetsConfig, fieldMapping: e.target.value })}
              placeholder='[{"shopifyField":"order_name","column":"B","headerName":"ITEM-CODE","type":"string","source":"shopify"},...]'
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Array format: mỗi row có shopifyField, column (A-Z), headerName, type (string/number), source (shopify/other_sheet). Nên chỉnh ở trang Auto FF → Settings.
            </p>
            {(() => {
              try {
                const parsed = JSON.parse(gsheetsConfig.fieldMapping)
                const count = Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length
                return (
                  <span className="text-xs text-green-400">
                    Valid JSON — {count} field{count !== 1 ? 's' : ''}
                  </span>
                )
              } catch {
                return gsheetsConfig.fieldMapping ? (
                  <span className="text-xs text-red-400">JSON không hợp lệ</span>
                ) : null
              }
            })()}
          </div>

          <Button onClick={saveGsheetsConfig} disabled={savingGsheets} className="w-full">
            <Save className="mr-2 h-4 w-4" />
            {savingGsheets ? 'Saving...' : 'Save Google Sheets Config'}
          </Button>

          {gsheetsResult && <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-400">{gsheetsResult}</div>}
          {gsheetsError && <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-400">{gsheetsError}</div>}
        </CardContent>
      </Card>

      {/* Row 4: Timezone Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" /> Timezone Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Configure timezone for Shopify orders and Facebook Ads. All data calculations will use these settings.
          </p>

          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Shopify Timezone
            </label>
            <Input
              type="text"
              value={timezones.shopifyTimezone}
              onChange={(e) => setTimezones({ ...timezones, shopifyTimezone: e.target.value })}
              placeholder="GMT-7"
              className="mt-1 w-40"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Timezone for Shopify orders (e.g., GMT-7, EST, PST)
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Facebook Ads Timezone
            </label>
            <Input
              type="text"
              value={timezones.facebookTimezone}
              onChange={(e) => setTimezones({ ...timezones, facebookTimezone: e.target.value })}
              placeholder="GMT-7"
              className="mt-1 w-40"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Timezone for Facebook Ads data (e.g., GMT-7, EST, PST)
            </p>
          </div>

          <Button onClick={saveTimezoneSettings} disabled={savingTimezone} className="w-full">
            <Save className={`mr-2 h-4 w-4`} />
            {savingTimezone ? 'Saving...' : 'Save Timezone Settings'}
          </Button>

          {timezoneResult && (
            <div className={`rounded-md p-3 text-sm ${timezoneResult.startsWith('Error') ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
              {timezoneResult}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Architecture */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="h-4 w-4" /> Architecture
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm lg:grid-cols-4">
            <div>
              <p className="font-medium">Frontend</p>
              <p className="text-muted-foreground">React 18 + Vite + TypeScript + Tailwind 3 + shadcn/ui</p>
            </div>
            <div>
              <p className="font-medium">Data Layer</p>
              <p className="text-muted-foreground">TanStack React Query + Supabase JS</p>
            </div>
            <div>
              <p className="font-medium">Shopify</p>
              <p className="text-muted-foreground">OAuth client_credentials → Vite proxy</p>
            </div>
            <div>
              <p className="font-medium">Facebook</p>
              <p className="text-muted-foreground">Graph API v21 → Vite proxy</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
