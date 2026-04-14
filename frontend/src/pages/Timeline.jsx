import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Input, Select, Card, StatCard, Pill, Tabs, Table, EmptyState, Spinner } from '@hakunahq/ui'
import { Clock, TrendingUp, ChevronDown, ChevronUp, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, ExternalLink } from 'lucide-react'
import clsx from 'clsx'
import { fetchTimeline, fetchTimelineDomains, fetchTimelineStats } from '../api/timeline'
import { fetchInvestors } from '../api/investors'
import useSearchParamsState from '../hooks/useSearchParamsState'

const DOMAIN_COLORS = {
  'vulnerability management': 'bg-red-100 text-red-800',
  'exposure management': 'bg-orange-100 text-orange-800',
  'endpoint security': 'bg-yellow-100 text-yellow-800',
  'cloud security': 'bg-sky-100 text-sky-800',
  'identity security': 'bg-purple-100 text-purple-800',
  'application security': 'bg-pink-100 text-pink-800',
  'network security': 'bg-teal-100 text-teal-800',
  'data security': 'bg-indigo-100 text-indigo-800',
  'security operations': 'bg-emerald-100 text-emerald-800',
  'GRC': 'bg-amber-100 text-amber-800',
}

const SOURCE_LABELS = {
  press_release: 'Press Release',
  website: 'Website',
  crunchbase: 'Crunchbase',
  news: 'News',
  manual: 'Manual',
}

const FILTER_DEFAULTS = {
  view: 'timeline',
  pivot: 'domain',
  domain: '',
  investor_id: '',
  year_from: '',
  year_to: '',
  sort_by: 'date_desc',
  page: 1,
  page_size: 50,
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200]

