import clsx from 'clsx'
import { CYBER_DOMAINS, CYBER_DOMAIN_GROUPS } from '../lib/cyberDomains'

export default function SpaceCoverageGrid({ coverage }) {
  const cov = coverage || {}
  const totalActive = CYBER_DOMAINS.filter((d) => cov[d.key]).length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between text-xs text-ink-500">
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
              <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                {group}
              </h4>
              <span className="text-[10px] text-ink-400 tabular-nums">
                {groupActive}/{domains.length}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {domains.map((d) => {
                const active = !!cov[d.key]
                return (
                  <div
                    key={d.key}
                    className={clsx(
                      'rounded-lg px-3 py-2.5 text-center text-xs font-medium border transition-colors',
                      active
                        ? 'bg-red-50 border-red-200 text-red-700'
                        : 'bg-green-50 border-green-200 text-green-700'
                    )}
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
