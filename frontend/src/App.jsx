import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import InvestorList from './pages/InvestorList'
import DomainConflicts from './pages/DomainConflicts'
import InvestorDetail from './pages/InvestorDetail'
import Timeline from './pages/Timeline'
import Settings from './pages/Settings'

export default function App() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/investors" replace />} />
          <Route path="/investors" element={<InvestorList />} />
          <Route path="/investors/:id" element={<InvestorDetail />} />
          <Route path="/strategy" element={<DomainConflicts />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/investors" replace />} />
        </Routes>
      </main>
    </div>
  )
}
