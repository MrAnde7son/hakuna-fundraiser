import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import InvestorList from './pages/InvestorList'
import DomainConflicts from './pages/DomainConflicts'
import InvestorDetail from './pages/InvestorDetail'
import Timeline from './pages/Timeline'
import Settings from './pages/Settings'

function MobileHeader({ onOpenMenu }) {
  return (
    <header className="md:hidden sticky top-0 z-20 flex items-center justify-between px-4 h-14 bg-gradient-to-r from-hakuna-900 to-hakuna-950 text-white border-b border-white/5">
      <button
        onClick={onOpenMenu}
        className="p-2 -ml-2 rounded-md hover:bg-white/10 transition-colors"
        aria-label="Open menu"
      >
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor" strokeLinecap="round" className="w-5 h-5">
          <path d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
      </button>
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 32 32" className="w-6 h-6">
          <defs>
            <linearGradient id="mobile-logo-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#36a9ff"/>
              <stop offset="100%" stopColor="#004b94"/>
            </linearGradient>
          </defs>
          <rect width="32" height="32" rx="7" fill="url(#mobile-logo-g)"/>
          <path d="M10 9 L10 23 M10 16 L22 16 M22 9 L22 23" stroke="white" strokeWidth="2.6" strokeLinecap="round" fill="none"/>
        </svg>
        <span className="text-sm font-semibold tracking-tight">Hakuna</span>
      </div>
      <div className="w-9" />
    </header>
  )
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  return (
    <div className="flex md:h-screen md:overflow-hidden">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 md:h-screen md:overflow-hidden">
        <MobileHeader onOpenMenu={() => setMenuOpen(true)} />
        <main className="flex-1 md:overflow-auto">
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
    </div>
  )
}
