import { NavLink } from 'react-router-dom'
import {
  BarChart3,
  DollarSign,
  Package,
  Settings,
  ShoppingCart,
  Users,
  LayoutDashboard,
  Building2,
  Megaphone,
  Truck,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/store/pnl', label: 'P&L', icon: DollarSign },
  { to: '/store/cogs', label: 'COGS', icon: Package },
  { to: '/store/fixed-costs', label: 'Chi phí CĐ', icon: Building2 },
  { to: '/store/ad-spend', label: 'Quảng cáo', icon: Megaphone },
  { to: '/store/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/store/auto-fulfillment', label: 'Auto FF', icon: Truck },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/org', label: 'Org Chart', icon: Users },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
          NCC
        </div>
        <span className="text-lg font-semibold">Admin</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t p-4">
        <p className="text-xs text-muted-foreground">NCC Admin v1.0</p>
      </div>
    </aside>
  )
}
