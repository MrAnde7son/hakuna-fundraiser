import { NavLink } from 'react-router-dom'
import clsx from 'clsx'

const ICONS = {
  investors: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
      <path d="M9 6a3 3 0 1 1 6 0 3 3 0 0 1-6 0Z"/>
      <path d="M3 20c.8-3.3 3.6-5 6-5s5.2 1.7 6 5"/>
      <path d="M17 11a2.5 2.5 0 1 0 0-5"/>
      <path d="M21 20c-.4-2-1.6-3.4-3.2-4.2"/>
    </svg>
  ),
  strategy: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
      <circle cx="12" cy="12" r="9"/>
      <circle cx="12" cy="12" r="5"/>
      <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
    </svg>
  ),
  timeline: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
      <path d="M3 17l5-5 4 4 8-8"/>
      <path d="M15 8h5v5"/>
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.8 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>
    </svg>
  ),
}

const NAV = [
  { to: '/investors', label: 'Investors', icon: ICONS.investors },
  { to: '/strategy', label: 'Domain Conflicts', icon: ICONS.strategy },
  { to: '/timeline', label: 'Timeline', icon: ICONS.timeline },
  { to: '/settings', label: 'Settings', icon: ICONS.settings },
]

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <svg viewBox="0 0 32 32" className="w-9 h-9 drop-shadow">
          <defs>
            <linearGradient id="sidebar-logo-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#36a9ff"/>
              <stop offset="100%" stopColor="#004b94"/>
            </linearGradient>
          </defs>
          <rect width="32" height="32" rx="9" fill="url(#sidebar-logo-g)"/>
          <path d="M10 9 L10 23 M10 16 L22 16 M22 9 L22 23" stroke="white" strokeWidth="2.6" strokeLinecap="round" fill="none"/>
        </svg>
        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-savanna-400 ring-2 ring-hakuna-950"/>
      </div>
      <div className="leading-tight">
        <div className="text-[15px] font-semibold tracking-tight text-white">Hakuna</div>
        <div className="text-[10.5px] uppercase tracking-[0.14em] text-hakuna-300/80">Investor Intel</div>
      </div>
    </div>
  )
}

export default function Sidebar() {
  return (
    <aside className="w-60 shrink-0 flex flex-col text-white relative overflow-hidden
                      bg-gradient-to-b from-hakuna-900 via-hakuna-950 to-ink-950">
      {/* ambient glow */}
      <div className="pointer-events-none absolute -top-24 -left-16 w-64 h-64 rounded-full bg-hakuna-500/20 blur-3xl"/>
      <div className="pointer-events-none absolute bottom-0 -right-16 w-64 h-64 rounded-full bg-savanna-500/10 blur-3xl"/>

      <div className="relative p-5 border-b border-white/5">
        <Logo />
      </div>

      <nav className="relative flex-1 px-3 py-4 space-y-0.5">
        <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-hakuna-300/60">
          Workspace
        </div>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all',
                isActive
                  ? 'bg-white/[0.08] text-white shadow-inner'
                  : 'text-hakuna-200/80 hover:bg-white/[0.04] hover:text-white'
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-savanna-400"/>
                )}
                <span className={clsx(
                  'flex items-center justify-center rounded-md w-7 h-7 transition-colors',
                  isActive ? 'bg-hakuna-500/20 text-hakuna-100' : 'text-hakuna-300/80 group-hover:text-white'
                )}>
                  {item.icon}
                </span>
                <span className="font-medium">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="relative mx-3 mb-3 rounded-xl border border-white/5 bg-white/[0.03] p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
          <span className="text-[11px] font-medium text-hakuna-100">Enrichment live</span>
        </div>
        <p className="text-[11px] leading-snug text-hakuna-300/80">
          Signals refresh every 10s across all tracked funds.
        </p>
      </div>

      <div className="relative px-5 py-3 border-t border-white/5 flex items-center justify-between">
        <span className="text-[10.5px] text-hakuna-300/60">Hakuna Fundraise</span>
        <span className="text-[10.5px] font-mono text-hakuna-300/50">v1.0</span>
      </div>
    </aside>
  )
}
