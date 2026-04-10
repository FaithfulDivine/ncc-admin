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
} from 'lucide-react'

// ── Types ──
interface ShopifyStatus {
  hasToken: boolean
  hasClientId: boolean
  hasClientSecret: boolean
  hasStoreUrl: boolean
  maskedToken: string | null
  storeUrl: string | null
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

interface ScheduleConfig {
  shopifyInterval: string
  facebookInterval: string
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
  const [refreshingFb, setRefreshingFb] = useState(false)
  const [fbResult, setFbResult] = useState<string | null>(null)
  const [fbError, setFbError] = useState<string | null>(null)
  const [fbTokenInput, setFbTokenInput] = useState('')
  const [fbToken, setFbToken] = useState('') // Track current token
  const [savingFbToken, setSavingFbToken] = useState(false)

  // ── Schedule & Timezone ──
  const [schedule, setSchedule] = useState<ScheduleConfig>({
    shopifyInterval: '12',
    facebookInterval: '1',
    autoLoadTime: '08:00',
    timezone: 'GMT-7',
    pnlRefreshInterval: '1',
  })
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [scheduleResult, setScheduleResult] = useState<string | null>(null)

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

  const refreshFacebookToken = async () => {
    setRefreshingFb(true); setFbResult(null); setFbError(null)
    try {
      const res = await fetch('/api/facebook/refresh-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: fbToken }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setFbResult(data.message)
        setFbToken('') // Clear after successful refresh (new token is in .env)
        await fetchFacebookStatus()
      } else {
        setFbError(data.error || 'Unknown error')
      }
    } catch (err: any) {
      setFbError(err.message || 'Network error')
    } finally { setRefreshingFb(false) }
  }

  const saveFbTokenManual = async () => {
    if (!fbTokenInput.trim()) return
    setSavingFbToken(true); setFbResult(null); setFbError(null)
    try {
      const trimmedToken = fbTokenInput.trim()
      const res = await fetch('/api/facebook/save-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: trimmedToken }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setFbResult('Token saved successfully!')
        setFbToken(trimmedToken) // Keep token in state
        setFbTokenInput('')
        await fetchFacebookStatus()
      } else {
        setFbError(data.error || 'Failed to save')
      }
    } catch (err: any) {
      setFbError(err.message)
    } finally { setSavingFbToken(false) }
  }

  // ── Schedule Config ──
  const loadScheduleConfig = async () => {
    if (!supabaseConfigured) return
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['SCHEDULE_SHOPIFY_INTERVAL', 'SCHEDULE_FACEBOOK_INTERVAL', 'SCHEDULE_AUTO_LOAD_TIME', 'TIMEZONE_SYSTEM', 'PNL_REFRESH_INTERVAL'])
      if (data) {
        const map: Record<string, string> = {}
        for (const row of data) map[row.key] = row.value
        setSchedule({
          shopifyInterval: map['SCHEDULE_SHOPIFY_INTERVAL'] || '12',
          facebookInterval: map['SCHEDULE_FACEBOOK_INTERVAL'] || '1',
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
        { key: 'SCHEDULE_FACEBOOK_INTERVAL', value: schedule.facebookInterval, category: 'Schedule', label: 'Facebook refresh interval (hours)' },
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
            </div>
            <Button onClick={renewShopifyToken} disabled={refreshingShopify} className="w-full"
              variant={shopifyStatus?.hasToken ? 'outline' : 'default'}>
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshingShopify ? 'animate-spin' : ''}`} />
              {refreshingShopify ? 'Refreshing...' : 'Refresh Token'}
            </Button>
            {shopifyResult && <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-400">{shopifyResult}</div>}
            {shopifyError && <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-400">{shopifyError}</div>}
            <p className="text-xs text-muted-foreground">
              Set SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET, VITE_SHOPIFY_STORE_URL in .env.
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
            </div>

            {/* Manual token input */}
            <div>
              <label className="text-sm font-medium text-muted-foreground">Paste Access Token (first time)</label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={fbTokenInput}
                  onChange={(e) => setFbTokenInput(e.target.value)}
                  placeholder="EAAxxxxxxx..."
                  type="password"
                  className="flex-1"
                />
                <Button size="sm" onClick={saveFbTokenManual} disabled={savingFbToken || !fbTokenInput.trim()}>
                  <Save className="mr-1 h-3.5 w-3.5" /> Save
                </Button>
              </div>
            </div>

            {/* Refresh button */}
            <Button onClick={refreshFacebookToken} disabled={refreshingFb} className="w-full"
              variant={fbStatus?.hasToken ? 'outline' : 'default'}>
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshingFb ? 'animate-spin' : ''}`} />
              {refreshingFb ? 'Refreshing...' : 'Refresh Long-Lived Token'}
            </Button>

            {fbResult && <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-400">{fbResult}</div>}
            {fbError && <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-400">{fbError}</div>}

            <p className="text-xs text-muted-foreground">
              Set FB_APP_ID, FB_APP_SECRET, FB_AD_ACCOUNT_ID in .env.
              Paste a short-lived token above, then click "Refresh" to exchange for long-lived (~60 days).
            </p>
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

            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Facebook token refresh interval (hours)
              </label>
              <Input
                type="number" min="1" max="720"
                value={schedule.facebookInterval}
                onChange={(e) => setSchedule({ ...schedule, facebookInterval: e.target.value })}
                className="mt-1 w-24"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Facebook long-lived tokens last ~60 days. Recommend refreshing every 24-48h.
              </p>
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

      {/* Row 3: Timezone Settings */}
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
