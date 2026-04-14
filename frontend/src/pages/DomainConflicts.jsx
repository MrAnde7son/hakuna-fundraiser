import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchDomainConflicts } from '../api/investors'
import { fetchDomains, createDomain, updateDomain, deleteDomain } from '../api/focusAreas'
import clsx from 'clsx'
import {
  Button,
  Input,
  Select,
  Card,
  Modal,
  Table,
  EmptyState,
  Pill,
  Spinner,
} from '@hakunahq/ui'
import { Pencil, X, Search, Plus, Download, FolderOpen } from 'lucide-react'

const CONFLICT_COLORS = {
  blocking: 'bg-red-100 text-red-800',
  adjacent: 'bg-yellow-100 text-yellow-800',
  watching: 'bg-blue-100 text-blue-800',
  clear: 'bg-green-50 text-green-700',
}

const SEVERITY_RANK = { blocking: 3, adjacent: 2, watching: 1, clear: 0 }
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200]


export default function DomainConflicts() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingDomain, setEditingDomain] = useState(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('investor')
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 250)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [search, sortKey, sortDir, pageSize])

  const { data: domains = [] } = useQuery({
    queryKey: ['domains'],
    queryFn: fetchDomains,
  })

  const { data: matrix = [], isLoading } = useQuery({
    queryKey: ['domain-conflicts'],
    queryFn: fetchDomainConflicts,
  })

  const addMutation = useMutation({
    mutationFn: createDomain,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] })
      queryClient.invalidateQueries({ queryKey: ['domain-conflicts'] })
      setShowAddForm(false)
    },
  })

  const editMutation = useMutation({
    mutationFn: ({ id, data }) => updateDomain(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] })
      queryClient.invalidateQueries({ queryKey: ['domain-conflicts'] })
      setEditingDomain(null)
    },
  })

  const removeMutation = useMutation({
    mutationFn: deleteDomain,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] })
      queryClient.invalidateQueries({ queryKey: ['domain-conflicts'] })
    },
  })

  const exportCSV = () => {
    const header = ['Investor', ...domains.map((d) => d.name), 'Worst Conflict'].join(',') + '\n'
    const rows = matrix
      .map((r) =>
        [r.investor_name, ...domains.map((d) => r.scores[String(d.id)] || 'clear'), r.worst_conflict].join(',')
      )
      .join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'hakuna-domain-conflicts.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const sortedRows = useMemo(() => {
    const filtered = search
      ? matrix.filter((r) => (r.investor_name || '').toLowerCase().includes(search))
      : matrix.slice()
    const dir = sortDir === 'asc' ? 1 : -1
    const getValue = (row) => {
      if (sortKey === 'investor') return (row.investor_name || '').toLowerCase()
      if (sortKey === 'worst') return SEVERITY_RANK[row.worst_conflict] ?? 0
      if (sortKey.startsWith('domain:')) {
        const id = sortKey.slice('domain:'.length)
        return SEVERITY_RANK[row.scores?.[id] || 'clear'] ?? 0
      }
      return 0
    }
    filtered.sort((a, b) => {
      const av = getValue(a)
      const bv = getValue(b)
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return (a.investor_name || '').localeCompare(b.investor_name || '')
    })
    return filtered
  }, [matrix, search, sortKey, sortDir])

  const total = sortedRows.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const rangeStart = total === 0 ? 0 : (safePage - 1) * pageSize + 1
  const rangeEnd = Math.min(safePage * pageSize, total)
  const pagedRows = sortedRows.slice((safePage - 1) * pageSize, safePage * pageSize)

  const onSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'investor' ? 'asc' : 'desc')
    }
  }

  const tableColumns = useMemo(() => {
    const cols = [
      {
        key: 'investor',
        label: 'Investor',
        sortable: true,
        render: (_v, row) => <span className="font-medium">{row.investor_name}</span>,
      },
      ...domains.map((d) => ({
        key: `domain:${d.id}`,
        label: d.name,
        sortable: true,
        align: 'center',
        render: (_v, row) => {
          const val = row.scores[String(d.id)] || 'clear'
          return (
            <span
              className={clsx(
                'inline-block px-3 py-1 rounded-full text-xs font-medium',
                CONFLICT_COLORS[val] || CONFLICT_COLORS.clear
              )}
            >
              {val}
            </span>
          )
        },
      })),
      {
        key: 'worst',
        label: 'Worst',
        sortable: true,
        align: 'center',
        render: (_v, row) => (
          <span
            className={clsx(
              'inline-block px-3 py-1 rounded-full text-xs font-medium',
              CONFLICT_COLORS[row.worst_conflict] || CONFLICT_COLORS.clear
            )}
          >
            {row.worst_conflict}
          </span>
        ),
      },
    ]
    return cols
  }, [domains])

  // Summary counts per domain
  const summary = domains.map((d) => {
    const counts = { clear: 0, watching: 0, adjacent: 0, blocking: 0 }
    for (const row of matrix) {
      const val = row.scores[String(d.id)] || 'clear'
      if (counts[val] !== undefined) counts[val]++
    }
    return { ...d, counts }
  })

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Domain Conflicts</h1>
          <p className="text-sm text-gray-500 mt-1">
            Investors vs. your target domains — see where the path is clearest
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAddForm(true)}
          >
            <Plus size={16} />
            Add Domain
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={exportCSV}
          >
            <Download size={16} />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Add domain modal */}
      {showAddForm && (
        <DomainForm
          onSubmit={(data) => addMutation.mutate(data)}
          onCancel={() => setShowAddForm(false)}
          isLoading={addMutation.isPending}
        />
      )}

      {/* Edit domain modal */}
      {editingDomain && (
        <DomainForm
          initialData={editingDomain}
          onSubmit={(data) => editMutation.mutate({ id: editingDomain.id, data })}
          onCancel={() => setEditingDomain(null)}
          isLoading={editMutation.isPending}
        />
      )}

      {/* Domain summary cards */}
      {summary.length > 0 && (
        <div
          className="grid gap-3 sm:gap-4 mb-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          style={{
            gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, 240px), 1fr))`,
          }}
        >
          {summary.map((d) => (
            <Card key={d.id} className="p-4 group relative">
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setEditingDomain(d)}
                  className="text-gray-400 hover:text-hakuna-600"
                  title="Edit domain"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Remove "${d.name}" domain?`)) removeMutation.mutate(d.id)
                  }}
                  className="text-gray-400 hover:text-red-500"
                  title="Remove domain"
                >
                  <X size={14} />
                </button>
              </div>
              <h3 className="text-sm font-semibold mb-1">{d.name}</h3>
              {d.description && <p className="text-xs text-gray-400 mb-2">{d.description}</p>}
              <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                <MiniStat label="Clear" count={d.counts.clear} color="text-green-600 bg-green-50" />
                <MiniStat label="Watching" count={d.counts.watching} color="text-blue-600 bg-blue-50" />
                <MiniStat label="Adjacent" count={d.counts.adjacent} color="text-yellow-600 bg-yellow-50" />
                <MiniStat label="Blocking" count={d.counts.blocking} color="text-red-600 bg-red-50" />
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {(d.keywords || []).map((kw) => (
                  <Pill key={kw} label={kw} color="gray" />
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {domains.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No domains defined"
          sub="Add one to get started."
        />
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
          <Spinner /> Loading conflicts...
        </div>
      ) : matrix.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No enriched investors yet"
          sub="Run enrichment first."
        />
      ) : (
        <>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className="relative w-full sm:w-auto sm:w-64">
            <Input
              type="search"
              value={searchInput}
              onChange={(value) => setSearchInput(value)}
              placeholder="Search investor…"
            />
          </div>
          <div className="w-full sm:w-auto sm:ml-auto text-xs text-gray-500">
            {total.toLocaleString()} {total === 1 ? 'investor' : 'investors'}
          </div>
        </div>
        <Card className="overflow-hidden">
          <Table
            columns={tableColumns}
            rows={pagedRows}
            rowKey={(row) => row.investor_id}
            onRowClick={(row) => navigate(`/investors/${row.investor_id}`)}
            sortBy={sortKey}
            sortOrder={sortDir}
            onSort={onSort}
            emptyMessage="No investors match the current search."
          />
        </Card>
        {total > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-4 px-1 text-sm gap-3">
            <span className="text-gray-500">
              Showing <span className="font-medium text-gray-700">{rangeStart}–{rangeEnd}</span> of <span className="font-medium text-gray-700">{total}</span>
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
              >
                Prev
              </Button>
              <span className="text-gray-600 px-2">Page {safePage} / {totalPages}</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
              >
                Next
              </Button>
              <Select
                value={pageSize}
                onChange={(value) => setPageSize(Number(value))}
                options={PAGE_SIZE_OPTIONS.map((n) => ({ value: n, label: `${n}/page` }))}
              />
            </div>
          </div>
        )}
        </>
      )}
    </div>
  )
}

