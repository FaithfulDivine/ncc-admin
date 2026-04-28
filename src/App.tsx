import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import PnL from './pages/store/PnL'
import Cogs from './pages/store/Cogs'
import FixedCosts from './pages/store/FixedCosts'
import AdSpend from './pages/store/AdSpend'
import Orders from './pages/store/Orders'
import AutoFulfillment from './pages/store/AutoFulfillment'
import CJFulfillment from './pages/store/CJFulfillment'
import Analytics from './pages/Analytics'
import OrgChart from './pages/OrgChart'
import SettingsPage from './pages/Settings'
import FBCurator from './pages/fb-curator/FBCurator'
import FBCuratorRunDetail from './pages/fb-curator/FBCuratorRunDetail'
import FBCuratorConfig from './pages/fb-curator/FBCuratorConfig'
import FBCuratorDesignBacklog from './pages/fb-curator/FBCuratorDesignBacklog'
import AnalyticsAds from './pages/analytics/AnalyticsAds'
import FDReports from './pages/FDReports'
import NotFound from './pages/NotFound'

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
        <Route path="store/auto-fulfillment" element={<AutoFulfillment />} />
        <Route path="store/cj-fulfill" element={<CJFulfillment />} />
        <Route path="fb-curator" element={<FBCurator />} />
        <Route path="fb-curator/config" element={<FBCuratorConfig />} />
        <Route path="fb-curator/design-backlog" element={<FBCuratorDesignBacklog />} />
        <Route path="fb-curator/runs/:runId" element={<FBCuratorRunDetail />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="analytics/ads" element={<AnalyticsAds />} />
        <Route path="fd-reports" element={<FDReports />} />
        <Route path="org" element={<OrgChart />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
