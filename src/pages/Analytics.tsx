import { Card, CardContent } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'

export default function Analytics() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Business intelligence and reporting</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-20">
          <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">Coming Soon</p>
          <p className="text-sm text-muted-foreground">
            Advanced analytics and custom reports will be available here.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
