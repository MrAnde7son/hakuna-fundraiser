import { CYBER_DOMAINS, CYBER_DOMAIN_GROUPS } from '../lib/cyberDomains'

export default function SpaceCoverageGrid({ coverage }) {
  const cov = coverage || {}
  const totalActive = CYBER_DOMAINS.filter((d) => cov[d.key]).length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between text-xs" style={{ color: 'var(--hk-text-secondary)' }}>
        <span>
          Coverage across the cybersecurity landscape — red = the fund has a portfolio bet,
          green = open whitespace.
        </span>
        <span className="tabular-nums">
          {totalActive}/{CYBER_DOMAINS.length} bets
        </span>
      </div>

      {Object.entries(CYBER_DOMAIN_GROUPS).map(([group, domains]) => {
        const groupActive = domains.filter((d) => cov[d.key]).length
        return (
          <div key={group}>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--hk-text-secondary)' }}>
                {group}
              </h4>
              <span className="text-[10px] tabular-nums" style={{ color: 'var(--hk-text-muted)' }}>
                {groupActive}/{domains.length}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {domains.map((d) => {
                const active = !!cov[d.key]
                const style = active
                  ? {
                      background: 'var(--hk-danger-subtle)',
                      borderColor: 'var(--hk-sev-critical-border)',
                      color: 'var(--hk-danger-on-subtle)',
                    }
                  : {
                      background: 'var(--hk-success-subtle)',
                      borderColor: 'var(--hk-sev-low-border)',
                      color: 'var(--hk-success-on-subtle)',
                    }
                return (
                  <div
                    key={d.key}
                    className="rounded-lg px-3 py-2.5 text-center text-xs font-medium border transition-colors"
                    style={style}
                  >
                    <div className="text-lg mb-1">{active ? '🔴' : '🟢'}</div>
                    {d.label}
                    <div className="text-[10px] mt-0.5 opacity-70">
                      {active ? 'Has bet' : 'Open'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
