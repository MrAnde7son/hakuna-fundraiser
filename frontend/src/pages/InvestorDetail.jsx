import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchInvestor, fetchPartners, fetchPortfolio,
  fetchOutreach, fetchJobs, createOutreachNote, triggerEnrichment,
} from '../api/investors'
import StatusBadge from '../components/StatusBadge'
import ConflictBadge from '../components/ConflictBadge'
import SpaceCoverageGrid from '../components/SpaceCoverageGrid'
import { useState } from 'react'

const TABS = ['Overview', 'Partners', 'Portfolio', 'Space Coverage', 'AI Briefing', 'Outreach', 'Raw Data']
const TAB_SLUGS = Object.fromEntries(TABS.map((t) => [t.toLowerCase().replace(/ /g, '-'), t]))
const toSlug = (t) => t.toLowerCase().replace(/ /g, '-')

export default function InvestorDetail() {
  const { id } = useParams()
  const investorId = Number(id)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const tabSlug = searchParams.get('tab') || 'overview'
  const tab = TAB_SLUGS[tabSlug] || 'Overview'
  const setTab = (t) => {
    const slug = toSlug(t)
    setSearchParams(slug === 'overview' ? {} : { tab: slug }, { replace: true })
  }

  const qc = useQueryClient()

  const { data: investor, isLoading } = useQuery({
    queryKey: ['investor', investorId],
    queryFn: () => fetchInvestor(investorId),
    refetchInterval: 5_000,
  })

  const { data: partners = [] } = useQuery({
    queryKey: ['partners', investorId],
    queryFn: () => fetchPartners(investorId),
  })

  const { data: portfolio = [] } = useQuery({
    queryKey: ['portfolio', investorId],
    queryFn: () => fetchPortfolio(investorId),
  })

  const { data: outreach = [] } = useQuery({
    queryKey: ['outreach', investorId],
    queryFn: () => fetchOutreach(investorId),
  })

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs', investorId],
    queryFn: () => fetchJobs(investorId),
  })

  const enrichMut = useMutation({
    mutationFn: () => triggerEnrichment(investorId),
    onSuccess: () => qc.invalidateQueries(['investor', investorId]),
  })

  if (isLoading || !investor) {
    return <div className="p-8 text-ink-400 text-sm">Loading…</div>
  }

  const ai = investor.ai_enrichment || {}

  const initials = (investor.name || '?').split(/\s+/).slice(0, 2).map((s) => s[0]).join('').toUpperCase()

  return (
    <div className="page-shell">
      <div className="page-content p-8 max-w-[1400px] mx-auto">
        {/* Back */}
        <button
          onClick={() => navigate('/investors')}
          className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 mb-5 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
          Back to investors
        </button>

        {/* Header */}
        <div className="card p-6 mb-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-hakuna-radial pointer-events-none"/>
          <div className="relative flex items-start gap-5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-hakuna-500 to-hakuna-800 text-white grid place-items-center text-lg font-semibold shadow-lift ring-1 ring-hakuna-700/30 shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-[28px] leading-tight font-display text-ink-900 truncate">{investor.name}</h1>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <StatusBadge status={investor.enrichment_status} />
                {investor.type && (
                  <span className="chip bg-ink-100 text-ink-700 uppercase tracking-wide text-[10px]">{investor.type}</span>
                )}
                {investor.stage_focus && (
                  <span className="chip bg-savanna-50 text-savanna-800 ring-1 ring-savanna-200">{investor.stage_focus}</span>
                )}
                <span className="text-xs text-ink-400">
                  {investor.last_enriched_at
                    ? `Last enriched ${new Date(investor.last_enriched_at).toLocaleString()}`
                    : 'Never enriched'}
                </span>
              </div>
            </div>
            <button
              onClick={() => enrichMut.mutate()}
              disabled={enrichMut.isPending}
              className="btn-primary shrink-0"
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5"/>
                <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M3 21v-5h5"/>
              </svg>
              {enrichMut.isPending ? 'Queuing…' : 'Re-enrich Now'}
            </button>
          </div>

          {/* Source status */}
          <div className="relative flex gap-4 mt-5 pt-4 border-t border-ink-100 flex-wrap">
            {['crunchbase', 'linkedin', 'website', 'press_release', 'news', 'sec', 'ai'].map((src) => (
              <div key={src} className="flex items-center gap-1.5 text-[11px]">
                <span className="text-ink-400 capitalize font-medium">{src.replace('_', ' ')}</span>
                <StatusBadge status={investor[`${src}_status`] || 'pending'} />
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 p-1 rounded-xl bg-white border border-ink-100 shadow-soft overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3.5 py-1.5 text-sm rounded-lg transition-all whitespace-nowrap ${
                tab === t
                  ? 'bg-hakuna-700 text-white shadow-soft'
                  : 'text-ink-600 hover:text-ink-900 hover:bg-ink-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="card p-6">
        {tab === 'Overview' && <OverviewTab investor={investor} ai={ai} />}
        {tab === 'Partners' && <PartnersTab partners={partners} />}
        {tab === 'Portfolio' && <PortfolioTab portfolio={portfolio} />}
        {tab === 'Space Coverage' && <SpaceCoverageGrid coverage={ai.space_coverage} />}
        {tab === 'AI Briefing' && <AIBriefingTab ai={ai} />}
        {tab === 'Outreach' && (
          <OutreachTab
            investorId={investorId}
            outreach={outreach}
            suggestedAngle={ai.suggested_angle}
          />
        )}
        {tab === 'Raw Data' && <RawDataTab investor={investor} jobs={jobs} />}
        </div>
      </div>
    </div>
  )
}


function OverviewTab({ investor, ai }) {
  const sec = investor.raw_sec || {}
  const fmtUsd = (n) => (n ? `$${(n / 1e6).toFixed(0)}M` : null)
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <Field label="Fund Size (Form D)" value={fmtUsd(investor.fund_size_usd) || 'Unknown'} />
        <Field label="Form ADV AUM" value={fmtUsd(sec.adv_aum_usd) || '—'} />
        <Field label="Industry Group" value={sec.industry_group || '—'} />
        <Field label="Fund Type" value={sec.fund_type || '—'} />
        <Field label="Stage Focus" value={investor.stage_focus || 'Unknown'} />
        <Field label="Geo Focus" value={investor.geo_focus || 'Unknown'} />
        <Field label="Type" value={investor.type?.toUpperCase()} />
        <Field label="Contact" value={investor.contact || '—'} />
        <Field label="Website" value={investor.website || '—'} />
      </div>
      {ai.thesis_inference && (
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-1">Thesis Inference</h3>
          <p className="text-sm text-blue-800">{ai.thesis_inference}</p>
        </div>
      )}
      {ai.whitespace_signal && (
        <div className="bg-green-50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-green-900 mb-1">Whitespace Signal</h3>
          <p className="text-sm text-green-800">{ai.whitespace_signal}</p>
        </div>
      )}
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-gray-400 font-medium">{label}</dt>
      <dd className="text-sm mt-0.5">{value}</dd>
    </div>
  )
}


function PartnersTab({ partners }) {
  if (!partners.length) return <p className="text-gray-400 text-sm">No partner data available</p>
  return (
    <div className="space-y-4">
      {partners.map((p) => (
        <div key={p.id} className="border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">{p.name}</h3>
              <p className="text-sm text-gray-500">{p.title || 'Title unknown'}</p>
            </div>
            {p.linkedin_url && (
              <a
                href={p.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 text-sm hover:underline"
              >
                LinkedIn ↗
              </a>
            )}
          </div>
          {p.network_degree && (
            <p className="text-xs text-gray-400 mt-1">Network degree: {p.network_degree}</p>
          )}
        </div>
      ))}
    </div>
  )
}


function PortfolioTab({ portfolio }) {
  if (!portfolio.length) return <p className="text-gray-400 text-sm">No portfolio data</p>

  const grouped = { blocking: [], adjacent: [], watching: [], validating: [], clear: [], unknown: [] }
  for (const pc of portfolio) {
    const key = pc.conflict_type || 'unknown'
    if (grouped[key]) grouped[key].push(pc)
    else grouped.unknown.push(pc)
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([type, companies]) =>
        companies.length > 0 ? (
          <div key={type}>
            <h3 className="text-sm font-semibold capitalize mb-2 flex items-center gap-2">
              <ConflictBadge type={type === 'unknown' ? null : type} />
              {type} ({companies.length})
            </h3>
            <div className="space-y-2">
              {companies.map((pc) => (
                <div key={pc.id} className="border rounded px-3 py-2 text-sm">
                  <span className="font-medium">{pc.name}</span>
                  {pc.category && <span className="text-gray-400 ml-2">· {pc.category}</span>}
                  {pc.description && (
                    <p className="text-gray-500 text-xs mt-0.5">{pc.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null
      )}
    </div>
  )
}


function AIBriefingTab({ ai }) {
  if (!ai || Object.keys(ai).length === 0) {
    return <p className="text-gray-400 text-sm">No AI enrichment data. Trigger enrichment to generate.</p>
  }

  return (
    <div className="space-y-6">
      {ai.thesis_inference && <Section title="Thesis Inference" content={ai.thesis_inference} />}
      {ai.whitespace_signal && <Section title="Whitespace Signal" content={ai.whitespace_signal} />}
      {ai.partner_domain_fit && <Section title="Partner Domain Fit" content={ai.partner_domain_fit} />}
      {ai.suggested_angle && <Section title="Suggested Approach Angle" content={ai.suggested_angle} />}

      {ai.vm_em_portfolio_map && (
        <div>
          <h3 className="text-sm font-semibold mb-2">VM/EM Portfolio Map</h3>
          {Object.entries(ai.vm_em_portfolio_map).map(([level, items]) =>
            items?.length > 0 ? (
              <div key={level} className="mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <ConflictBadge type={level} />
                </div>
                <ul className="text-sm space-y-0.5 ml-4">
                  {items.map((item, i) => (
                    <li key={i} className="text-gray-600">• {item}</li>
                  ))}
                </ul>
              </div>
            ) : null
          )}
        </div>
      )}

      {ai.research_gaps?.length > 0 && (
        <div className="bg-amber-50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-amber-900 mb-2">Research Gaps</h3>
          <ul className="text-sm text-amber-800 space-y-1">
            {ai.research_gaps.map((gap, i) => (
              <li key={i}>• {gap}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Section({ title, content }) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-1">{title}</h3>
      <p className="text-sm text-gray-600">{content}</p>
    </div>
  )
}


function OutreachTab({ investorId, outreach, suggestedAngle }) {
  const [form, setForm] = useState({ status: 'target', notes: '', next_action: '' })
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: (data) => createOutreachNote(investorId, data),
    onSuccess: () => {
      qc.invalidateQueries(['outreach', investorId])
      setForm({ status: 'target', notes: '', next_action: '' })
    },
  })

  return (
    <div className="space-y-6">
      {suggestedAngle && (
        <div className="bg-hakuna-50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-hakuna-900 mb-1">Suggested Angle</h3>
          <p className="text-sm text-hakuna-800">{suggestedAngle}</p>
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); mutation.mutate(form) }}
        className="border rounded-lg p-4 space-y-3"
      >
        <h3 className="text-sm font-semibold">Add Note</h3>
        <select
          className="w-full border rounded-lg px-3 py-2 text-sm"
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value })}
        >
          {['target', 'contacted', 'meeting', 'passed', 'closed'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <textarea
          className="w-full border rounded-lg px-3 py-2 text-sm"
          placeholder="Notes"
          rows={3}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        <input
          className="w-full border rounded-lg px-3 py-2 text-sm"
          placeholder="Next action"
          value={form.next_action}
          onChange={(e) => setForm({ ...form, next_action: e.target.value })}
        />
        <button
          type="submit"
          disabled={mutation.isPending}
          className="bg-hakuna-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-hakuna-700 disabled:opacity-50"
        >
          Save
        </button>
      </form>

      <div className="space-y-3">
        {outreach.map((note) => (
          <div key={note.id} className="border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={note.status} />
              <span className="text-xs text-gray-400">
                {new Date(note.created_at).toLocaleString()}
              </span>
            </div>
            {note.notes && <p className="text-sm">{note.notes}</p>}
            {note.next_action && (
              <p className="text-sm text-blue-600 mt-1">Next: {note.next_action}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}


const JOBS_PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

function SourceBadge({ label, present }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
        present
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
          : 'bg-gray-50 border-gray-200 text-gray-400'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${present ? 'bg-emerald-500' : 'bg-gray-300'}`} />
      {label}
    </span>
  )
}

function RawJsonCard({ title, data }) {
  const hasData = data && (Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0)
  return (
    <details className="border rounded-lg bg-white group">
      <summary className="flex items-center justify-between cursor-pointer px-4 py-3 text-sm font-semibold select-none hover:bg-gray-50 rounded-lg">
        <span className="flex items-center gap-2">
          <span className="text-gray-400 group-open:rotate-90 transition-transform">›</span>
          {title}
        </span>
        <span className={`text-xs font-normal ${hasData ? 'text-emerald-600' : 'text-gray-400'}`}>
          {hasData ? 'available' : 'no data'}
        </span>
      </summary>
      <pre className="bg-gray-50 border-t rounded-b-lg p-3 text-xs overflow-auto max-h-96 font-mono">
        {hasData ? JSON.stringify(data, null, 2) : 'No data'}
      </pre>
    </details>
  )
}

function RawDataTab({ investor, jobs }) {
  const sec = investor.raw_sec || {}
  const filings = sec.filings || []
  const newsProviders = investor.raw_news?.providers_used || []

  const [jobsPage, setJobsPage] = useState(1)
  const [jobsPageSize, setJobsPageSize] = useState(10)
  const [jobsFilter, setJobsFilter] = useState('all')

  const filteredJobs = jobs.filter((j) => jobsFilter === 'all' || j.status === jobsFilter)
  const jobsTotal = filteredJobs.length
  const jobsTotalPages = Math.max(1, Math.ceil(jobsTotal / jobsPageSize))
  const jobsPageSafe = Math.min(jobsPage, jobsTotalPages)
  const pagedJobs = filteredJobs.slice(
    (jobsPageSafe - 1) * jobsPageSize,
    jobsPageSafe * jobsPageSize,
  )

  const jobStatusCounts = jobs.reduce((acc, j) => {
    acc[j.status] = (acc[j.status] || 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Data sources
        </h3>
        <div className="flex flex-wrap gap-2">
          <SourceBadge label="SEC" present={filings.length > 0} />
          <SourceBadge label="Crunchbase" present={!!investor.raw_crunchbase} />
          <SourceBadge label="News" present={!!investor.raw_news} />
          <SourceBadge label="AI Enrichment" present={!!investor.ai_enrichment} />
        </div>
      </div>

      {filings.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-sm font-semibold">SEC Form D Filings</h3>
            <span className="text-xs text-gray-500">{filings.length} filing{filings.length === 1 ? '' : 's'}</span>
          </div>
          <div className="border rounded-lg overflow-hidden bg-white">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left px-3 py-2">Filed</th>
                  <th className="text-left px-3 py-2">Form</th>
                  <th className="text-left px-3 py-2">Issuer</th>
                  <th className="text-right px-3 py-2">Offering</th>
                  <th className="text-right px-3 py-2">Sold</th>
                  <th className="text-left px-3 py-2">Accession</th>
                </tr>
              </thead>
              <tbody>
                {filings.map((f, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono">{f.file_date || '—'}</td>
                    <td className="px-3 py-2">{f.form_type || '—'}</td>
                    <td className="px-3 py-2 truncate max-w-xs">{f.issuer_name || '—'}</td>
                    <td className="px-3 py-2 text-right">
                      {f.total_offering_amount_usd
                        ? `$${(f.total_offering_amount_usd / 1e6).toFixed(1)}M`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {f.total_amount_sold_usd
                        ? `$${(f.total_amount_sold_usd / 1e6).toFixed(1)}M`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {f.filing_url ? (
                        <a
                          href={f.filing_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {f.accession}
                        </a>
                      ) : (
                        f.accession || '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sec.related_persons?.length > 0 && (
            <p className="mt-2 text-xs text-gray-500">
              Related persons (latest filing):{' '}
              {sec.related_persons.map((p) => p.name).join(', ')}
            </p>
          )}
        </section>
      )}

      {newsProviders.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-2">News providers used</h3>
          <div className="flex flex-wrap gap-1.5">
            {newsProviders.map((p) => (
              <span
                key={p}
                className="inline-block bg-gray-100 text-gray-700 rounded px-2 py-0.5 text-xs font-mono"
              >
                {p}
              </span>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="text-sm font-semibold mb-2">Raw payloads</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <RawJsonCard title="Crunchbase" data={investor.raw_crunchbase} />
          <RawJsonCard title="News Signals" data={investor.raw_news} />
          <RawJsonCard title="SEC" data={investor.raw_sec} />
          <RawJsonCard title="AI Enrichment" data={investor.ai_enrichment} />
        </div>
      </section>

      <section className="border-t pt-6">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-baseline gap-3">
            <h3 className="text-sm font-semibold">Enrichment Jobs</h3>
            <span className="text-xs text-gray-500">
              {jobs.length} total
              {jobStatusCounts.failed ? ` · ${jobStatusCounts.failed} failed` : ''}
              {jobStatusCounts.running ? ` · ${jobStatusCounts.running} running` : ''}
            </span>
          </div>
          <select
            value={jobsFilter}
            onChange={(e) => {
              setJobsFilter(e.target.value)
              setJobsPage(1)
            }}
            className="border rounded-lg px-2 py-1 text-xs"
          >
            <option value="all">All statuses</option>
            {Object.keys(jobStatusCounts).map((s) => (
              <option key={s} value={s}>{s} ({jobStatusCounts[s]})</option>
            ))}
          </select>
        </div>

        {pagedJobs.length === 0 ? (
          <div className="text-xs text-gray-400 border rounded-lg px-3 py-6 text-center bg-gray-50">
            No jobs{jobsFilter !== 'all' ? ` with status “${jobsFilter}”` : ''}.
          </div>
        ) : (
          <div className="space-y-2">
            {pagedJobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center gap-3 text-xs border rounded-lg px-3 py-2 bg-white hover:bg-gray-50"
              >
                <span className="font-mono">{job.job_type}</span>
                <StatusBadge status={job.status} />
                {job.error_msg && (
                  <span className="text-red-500 truncate" title={job.error_msg}>
                    {job.error_msg}
                  </span>
                )}
                <span className="text-gray-400 ml-auto">
                  {new Date(job.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}

        {jobsTotal > 0 && (
          <div className="flex items-center justify-between mt-3 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span>
                Showing <strong>{(jobsPageSafe - 1) * jobsPageSize + 1}</strong>–
                <strong>{Math.min(jobsPageSafe * jobsPageSize, jobsTotal)}</strong> of{' '}
                <strong>{jobsTotal}</strong>
              </span>
              <select
                value={jobsPageSize}
                onChange={(e) => {
                  setJobsPageSize(Number(e.target.value))
                  setJobsPage(1)
                }}
                className="border rounded-lg px-2 py-1 text-xs"
              >
                {JOBS_PAGE_SIZE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s} / page</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setJobsPage(1)}
                disabled={jobsPageSafe <= 1}
                className="px-2 py-1 border rounded disabled:opacity-40"
              >
                ««
              </button>
              <button
                onClick={() => setJobsPage(jobsPageSafe - 1)}
                disabled={jobsPageSafe <= 1}
                className="px-2 py-1 border rounded disabled:opacity-40"
              >
                ‹
              </button>
              <span className="px-2">
                Page <strong>{jobsPageSafe}</strong> / {jobsTotalPages}
              </span>
              <button
                onClick={() => setJobsPage(jobsPageSafe + 1)}
                disabled={jobsPageSafe >= jobsTotalPages}
                className="px-2 py-1 border rounded disabled:opacity-40"
              >
                ›
              </button>
              <button
                onClick={() => setJobsPage(jobsTotalPages)}
                disabled={jobsPageSafe >= jobsTotalPages}
                className="px-2 py-1 border rounded disabled:opacity-40"
              >
                »»
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
