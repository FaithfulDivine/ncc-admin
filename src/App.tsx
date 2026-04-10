import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import PnL from './pages/store/PnL'
import Cogs from './pages/store/Cogs'
import FixedCosts from './pages/store/FixedCosts'
import AdSpend from './pages/store/AdSpend'
import Orders from './pages/store/Orders'
import Analytics from './pages/Analytics'
import OrgChart from './pages/OrgChart'
import SettingsPage from './pages/Settings'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="store/pnl" element={<PnL />} />
        <Route path="store/cogs" element={<Cogs />} />
        <Route path="store/fixed-costs" element={<FixedCosts />} />
        <Route path="store/ad-spend" element={<AdSpend />} />
        <Route path="store/orders" element={<Orders />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="org" element={<OrgChart />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
