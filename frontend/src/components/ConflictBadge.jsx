import clsx from 'clsx'

const CONFLICT_STYLES = {
  blocking:   { wrap: 'bg-red-50 text-red-700 ring-red-200',             dot: 'bg-red-500' },
  adjacent:   { wrap: 'bg-savanna-50 text-savanna-800 ring-savanna-200', dot: 'bg-savanna-500' },
  watching:   { wrap: 'bg-hakuna-50 text-hakuna-700 ring-hakuna-200',    dot: 'bg-hakuna-500' },
  validating: { wrap: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  clear:      { wrap: 'bg-ink-50 text-ink-500 ring-ink-200',             dot: 'bg-ink-300' },
}

export default function ConflictBadge({ type }) {
  if (!type) return null
  const style = CONFLICT_STYLES[type] || CONFLICT_STYLES.clear
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset capitalize',
      style.wrap
    )}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', style.dot)}/>
      {type}
    </span>
  )
}
