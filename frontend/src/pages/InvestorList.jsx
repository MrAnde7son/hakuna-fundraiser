import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Plus, Search, Users } from 'lucide-react'
import {
  Button,
  Input,
  Select,
  Card,
  StatCard,
  Pill,
  Table,
  Pagination,
  EmptyState,
  SkeletonTable,
} from '@hakunahq/ui'
import { fetchInvestors, enrichAll } from '../api/investors'
import StatusBadge from '../components/StatusBadge'
import AddInvestorModal from '../components/AddInvestorModal'
import useSearchParamsState from '../hooks/useSearchParamsState'
import { CYBER_DOMAIN_KEYS } from '../lib/cyberDomains'

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

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'vc', label: 'VC' },
  { value: 'angel', label: 'Angel' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'running', label: 'Running' },
  { value: 'done', label: 'Done' },
  { value: 'failed', label: 'Failed' },
]

const CONFLICT_OPTIONS = [
  { value: '', label: 'All conflicts' },
  { value: 'blocking', label: 'Has blocking' },
  { value: 'adjacent', label: 'Has adjacent' },
  { value: 'watching', label: 'Has watching' },
]

const COVERAGE_OPTIONS = [
  { value: '', label: 'All coverage' },
  { value: 'scanning', label: 'No scanning bet' },
  { value: 'prioritization', label: 'No prioritization bet' },
  { value: 'remediation', label: 'No remediation bet' },
  { value: 'asm_easm', label: 'No ASM/EASM bet' },
  { value: 'caasm', label: 'No CAASM bet' },
  { value: 'patch_management', label: 'No patch mgmt bet' },
  { value: 'posture_management', label: 'No posture mgmt bet' },
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

  // lightweight stats derived from current page (for hero strip)
  const blockingCount = investors.reduce((n, i) => n + (getBlockingCount(i) > 0 ? 1 : 0), 0)
  const runningCount = investors.filter((i) => i.enrichment_status === 'running').length
  const doneCount = investors.filter((i) => i.enrichment_status === 'done').length

  const columns = [
    {
      key: 'name',
      label: 'Name',
      align: 'left',
      sortable: true,
      render: (_v, inv) => {
        const initials = (inv.name || '?').split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase()
        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-hakuna-100 to-hakuna-200 text-hakuna-800 grid place-items-center text-[11px] font-semibold ring-1 ring-hakuna-200/70">
              {initials}
            </div>
            <span className="font-medium text-ink-900">{inv.name}</span>
          </div>
        )
      },
    },
    {
      key: 'type',
      label: 'Type',
      align: 'left',
      sortable: true,
      render: (_v, inv) => <Pill label={(inv.type || '').toUpperCase()} />,
    },
    {
      key: 'stage',
      label: 'Stage',
      align: 'left',
      sortable: true,
      render: (_v, inv) => inv.stage_focus || <span className="text-ink-300">—</span>,
    },
    {
      key: 'blocking',
      label: 'Blocking',
      align: 'center',
      sortable: true,
      render: (_v, inv) => {
        const blocking = getBlockingCount(inv)
        return blocking > 0 ? (
          <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full bg-red-50 text-red-700 text-xs font-semibold ring-1 ring-inset ring-red-200">
            {blocking}
          </span>
        ) : (
          <span className="text-emerald-600 text-[11px] font-medium">clear</span>
        )
      },
    },
    {
      key: 'coverage',
      label: 'Coverage',
      align: 'center',
      sortable: true,
      render: (_v, inv) => <CoverageMini value={inv.ai_enrichment?.space_coverage} />,
    },
    {
      key: 'last_enriched',
      label: 'Last Enriched',
      align: 'left',
      sortable: true,
      render: (_v, inv) => (
        <span className="text-ink-400 text-xs">
          {inv.last_enriched_at
            ? new Date(inv.last_enriched_at).toLocaleDateString()
            : <span className="text-ink-300">—</span>}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      align: 'left',
      sortable: true,
      render: (_v, inv) => <StatusBadge status={inv.enrichment_status} />,
    },
  ]

  const emptySub = total === 0
    ? 'Click Add Investors to get started.'
    : 'No investors match the current filters.'

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
            <Button
              variant="secondary"
              onClick={() => enrichAllMut.mutate()}
              loading={enrichAllMut.isPending}
            >
              <RefreshCw className="w-4 h-4" />
              {enrichAllMut.isPending ? 'Queuing…' : 'Re-enrich All'}
            </Button>
            <Button variant="primary" onClick={() => setShowAdd(true)}>
              <Plus className="w-4 h-4" />
              Add Investors
            </Button>
          </div>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-6">
          <StatCard label="Total tracked" value={total} color="hakuna" />
          <StatCard label="Enriched" value={doneCount} sub="on this page" color="emerald" />
          <StatCard label="In progress" value={runningCount} sub="enriching now" color="savanna" active={runningCount > 0} />
          <StatCard label="With blocking conflicts" value={blockingCount} sub="on this page" color="red" />
        </div>

        {/* Toolbar */}
        <Card>
          <div className="p-3 flex items-center gap-2 flex-wrap">
            <div className="w-full sm:w-64">
              <Input
                type="search"
                value={searchInput}
                onChange={(v) => setSearchInput(v)}
                placeholder="Search name, website, stage…"
              />
            </div>
            <Select
              value={filters.type}
              onChange={(v) => updateFilters({ type: v })}
              options={TYPE_OPTIONS}
              aria-label="Type"
            />
            <Select
              value={filters.enrichment_status}
              onChange={(v) => updateFilters({ enrichment_status: v })}
              options={STATUS_OPTIONS}
              aria-label="Status"
            />
            <Select
              value={filters.conflict_severity}
              onChange={(v) => updateFilters({ conflict_severity: v })}
              options={CONFLICT_OPTIONS}
              aria-label="Conflicts"
            />
            <Select
              value={filters.space_gap}
              onChange={(v) => updateFilters({ space_gap: v })}
              options={COVERAGE_OPTIONS}
              aria-label="Coverage gap"
            />
            <div className="w-full sm:w-auto sm:ml-auto text-xs text-ink-500 sm:pr-2">
              {total.toLocaleString()} investors
            </div>
          </div>
        </Card>

        {/* Table */}
        <div className="mt-4">
          {isLoading ? (
            <SkeletonTable rows={8} columns={7} />
          ) : investors.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No investors yet"
              sub={emptySub}
            />
          ) : (
            <Table
              columns={columns}
              rows={investors}
              sortBy={filters.sort_by}
              sortOrder={filters.sort_dir}
              onSort={onSort}
              onRowClick={(r) => navigate(`/investors/${r.id}`)}
              mobileCard
              emptyMessage={emptySub}
            />
          )}
        </div>

        {!isLoading && total > 0 && (
          <div className="mt-4">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onChange={(p) => setFilters({ page: p })}
            />
          </div>
        )}

        <AddInvestorModal open={showAdd} onClose={() => setShowAdd(false)} />
      </div>
    </div>
  )
}

function CoverageMini({ value }) {
  const v = value || {}
  const active = CYBER_DOMAIN_KEYS.filter((k) => v[k]).length
  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-[11px] text-ink-500 tabular-nums">
        {active}/{CYBER_DOMAIN_KEYS.length}
      </span>
    </div>
  )
}