function DomainForm({ initialData, onSubmit, onCancel, isLoading }) {
  const isEdit = !!initialData
  const [name, setName] = useState(initialData?.name || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [keywords, setKeywords] = useState(
    (initialData?.keywords || []).join(', ')
  )

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({
      name,
      description: description || null,
      keywords: keywords
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    })
  }

  return (
    <Modal
      open
      onClose={onCancel}
      title={isEdit ? 'Edit Domain' : 'Add Domain'}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          label="Name *"
          required
          value={name}
          onChange={(value) => setName(value)}
          placeholder="e.g. API Security, Cloud Posture, Identity Governance"
        />

        <Input
          label="Description"
          value={description}
          onChange={(value) => setDescription(value)}
          placeholder="Optional short description"
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Keywords *
          </label>
          <p className="text-xs text-gray-400 mb-2">
            Comma-separated terms to match against investor portfolios. These are matched against portfolio company names, categories, descriptions, and conflict maps.
          </p>
          <textarea
            required
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm mb-1 focus:outline-none focus:ring-2 focus:ring-hakuna-500"
            placeholder="e.g. api security, api gateway, api protection, runtime security"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!name || !keywords.trim()}
            loading={isLoading}
          >
            {isEdit ? 'Save' : 'Add'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function MiniStat({ label, count, color }) {
  return (
    <div className={clsx('flex-1 rounded-lg px-2 py-1.5 text-center', color)}>
      <div className="text-lg font-bold">{count}</div>
      <div className="text-[10px]">{label}</div>
    </div>
  )
}
