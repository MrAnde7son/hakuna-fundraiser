import { StatusBadge as DSStatusBadge } from '@hakunahq/ui'

const EXTRA_STATUS_STYLES = {
  skipped: { bg: 'var(--hk-neutral-50)',  text: 'var(--hk-neutral-400)', dot: 'var(--hk-neutral-300)' },
  passed:  { bg: 'var(--hk-neutral-100)', text: 'var(--hk-neutral-600)', dot: 'var(--hk-neutral-400)' },
}

export default function StatusBadge({ status }) {
  return <DSStatusBadge status={status} styles={EXTRA_STATUS_STYLES} />
}
