import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, FileQuestion, ExternalLink } from 'lucide-react'

/**
 * Catch-all 404 page.
 *
 * Tránh case "màn hình đen": trước đây mọi URL không match route React
 * (vd. `/memory/_roadmap.md` rewrite từ vercel.json về `/index.html`)
 * sẽ render rỗng → CSS dark theme phủ kín màn hình.
 *
 * Trang này phát hiện một số path "danh dụ" (vd. /memory/*) và gợi ý
 * URL đúng dưới `/fd-reports/`.
 */
export default function NotFound() {
  const location = useLocation()
  const path = location.pathname

  // Heuristic: nếu URL bắt đầu bằng /memory/ hoặc trỏ tới file FD_Reports
  // thì đề xuất prefix /fd-reports/.
  let suggestion: string | null = null
  if (path.startsWith('/memory/')) {
    suggestion = `/fd-reports${path}` // -> /fd-reports/memory/_roadmap.md
  } else if (/^\/FD_(Report|Weekly|Pulse|Audit)/i.test(path)) {
    suggestion = `/fd-reports${path.toLowerCase().startsWith('/fd_') ? path : path}`
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <FileQuestion className="h-16 w-16 text-muted-foreground" />

      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">404 — Trang không tìm thấy</h1>
        <p className="text-muted-foreground">
          URL <code className="rounded bg-muted px-2 py-0.5 text-sm">{path}</code> không khớp với
          route nào trong NCC Admin.
        </p>
      </div>

      {suggestion && (
        <div className="rounded-lg border bg-card p-4 text-left max-w-xl">
          <p className="text-sm font-medium mb-2">💡 Có lẽ đại vương muốn truy cập file FD Reports?</p>
          <p className="text-sm text-muted-foreground mb-3">
            Các tài nguyên FD (memory, reports) được phục vụ static dưới prefix{' '}
            <code className="rounded bg-muted px-1.5 py-0.5">/fd-reports/</code>.
          </p>
          <a
            href={suggestion}
            className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-accent"
          >
            <ExternalLink className="h-4 w-4" /> Mở {suggestion}
          </a>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" /> Về Dashboard
        </Link>
        <Link
          to="/fd-reports"
          className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-accent"
        >
          FD Reports
        </Link>
      </div>
    </div>
  )
}