export default function Timeline() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParamsState(FILTER_DEFAULTS)

  const view = params.view || 'timeline'
  const pivot = params.pivot || 'domain'
  const selectedDomain = params.domain || null
  const selectedInvestor = params.investor_id ? Number(params.investor_id) : null
  const yearFrom = params.year_from ? Number(params.year_from) : null
  const yearTo = params.year_to ? Number(params.year_to) : null
  const sortBy = params.sort_by || 'date_desc'
  const page = Number(params.page) || 1
  const pageSize = Number(params.page_size) || 50

  const filters = {
    ...(selectedDomain && { domain: selectedDomain }),
    ...(selectedInvestor && { investor_id: selectedInvestor }),
    ...(yearFrom && { year_from: yearFrom }),
    ...(yearTo && { year_to: yearTo }),
    sort_by: sortBy,
    page,
    page_size: pageSize,
  }

  const { data, isLoading } = useQuery({
    queryKey: ['timeline', filters],
    queryFn: () => fetchTimeline(filters),
  })
  const events = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const { data: domains = [] } = useQuery({
    queryKey: ['timeline-domains'],
    queryFn: fetchTimelineDomains,
  })

  const { data: stats } = useQuery({
    queryKey: ['timeline-stats'],
    queryFn: fetchTimelineStats,
  })

  const { data: investorList } = useQuery({
    queryKey: ['investors-for-filter'],
    queryFn: () => fetchInvestors({ sort_by: 'name', page_size: 200 }),
  })
  const investors = investorList?.items ?? []

  // Group for pivot views
  const pivotGroups = useMemo(() => {
    const groups = {}
    for (const ev of events) {
      const key = pivot === 'domain' ? (ev.domain || 'Uncategorized') : ev.investor_name
      if (!groups[key]) groups[key] = []
      groups[key].push(ev)
    }
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length)
  }, [events, pivot])

  const setFilter = (patch) => setParams({ ...patch, page: 1 })

  const clearFilters = () => {
    setParams({ view, pivot: 'domain', domain: '', investor_id: '', year_from: '', year_to: '', sort_by: 'date_desc', page: 1 })
  }

  const lastUnderscore = sortBy.lastIndexOf('_')
  const sortCol = lastUnderscore > 0 ? sortBy.slice(0, lastUnderscore) : sortBy
  const sortDir = lastUnderscore > 0 ? sortBy.slice(lastUnderscore + 1) : 'desc'

  const toggleSort = (column) => {
    const nextDir = sortCol === column && sortDir === 'desc' ? 'asc' : 'desc'
    setFilter({ sort_by: `${column}_${nextDir}` })
  }

  const hasFilters = selectedDomain || selectedInvestor || yearFrom || yearTo

  const onSelectInvestor = (id) => navigate(`/investors/${id}`)

  const yearsSpan = stats && Object.keys(stats.by_year || {}).length > 0
    ? `${Math.min(...Object.keys(stats.by_year).map(Number))} - ${Math.max(...Object.keys(stats.by_year).map(Number))}`
    : '---'

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Investment Timeline</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track when investors made bets across cybersecurity domains
          </p>
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <StatCard label="Total Events" value={stats.total_events} icon={TrendingUp} />
          <StatCard label="Investors Tracked" value={stats.investors_with_events} />
          <StatCard label="Domains" value={Object.keys(stats.by_domain || {}).length} />
          <StatCard label="Years Span" value={yearsSpan} icon={Clock} />
        </div>
      )}

      {/* Filters bar */}
      <Card className="p-3 sm:p-4 mb-6">
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          {/* View toggle */}
          <Tabs
            active={view}
            onChange={(v) => setParams({ view: v })}
            tabs={[
              { key: 'timeline', label: 'Timeline' },
              { key: 'table', label: 'Table' },
            ]}
          />

          <div className="hidden sm:block w-px h-6 bg-gray-200" />

          {/* Pivot toggle */}
          <div className={clsx(view === 'table' && 'opacity-50 pointer-events-none')}>
            <Tabs
              active={pivot}
              onChange={(v) => setParams({ pivot: v })}
              tabs={[
                { key: 'domain', label: 'By Domain' },
                { key: 'investor', label: 'By Investor' },
              ]}
            />
          </div>

          <div className="hidden sm:block w-px h-6 bg-gray-200" />

          {/* Domain filter */}
          <Select
            value={selectedDomain || ''}
            onChange={(v) => setFilter({ domain: v })}
            options={[
              { value: '', label: 'All domains' },
              ...domains.map((d) => ({ value: d.domain, label: `${d.domain} (${d.count})` })),
            ]}
          />

          {/* Investor filter */}
          <Select
            value={selectedInvestor || ''}
            onChange={(v) => setFilter({ investor_id: v })}
            options={[
              { value: '', label: 'All investors' },
              ...investors.map((inv) => ({ value: inv.id, label: inv.name })),
            ]}
          />

          {/* Year range */}
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="From year"
              value={yearFrom || ''}
              onChange={(v) => setFilter({ year_from: v || '' })}
              min={2000}
              max={2030}
              className="w-24 sm:w-28"
            />
            <span className="text-gray-400 text-sm">-</span>
            <Input
              type="number"
              placeholder="To year"
              value={yearTo || ''}
              onChange={(v) => setFilter({ year_to: v || '' })}
              min={2000}
              max={2030}
              className="w-24 sm:w-28"
            />
          </div>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}

          <span className="text-xs text-gray-400 w-full sm:w-auto sm:ml-auto">
            {total} event{total !== 1 ? 's' : ''}
          </span>
        </div>
      </Card>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Spinner />
          <span className="ml-2">Loading timeline...</span>
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No investment events yet"
          sub="Run enrichment with website URLs to populate the timeline from press releases"
        />
      ) : (
        <>
          {view === 'table' ? (
            <TableView
              events={events}
              onSelectInvestor={onSelectInvestor}
              sortCol={sortCol}
              sortDir={sortDir}
              onSort={toggleSort}
            />
          ) : (
            <div className="space-y-8">
              {pivotGroups.map(([groupName, groupEvents]) => (
                <PivotGroup
                  key={groupName}
                  name={groupName}
                  events={groupEvents}
                  pivot={pivot}
                  onSelectInvestor={onSelectInvestor}
                />
              ))}
            </div>
          )}
          <Pager
            page={page}
            pageSize={pageSize}
            total={total}
            totalPages={totalPages}
            onPageChange={(p) => setParams({ page: p })}
            onPageSizeChange={(s) => setFilter({ page_size: s })}
          />
        </>
      )}
    </div>
  )
}


