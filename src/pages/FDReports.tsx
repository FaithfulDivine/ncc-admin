import { ExternalLink, RefreshCw } from 'lucide-react'
import { useState } from 'react'

const DASHBOARD_PATH = '/fd-reports/index.html'

export default function FDReports() {
  const [iframeKey, setIframeKey] = useState(0)
  const reload = () => setIframeKey((k) => k + 1)

  return (
    <div className="flex h-full flex-col gap-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">FaithfulDivine Reports</h1>
          <p className="text-sm text-muted-foreground">
            Dashboard tự sinh từ scheduled task <code className="rounded bg-muted px-1.5 py-0.5 text-xs">faithfuldivine-12h-report</code>.
            Mỗi 12h sync vào đây trước khi build.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={reload}
            className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-accent"
          >
            <RefreshCw className="h-4 w-4" /> Reload
          </button>
          <a
            href={DASHBOARD_PATH}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-accent"
          >
            <ExternalLink className="h-4 w-4" /> Mở tab mới
          </a>
        </div>
      </header>

      <div className="flex-1 overflow-hidden rounded-lg border bg-card">
        <iframe
          key={iframeKey}
          src={DASHBOARD_PATH}
          title="FaithfulDivine Dashboard"
          className="h-full w-full"
          style={{ minHeight: 'calc(100vh - 180px)' }}
        />
      </div>
    </div>
  )
}
