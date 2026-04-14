import { StatusBadge as DSStatusBadge } from '@hakunahq/ui'

const CONFLICT_STYLES = {
  blocking:   { bg: 'var(--hk-danger-subtle)',  text: 'var(--hk-danger-on-subtle)',  dot: 'var(--hk-danger)' },
  adjacent:   { bg: 'var(--hk-accent-50)',      text: 'var(--hk-accent-800)',        dot: 'var(--hk-accent-500)' },
  watching:   { bg: 'var(--hk-primary-50)',     text: 'var(--hk-primary-700)',       dot: 'var(--hk-primary-500)' },
  validating: { bg: 'var(--hk-success-subtle)', text: 'var(--hk-success-on-subtle)', dot: 'var(--hk-success)' },
  clear:      { bg: 'var(--hk-neutral-50)',     text: 'var(--hk-neutral-500)',       dot: 'var(--hk-neutral-300)' },
}

export default function ConflictBadge({ type }) {
  if (!type) return null
  return <DSStatusBadge status={type} styles={CONFLICT_STYLES} />
}