function PivotGroup({ name, events, pivot, onSelectInvestor }) {
  const [expanded, setExpanded] = useState(true)

  // Group events within this pivot by year
  const byYear = useMemo(() => {
    const groups = {}
    for (const ev of events) {
      const year = ev.event_date ? new Date(ev.event_date).getFullYear() : 'Unknown'
      if (!groups[year]) groups[year] = []
      groups[year].push(ev)
    }
    return Object.entries(groups).sort((a, b) => {
      if (a[0] === 'Unknown') return 1
      if (b[0] === 'Unknown') return -1
      return Number(b[0]) - Number(a[0])
    })
  }, [events])

  const domainColor = DOMAIN_COLORS[name.toLowerCase()] || 'bg-gray-100 text-gray-800'

  return (
    <Card className="overflow-hidden p-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={clsx(
            'px-3 py-1 rounded-full text-xs font-medium',
            pivot === 'domain' ? domainColor : 'bg-hakuna-50 text-hakuna-800'
          )}>
            {name}
          </span>
          <span className="text-sm text-gray-500">
            {events.length} investment{events.length !== 1 ? 's' : ''}
          </span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="px-3 sm:px-5 pb-5">
          {byYear.map(([year, yearEvents]) => (
            <div key={year} className="mb-4 last:mb-0">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-10 sm:w-12 text-xs font-bold text-gray-400">{year}</div>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <div className="ml-2 sm:ml-14 space-y-2">
                {yearEvents.map((ev) => (
                  <EventCard
                    key={ev.id}
                    event={ev}
                    showInvestor={pivot === 'domain'}
                    showDomain={pivot === 'investor'}
                    onSelectInvestor={onSelectInvestor}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}


function EventCard({ event, showInvestor, showDomain, onSelectInvestor }) {
  const domainColor = event.domain
    ? DOMAIN_COLORS[event.domain.toLowerCase()] || 'bg-gray-100 text-gray-700'
    : null

  return (
    <div className="flex items-start gap-3 group">
      {/* Timeline dot */}
      <div className="mt-2 w-2 h-2 rounded-full bg-hakuna-400 shrink-0" />

      <div className="flex-1 min-w-0 border rounded-lg px-3 sm:px-4 py-3 hover:border-hakuna-300 transition-colors">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <span className="font-medium text-sm">{event.company_name}</span>
            {event.round_stage && (
              <span className="text-xs text-gray-500 ml-2">{event.round_stage}</span>
            )}
            {event.round_size_usd && (
              <span className="text-xs text-green-600 ml-2 font-medium">
                ${(event.round_size_usd / 1e6).toFixed(1)}M
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {showDomain && domainColor && (
              <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium', domainColor)}>
                {event.domain}
              </span>
            )}
            {event.event_date && (
              <span className="text-[10px] text-gray-400">
                {new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>

        {event.headline && event.headline !== event.company_name && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-1">{event.headline}</p>
        )}

        <div className="flex items-center gap-3 mt-2">
          {showInvestor && (
            <button
              onClick={() => onSelectInvestor(event.investor_id)}
              className="text-xs text-hakuna-600 hover:text-hakuna-700 font-medium"
            >
              {event.investor_name}
            </button>
          )}
          <span className="text-[10px] text-gray-400">
            {SOURCE_LABELS[event.source] || event.source}
          </span>
          {event.source_url && (
            <a
              href={event.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-blue-500 hover:underline inline-flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              Source <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}


function TableView({ events, onSelectInvestor, sortCol, sortDir, onSort }) {
  const columns = [
    {
      key: 'date',
      label: 'Date',
      sortable: true,
      render: (_v, ev) => (
        <span className="text-gray-500 whitespace-nowrap">
          {ev.event_date
            ? new Date(ev.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : '---'}
        </span>
      ),
    },
    {
      key: 'company',
      label: 'Company',
      sortable: true,
      render: (_v, ev) => (
        <div>
          <div className="font-medium text-gray-900">{ev.company_name}</div>
          {ev.headline && ev.headline !== ev.company_name && (
            <div className="text-xs text-gray-500 line-clamp-1">{ev.headline}</div>
          )}
        </div>
      ),
    },
    {
      key: 'investor',
      label: 'Investor',
      sortable: true,
      render: (_v, ev) => (
        <button
          onClick={(e) => { e.stopPropagation(); onSelectInvestor(ev.investor_id) }}
          className="text-hakuna-600 hover:text-hakuna-700 font-medium"
        >
          {ev.investor_name}
        </button>
      ),
    },
    {
      key: 'domain',
      label: 'Domain',
      sortable: true,
      render: (_v, ev) => {
        const domainColor = ev.domain
          ? DOMAIN_COLORS[ev.domain.toLowerCase()] || 'bg-gray-100 text-gray-700'
          : null
        return domainColor ? (
          <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium', domainColor)}>
            {ev.domain}
          </span>
        ) : null
      },
    },
    {
      key: 'stage',
      label: 'Stage',
      sortable: true,
      render: (_v, ev) => <span className="text-gray-600">{ev.round_stage || '---'}</span>,
    },
    {
      key: 'amount',
      label: 'Round Size',
      sortable: true,
      align: 'right',
      render: (_v, ev) => (
        <span className="text-green-600 font-medium whitespace-nowrap">
          {ev.round_size_usd ? `$${(ev.round_size_usd / 1e6).toFixed(1)}M` : '---'}
        </span>
      ),
    },
    {
      key: 'source',
      label: 'Source',
      sortable: true,
      render: (_v, ev) => (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {SOURCE_LABELS[ev.source] || ev.source}
          </span>
          {ev.source_url && (
            <a
              href={ev.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:underline inline-flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              Link <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      ),
    },
  ]

  return (
    <Table
      columns={columns}
      rows={events}
      sortBy={sortCol}
      sortOrder={sortDir}
      onSort={onSort}
      emptyMessage="No events"
    />
  )
}


function Pager({ page, pageSize, total, totalPages, onPageChange, onPageSizeChange }) {
  if (total === 0) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-4 text-sm text-gray-600 gap-3">
      <div className="flex items-center gap-3">
        <span>
          Showing <strong>{from}</strong>–<strong>{to}</strong> of <strong>{total}</strong>
        </span>
        <Select
          value={pageSize}
          onChange={(v) => onPageSizeChange(Number(v))}
          options={PAGE_SIZE_OPTIONS.map((s) => ({ value: s, label: `${s} / page` }))}
        />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </Button>
        <span className="px-2">
          Page <strong>{page}</strong> of {totalPages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Next <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
