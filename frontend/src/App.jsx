import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Users, Target, LineChart, Settings as SettingsIcon } from 'lucide-react'
import { NavBar, MobileTopBar, LogoSymbol, LogoWordmark, useBreakpoint } from '@hakunahq/ui'
import InvestorList from './pages/InvestorList'
import DomainConflicts from './pages/DomainConflicts'
import InvestorDetail from './pages/InvestorDetail'
import Timeline from './pages/Timeline'
import Settings from './pages/Settings'

const NAV_ITEMS = [
  { key: 'investors', label: 'Investors',       icon: <Users size={18} />,        path: '/investors' },
  { key: 'strategy',  label: 'Domain Conflicts', icon: <Target size={18} />,       path: '/strategy' },
  { key: 'timeline',  label: 'Timeline',         icon: <LineChart size={18} />,    path: '/timeline' },
  { key: 'settings',  label: 'Settings',         icon: <SettingsIcon size={18} />, path: '/settings' },
]

function activeKeyFromPath(pathname) {
  if (pathname.startsWith('/investors')) return 'investors'
  if (pathname.startsWith('/strategy')) return 'strategy'
  if (pathname.startsWith('/timeline')) return 'timeline'
  if (pathname.startsWith('/settings')) return 'settings'
  return ''
}

function MobileNavDrawer({ open, onClose, activeKey, onNavigate }) {
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', handler)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 199, background: 'rgba(0,0,0,0.4)' }}
      />
      <div
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, width: 280, zIndex: 200,
          background: 'linear-gradient(to bottom, var(--hk-primary-900), var(--hk-primary-950), var(--hk-neutral-950))',
          color: '#fff',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{
          padding: '16px 16px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <LogoWordmark color="#fff" height={22} />
          <button
            onClick={onClose}
            aria-label="Close menu"
            style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)',
              fontSize: 20, cursor: 'pointer', padding: 4, lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
        <nav style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_ITEMS.map(item => {
            const active = activeKey === item.key
            return (
              <button
                key={item.key}
                onClick={() => onNavigate(item)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 'var(--hk-radius-sm)',
                  border: 'none', cursor: 'pointer',
                  background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                  color: active ? '#fff' : 'rgba(255,255,255,0.75)',
                  fontSize: 14, fontWeight: active ? 600 : 500, textAlign: 'left',
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </>
  )
}

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const bp = useBreakpoint()
  const [menuOpen, setMenuOpen] = useState(false)
  const activeKey = activeKeyFromPath(location.pathname)

  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  const handleNavigate = (item) => {
    setMenuOpen(false)
    navigate(item.path)
  }

  return (
    <>
      {bp.md && (
        <NavBar
          variant="dark"
          logo={<LogoWordmark color="#fff" height={22} />}
          logoCollapsed={<LogoSymbol color="#fff" size={22} />}
          subtitle="Investor Intel"
          items={NAV_ITEMS}
          activeKey={activeKey}
          onNavigate={handleNavigate}
        />
      )}

      <div style={{
        marginLeft: bp.md ? 220 : 0,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {!bp.md && (
          <MobileTopBar
            logo={<LogoWordmark height={20} />}
            onMenuClick={() => setMenuOpen(true)}
          />
        )}
        <main style={{ flex: 1 }}>
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

      <MobileNavDrawer
        open={menuOpen && !bp.md}
        onClose={() => setMenuOpen(false)}
        activeKey={activeKey}
        onNavigate={handleNavigate}
      />
    </>
  )
}
