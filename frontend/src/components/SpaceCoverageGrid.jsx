import clsx from 'clsx'

const LABEL_OVERRIDES = {
  asm_easm: 'ASM / EASM',
  caasm: 'CAASM',
  patch_management: 'Patch Mgmt',
  posture_management: 'Posture Mgmt',
}

function humanize(key) {
  if (LABEL_OVERRIDES[key]) return LABEL_OVERRIDES[key]
  return key
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export default function SpaceCoverageGrid({ coverage }) {
  if (!coverage || Object.keys(coverage).length === 0)
    return <p className="text-gray-400 text-sm">No coverage data</p>

  const spaces = Object.keys(coverage).map((key) => ({ key, label: humanize(key) }))

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
      {spaces.map((space) => {
        const active = coverage[space.key]
        return (
          <div
            key={space.key}
            className={clsx(
              'rounded-lg px-3 py-2.5 text-center text-xs font-medium border transition-colors',
              active
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-green-50 border-green-200 text-green-700'
            )}
          >
            <div className="text-lg mb-1">{active ? '🔴' : '🟢'}</div>
            {space.label}
            <div className="text-[10px] mt-0.5 opacity-70">
              {active ? 'Has bet' : 'Open'}
            </div>
          </div>
        )
      })}
    </div>
  )
}
