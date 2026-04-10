import { Card, CardContent } from '@/components/ui/card'
import { ShoppingCart } from 'lucide-react'

export default function Orders() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
        <p className="text-muted-foreground">Shopify order management</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-20">
          <ShoppingCart className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">Coming Soon</p>
          <p className="text-sm text-muted-foreground">
            Order list and management will be available here.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
