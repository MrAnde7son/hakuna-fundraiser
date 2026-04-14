import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchInvestors, enrichAll } from '../api/investors'
import StatusBadge from '../components/StatusBadge'
import AddInvestorModal from '../components/AddInvestorModal'
import useSearchParamsState from '../hooks/useSearchParamsState'

const FILTER_DEFAULTS = {
  search: '',
  type: '',
  enrichment_status: '',
  conflict_severity: '',
  space_gap: '',
  sort_by: 'name',
  sort_dir: 'asc',
  page: 1,
  page_size: 50,
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200]

// Clicking a column toggles direction; switching columns falls back to this default.
const SORT_COLUMNS = [
  { key: 'name', label: 'Name', align: 'left', defaultDir: 'asc' },
  { key: 'type', label: 'Type', align: 'left', defaultDir: 'asc' },
  { key: 'stage', label: 'Stage', align: 'left', defaultDir: 'asc' },
  { key: 'blocking', label: 'Blocking', align: 'center', defaultDir: 'desc' },
  { key: 'coverage', label: 'Coverage', align: 'center', defaultDir: 'desc' },
  { key: 'last_enriched', label: 'Last Enriched', align: 'left', defaultDir: 'desc' },
  { key: 'status', label: 'Status', align: 'left', defaultDir: 'asc' },
]

