import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAutoRefreshSetting, useSaveAutoRefreshSetting } from '@/hooks/usePnLSnapshots'
import { Clock, Check, AlertCircle } from 'lucide-react'

export function SettingsAutoRefresh() {
  const [input, setInput] = useState('300')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const { data: setting, isLoading } = useAutoRefreshSetting('AUTO_REFRESH_INTERVAL')
  const saveAutoRefreshSetting = useSaveAutoRefreshSetting()

  // Load current setting
  useEffect(() => {
    if (setting?.value) {
      setInput(setting.value)
      setSaved(false)
    }
  }, [setting])

  const handleSave = async () => {
    const seconds = parseInt(input, 10)

    if (isNaN(seconds) || seconds < 30 || seconds > 3600) {
      setError('Khoảng thời gian phải từ 30 đến 3600 giây (1 phút đến 1 giờ)')
      return
    }

    setError('')
    setIsSaving(true)

    try {
      await saveAutoRefreshSetting.mutateAsync({
        key: 'AUTO_REFRESH_INTERVAL',
        value: String(seconds),
        label: 'Auto-refresh interval (seconds)',
        category: 'Data',
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError('Lỗi lưu cài đặt: ' + (err as Error).message)
    } finally {
      setIsSaving(false)
    }
  }

  const formatDisplay = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="animate-pulse h-10 bg-muted rounded" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Auto-refresh Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="auto-refresh-interval" className="text-sm font-medium">
            Refresh Interval (seconds)
          </Label>
          <p className="text-xs text-muted-foreground mb-2">
            Khoảng thời gian tự động cập nhật dữ liệu P&L từ Shopify và Facebook Ads.
            Tối thiểu: 30 giây, Tối đa: 3600 giây (1 giờ)
          </p>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                id="auto-refresh-interval"
                type="number"
                min="30"
                max="3600"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  setError('')
                  setSaved(false)
                }}
                className="font-mono"
                disabled={isSaving}
              />
              {!error && input && (
                <p className="text-xs text-muted-foreground mt-1">
                  = {formatDisplay(parseInt(input, 10) || 0)}
                </p>
              )}
            </div>
            <Button
              onClick={handleSave}
              disabled={isSaving || !input || saved}
              className="gap-2"
            >
              {saved ? (
                <>
                  <Check className="h-4 w-4" />
                  Saved
                </>
              ) : (
                'Save'
              )}
            </Button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        {saved && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <Check className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-600">
              Cài đặt đã được lưu. P&L sẽ tự động cập nhật mỗi {formatDisplay(parseInt(input, 10) || 300)}.
            </p>
          </div>
        )}

        <div className="space-y-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
          <p className="text-xs font-medium text-blue-600">Mẹo:</p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>Khoảng thời gian nhỏ hơn = cập nhật nhanh hơn nhưng tiêu tốn tài nguyên hơn</li>
            <li>Giá trị mặc định: 300 giây (5 phút)</li>
            <li>Thiết lập sẽ áp dụng ngay lập tức cho trang P&L</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

export default SettingsAutoRefresh
