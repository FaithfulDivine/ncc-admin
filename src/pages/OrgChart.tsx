import { Card, CardContent } from '@/components/ui/card'
import { Users } from 'lucide-react'

export default function OrgChart() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Org Chart</h1>
        <p className="text-muted-foreground">Team and department overview</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-20">
          <Users className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">Coming Soon</p>
          <p className="text-sm text-muted-foreground">
            Org chart data will be loaded from Supabase instead of local files.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
