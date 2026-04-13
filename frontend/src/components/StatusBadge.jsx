import clsx from 'clsx'

const STATUS_STYLES = {
  pending:  { wrap: 'bg-ink-100 text-ink-600 ring-ink-200',           dot: 'bg-ink-400' },
  running:  { wrap: 'bg-hakuna-50 text-hakuna-700 ring-hakuna-200',   dot: 'bg-hakuna-500 animate-pulse' },
  done:     { wrap: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  failed:   { wrap: 'bg-red-50 text-red-700 ring-red-200',             dot: 'bg-red-500' },
  skipped:  { wrap: 'bg-ink-50 text-ink-400 ring-ink-200',             dot: 'bg-ink-300' },
  target:   { wrap: 'bg-savanna-50 text-savanna-800 ring-savanna-200', dot: 'bg-savanna-500' },
  contacted:{ wrap: 'bg-hakuna-50 text-hakuna-700 ring-hakuna-200',    dot: 'bg-hakuna-500' },
  meeting:  { wrap: 'bg-violet-50 text-violet-700 ring-violet-200',    dot: 'bg-violet-500' },
  passed:   { wrap: 'bg-ink-100 text-ink-600 ring-ink-200',            dot: 'bg-ink-400' },
  closed:   { wrap: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
}

export default function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.pending
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset',
      style.wrap
    )}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', style.dot)}/>
      {status}
    </span>
  )
}