export default function InvestorList() {
  const navigate = useNavigate()
  const [showAdd, setShowAdd] = useState(false)
  const [filters, setFilters] = useSearchParamsState(FILTER_DEFAULTS)
  const [searchInput, setSearchInput] = useState(filters.search)

  // Debounce search input -> filter so we don't refetch on every keystroke.
  useEffect(() => {
    if (searchInput === filters.search) return
    const t = setTimeout(() => {
      setFilters({ search: searchInput, page: 1 })
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  // Filter changes should reset pagination to page 1.
  const updateFilters = (patch) => {
    const touchesPage = 'page' in patch || 'page_size' in patch
    setFilters(touchesPage ? patch : { ...patch, page: 1 })
  }

  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['investors', filters],
    queryFn: () => fetchInvestors(Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== '' && v !== null && v !== undefined)
    )),
    refetchInterval: 10_000,
    keepPreviousData: true,
  })

  const investors = data?.items ?? []
  const total = data?.total ?? 0
  const page = filters.page
  const pageSize = filters.page_size
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, total)

  const onSort = (key) => {
    const col = SORT_COLUMNS.find((c) => c.key === key)
    if (!col) return
    const nextDir = filters.sort_by === key
      ? (filters.sort_dir === 'asc' ? 'desc' : 'asc')
      : col.defaultDir
    updateFilters({ sort_by: key, sort_dir: nextDir })
  }

  const enrichAllMut = useMutation({
    mutationFn: enrichAll,
    onSuccess: () => qc.invalidateQueries(['investors']),
  })

  const getBlockingCount = (inv) => {
    const map = inv.ai_enrichment?.vm_em_portfolio_map || {}
    return (map.blocking || []).length
  }

  const getCoverageSummary = (inv) => {
    const coverage = inv.ai_enrichment?.space_coverage || {}
    const active = Object.values(coverage).filter(Boolean).length
    return `${active}/7`
  }

  // lightweight stats derived from current page (for hero strip)
  const blockingCount = investors.reduce((n, i) => n + (getBlockingCount(i) > 0 ? 1 : 0), 0)
  const runningCount = investors.filter((i) => i.enrichment_status === 'running').length
  const doneCount = investors.filter((i) => i.enrichment_status === 'done').length

  return (
    <div className="page-shell">
      <div className="page-content p-4 sm:p-6 md:p-8 max-w-[1400px] mx-auto">
        {/* Hero */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-6 md:mb-8 gap-4 md:gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/70 backdrop-blur ring-1 ring-ink-200 text-[11px] font-medium text-ink-600 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>
              Live enrichment · refresh 10s
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-[34px] leading-tight font-display text-ink-900">
              Investor <span className="italic text-hakuna-700">intelligence</span>
            </h1>
            <p className="text-sm text-ink-500 mt-1.5 max-w-xl">
              Track funds, surface thesis signals, and see portfolio conflicts before they cost you a meeting.
            </p>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => enrichAllMut.mutate()}
              disabled={enrichAllMut.isPending}
              className="btn-secondary flex-1 md:flex-initial justify-center"
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5"/>
                <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M3 21v-5h5"/>
              </svg>
              {enrichAllMut.isPending ? 'Queuing…' : 'Re-enrich All'}
            </button>
            <button onClick={() => setShowAdd(true)} className="btn-primary flex-1 md:flex-initial justify-center">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor" strokeLinecap="round" className="w-4 h-4">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Add Investors
            </button>
          </div>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-6">
          <StatTile label="Total tracked" value={total} accent="hakuna" />
          <StatTile label="Enriched" value={doneCount} accent="emerald" sub="on this page" />
          <StatTile label="In progress" value={runningCount} accent="savanna" sub="enriching now" pulse={runningCount > 0} />
          <StatTile label="With blocking conflicts" value={blockingCount} accent="red" sub="on this page" />
        </div>

        {/* Toolbar */}
        <div className="card p-3 mb-4 flex items-center gap-2 flex-wrap">
          <div className="relative w-full sm:w-auto">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400">
              <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
            </svg>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name, website, stage…"
              className="pl-8 pr-8 py-1.5 text-sm rounded-lg border bg-white border-ink-200 text-ink-800 placeholder-ink-400 focus:outline-none focus:border-hakuna-400 focus:ring-1 focus:ring-hakuna-300 w-full sm:w-64"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 text-xs"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          <FilterSelect
            value={filters.type}
            onChange={(v) => updateFilters({ type: v })}
            label="Type"
            options={[['', 'All types'], ['vc', 'VC'], ['angel', 'Angel']]}
          />
          <FilterSelect
            value={filters.enrichment_status}
            onChange={(v) => updateFilters({ enrichment_status: v })}
            label="Status"
            options={[['', 'All statuses'], ['pending', 'Pending'], ['running', 'Running'], ['done', 'Done'], ['failed', 'Failed']]}
          />
          <FilterSelect
            value={filters.conflict_severity}
            onChange={(v) => updateFilters({ conflict_severity: v })}
            label="Conflicts"
            options={[['', 'All conflicts'], ['blocking', 'Has blocking'], ['adjacent', 'Has adjacent'], ['watching', 'Has watching']]}
          />
          <FilterSelect
            value={filters.space_gap}
            onChange={(v) => updateFilters({ space_gap: v })}
            label="Coverage gap"
            options={[
              ['', 'All coverage'],
              ['scanning', 'No scanning bet'],
              ['prioritization', 'No prioritization bet'],
              ['remediation', 'No remediation bet'],
              ['asm_easm', 'No ASM/EASM bet'],
              ['caasm', 'No CAASM bet'],
              ['patch_management', 'No patch mgmt bet'],
              ['posture_management', 'No posture mgmt bet'],
            ]}
          />
          <div className="w-full sm:w-auto sm:ml-auto text-xs text-ink-500 sm:pr-2">
            {total.toLocaleString()} investors
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="card p-16 text-center text-ink-400 text-sm">Loading investors…</div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-ink-50/70 border-b border-ink-100">
                <tr>
                  {SORT_COLUMNS.map((col) => {
                    const active = filters.sort_by === col.key
                    const arrow = active ? (filters.sort_dir === 'asc' ? '▲' : '▼') : '↕'
                    const alignClass = col.align === 'center' ? 'text-center' : 'text-left'
                    return (
                      <th
                        key={col.key}
                        onClick={() => onSort(col.key)}
                        className={`${alignClass} px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-ink-500 cursor-pointer select-none hover:text-ink-800 transition-colors`}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {col.label}
                          <span className={`text-[9px] ${active ? 'text-hakuna-600' : 'text-ink-300'}`}>
                            {arrow}
                          </span>
                        </span>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {investors.map((inv) => {
                  const blocking = getBlockingCount(inv)
                  const initials = (inv.name || '?').split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase()
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => navigate(`/investors/${inv.id}`)}
                      className="hover:bg-hakuna-50/40 cursor-pointer transition-colors group"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-hakuna-100 to-hakuna-200 text-hakuna-800 grid place-items-center text-[11px] font-semibold ring-1 ring-hakuna-200/70">
                            {initials}
                          </div>
                          <span className="font-medium text-ink-900 group-hover:text-hakuna-700 transition-colors">{inv.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="chip bg-ink-100 text-ink-700 uppercase tracking-wide text-[10px]">{inv.type}</span>
                      </td>
                      <td className="px-4 py-3 text-ink-600">{inv.stage_focus || <span className="text-ink-300">—</span>}</td>
                      <td className="px-4 py-3 text-center">
                        {blocking > 0 ? (
                          <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full bg-red-50 text-red-700 text-xs font-semibold ring-1 ring-inset ring-red-200">
                            {blocking}
                          </span>
                        ) : (
                          <span className="text-emerald-600 text-[11px] font-medium">clear</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <CoverageMini value={inv.ai_enrichment?.space_coverage} />
                      </td>
                      <td className="px-4 py-3 text-ink-400 text-xs">
                        {inv.last_enriched_at
                          ? new Date(inv.last_enriched_at).toLocaleDateString()
                          : <span className="text-ink-300">—</span>}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={inv.enrichment_status} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
            {investors.length === 0 && (
              <div className="text-center py-16 text-ink-400 text-sm">
                {total === 0
                  ? 'No investors yet. Click "Add Investors" to get started.'
                  : 'No investors match the current filters.'}
              </div>
            )}
          </div>
        )}

        {!isLoading && total > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-4 px-1 text-sm gap-3">
            <span className="text-ink-500">
              Showing <span className="font-medium text-ink-700">{rangeStart}–{rangeEnd}</span> of <span className="font-medium text-ink-700">{total}</span>
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setFilters({ page: page - 1 })}
                disabled={page <= 1}
                className="btn-secondary px-3 py-1.5"
              >
                Prev
              </button>
              <span className="text-ink-600 px-2">Page {page} / {totalPages}</span>
              <button
                onClick={() => setFilters({ page: page + 1 })}
                disabled={page >= totalPages}
                className="btn-secondary px-3 py-1.5"
              >
                Next
              </button>
              <select
                value={pageSize}
                onChange={(e) => setFilters({ page_size: Number(e.target.value), page: 1 })}
                className="input py-1.5"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}/page</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {showAdd && <AddInvestorModal onClose={() => setShowAdd(false)} />}
      </div>
    </div>
  )
}

function StatTile({ label, value, sub, accent = 'hakuna', pulse }) {
  const ACCENTS = {
    hakuna:  'from-hakuna-500/10 to-transparent text-hakuna-700',
    emerald: 'from-emerald-500/10 to-transparent text-emerald-700',
    savanna: 'from-savanna-500/15 to-transparent text-savanna-800',
    red:     'from-red-500/10 to-transparent text-red-700',
  }
  return (
    <div className={`card card-hover relative overflow-hidden p-3 sm:p-4`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${ACCENTS[accent]} pointer-events-none`}/>
      <div className="relative">
        <div className="text-[11px] font-medium uppercase tracking-wider text-ink-500">{label}</div>
        <div className="flex items-baseline gap-2 mt-1.5">
          <div className={`text-2xl font-semibold tabular-nums ${ACCENTS[accent].split(' ').pop()}`}>
            {value}
          </div>
          {pulse && <span className="w-1.5 h-1.5 rounded-full bg-savanna-500 animate-pulse"/>}
        </div>
        {sub && <div className="text-[11px] text-ink-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

function FilterSelect({ value, onChange, label, options }) {
  const active = value !== ''
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={clsxJoin(
          'appearance-none pl-3 pr-8 py-1.5 text-sm rounded-lg border transition cursor-pointer',
          active
            ? 'bg-hakuna-50 border-hakuna-300 text-hakuna-800'
            : 'bg-white border-ink-200 text-ink-700 hover:border-ink-300'
        )}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400">
        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </label>
  )
}

function CoverageMini({ value }) {
  const KEYS = ['scanning', 'prioritization', 'remediation', 'asm_easm', 'caasm', 'patch_management', 'posture_management']
  const v = value || {}
  const active = KEYS.filter((k) => v[k]).length
  return (
    <div className="inline-flex items-center gap-2">
      <div className="flex gap-0.5">
        {KEYS.map((k) => (
          <span
            key={k}
            className={`w-1.5 h-3.5 rounded-sm ${v[k] ? 'bg-hakuna-500' : 'bg-ink-200'}`}
            title={k}
          />
        ))}
      </div>
      <span className="text-[11px] text-ink-500 tabular-nums">{active}/{KEYS.length}</span>
    </div>
  )
}

function clsxJoin(...parts) {
  return parts.filter(Boolean).join(' ')
}
