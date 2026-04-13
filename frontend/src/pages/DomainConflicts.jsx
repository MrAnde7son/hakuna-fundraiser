import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchDomainConflicts } from '../api/investors'
import { fetchDomains, createDomain, updateDomain, deleteDomain } from '../api/focusAreas'
import clsx from 'clsx'

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

  const sortArrow = (key) =>
    sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : '↕'

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
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Domain Conflicts</h1>
          <p className="text-sm text-gray-500 mt-1">
            Investors vs. your target domains — see where the path is clearest
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 text-sm bg-hakuna-600 text-white rounded-lg hover:bg-hakuna-700 transition-colors"
          >
            + Add Domain
          </button>
          <button
            onClick={exportCSV}
            className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
          >
            Export CSV
          </button>
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
        <div className={clsx('grid gap-4 mb-6', summary.length <= 4 ? `grid-cols-${summary.length}` : 'grid-cols-3')}
             style={{ gridTemplateColumns: `repeat(${Math.min(summary.length, 4)}, minmax(0, 1fr))` }}>
          {summary.map((d) => (
            <div key={d.id} className="bg-white rounded-xl border p-4 group relative">
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setEditingDomain(d)}
                  className="text-gray-400 hover:text-hakuna-600 text-sm"
                  title="Edit domain"
                >
                  &#9998;
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Remove "${d.name}" domain?`)) removeMutation.mutate(d.id)
                  }}
                  className="text-gray-400 hover:text-red-500 text-sm"
                  title="Remove domain"
                >
                  ✕
                </button>
              </div>
              <h3 className="text-sm font-semibold mb-1">{d.name}</h3>
              {d.description && <p className="text-xs text-gray-400 mb-2">{d.description}</p>}
              <div className="flex gap-2">
                <MiniStat label="Clear" count={d.counts.clear} color="text-green-600 bg-green-50" />
                <MiniStat label="Watching" count={d.counts.watching} color="text-blue-600 bg-blue-50" />
                <MiniStat label="Adjacent" count={d.counts.adjacent} color="text-yellow-600 bg-yellow-50" />
                <MiniStat label="Blocking" count={d.counts.blocking} color="text-red-600 bg-red-50" />
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {(d.keywords || []).map((kw) => (
                  <span key={kw} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {domains.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          No domains defined. Add one to get started.
        </div>
      ) : isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading conflicts...</div>
      ) : matrix.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          No enriched investors yet. Run enrichment first.
        </div>
      ) : (
        <>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className="relative">
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search investor…"
              className="pl-3 pr-8 py-1.5 text-sm rounded-lg border bg-white border-gray-200 focus:outline-none focus:ring-2 focus:ring-hakuna-300 w-64"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-xs"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          <div className="ml-auto text-xs text-gray-500">
            {total.toLocaleString()} {total === 1 ? 'investor' : 'investors'}
          </div>
        </div>
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th
                  onClick={() => onSort('investor')}
                  className="text-left px-4 py-3 font-medium text-gray-500 cursor-pointer select-none hover:text-gray-800"
                >
                  <span className="inline-flex items-center gap-1.5">
                    Investor
                    <span className={`text-[9px] ${sortKey === 'investor' ? 'text-hakuna-600' : 'text-gray-300'}`}>{sortArrow('investor')}</span>
                  </span>
                </th>
                {domains.map((d) => {
                  const key = `domain:${d.id}`
                  return (
                    <th
                      key={d.id}
                      onClick={() => onSort(key)}
                      className="text-center px-4 py-3 font-medium text-gray-500 cursor-pointer select-none hover:text-gray-800"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {d.name}
                        <span className={`text-[9px] ${sortKey === key ? 'text-hakuna-600' : 'text-gray-300'}`}>{sortArrow(key)}</span>
                      </span>
                    </th>
                  )
                })}
                <th
                  onClick={() => onSort('worst')}
                  className="text-center px-4 py-3 font-medium text-gray-500 cursor-pointer select-none hover:text-gray-800"
                >
                  <span className="inline-flex items-center gap-1.5">
                    Worst
                    <span className={`text-[9px] ${sortKey === 'worst' ? 'text-hakuna-600' : 'text-gray-300'}`}>{sortArrow('worst')}</span>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pagedRows.map((row) => (
                <tr
                  key={row.investor_id}
                  onClick={() => navigate(`/investors/${row.investor_id}`)}
                  className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium">{row.investor_name}</td>
                  {domains.map((d) => {
                    const val = row.scores[String(d.id)] || 'clear'
                    return (
                      <td key={d.id} className="px-4 py-3 text-center">
                        <span
                          className={clsx(
                            'inline-block px-3 py-1 rounded-full text-xs font-medium',
                            CONFLICT_COLORS[val] || CONFLICT_COLORS.clear
                          )}
                        >
                          {val}
                        </span>
                      </td>
                    )
                  })}
                  <td className="px-4 py-3 text-center">
                    <span
                      className={clsx(
                        'inline-block px-3 py-1 rounded-full text-xs font-medium',
                        CONFLICT_COLORS[row.worst_conflict] || CONFLICT_COLORS.clear
                      )}
                    >
                      {row.worst_conflict}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pagedRows.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">
              No investors match the current search.
            </div>
          )}
        </div>
        {total > 0 && (
          <div className="flex items-center justify-between mt-4 px-1 text-sm">
            <span className="text-gray-500">
              Showing <span className="font-medium text-gray-700">{rangeStart}–{rangeEnd}</span> of <span className="font-medium text-gray-700">{total}</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Prev
              </button>
              <span className="text-gray-600 px-2">Page {safePage} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-2 py-1.5 text-sm border rounded-lg bg-white"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}/page</option>
                ))}
              </select>
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4"
      >
        <h2 className="text-lg font-semibold mb-4">{isEdit ? 'Edit Domain' : 'Add Domain'}</h2>

        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-hakuna-500"
          placeholder="e.g. API Security, Cloud Posture, Identity Governance"
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-hakuna-500"
          placeholder="Optional short description"
        />

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
          className="w-full border rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-hakuna-500"
          placeholder="e.g. api security, api gateway, api protection, runtime security"
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading || !name || !keywords.trim()}
            className="px-4 py-2 text-sm bg-hakuna-600 text-white rounded-lg hover:bg-hakuna-700 disabled:opacity-50"
          >
            {isLoading ? (isEdit ? 'Saving...' : 'Adding...') : (isEdit ? 'Save' : 'Add')}
          </button>
        </div>
      </form>
    </div>
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
