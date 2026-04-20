import { useQuery } from '@tanstack/react-query'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { formatNumber } from '@/lib/utils'
import { QUERY_STALE } from '@/lib/queryDefaults'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Link } from 'react-router-dom'
import {
  DollarSign,
  Package,
  ShoppingCart,
  TrendingUp,
  ArrowRight,
} from 'lucide-react'

export default function Dashboard() {
  // Quick stats from Supabase
  const { data: cogsCount } = useQuery({
    queryKey: ['cogs-count'],
    enabled: supabaseConfigured,
    staleTime: QUERY_STALE.longLived,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('cogs_mapping')
        .select('*', { count: 'exact', head: true })
      if (error) throw error
      return count || 0
    },
  })

  const { data: styleMappingCount } = useQuery({
    queryKey: ['style-mapping-count'],
    enabled: supabaseConfigured,
    staleTime: QUERY_STALE.longLived,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('style_mapping')
        .select('*', { count: 'exact', head: true })
      if (error) throw error
      return count || 0
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to NCC Admin</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">COGS Entries</p>
              <Package className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-2xl font-bold">{formatNumber(cogsCount || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Style Mappings</p>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-2xl font-bold">{formatNumber(styleMappingCount || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Database</p>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-2xl font-bold">
              <Badge variant="success">Connected</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Shopify</p>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-2xl font-bold">
              <Badge variant="secondary">Proxy</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">COGS Management</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Manage supplier costs grouped by style. Edit inline, map to Shopify styles, and
              import from CSV.
            </p>
            <Link to="/store/cogs">
              <Button variant="outline" size="sm">
                Go to COGS <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profit & Loss</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              View revenue, COGS, and profitability across products with daily trend charts.
            </p>
            <Link to="/store/pnl">
              <Button variant="outline" size="sm">
                Go to P&L <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
