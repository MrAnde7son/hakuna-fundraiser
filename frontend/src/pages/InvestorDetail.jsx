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
import {
  Button,
  Card,
  Tabs,
  Pill,
  Input,
  Select,
  Avatar,
  Pagination,
  useToast,
} from '@hakunahq/ui'
import {
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  ChevronRight,
} from 'lucide-react'

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
  const toast = useToast()

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
    onSuccess: () => {
      qc.invalidateQueries(['investor', investorId])
      toast?.success?.('Enrichment queued')
    },
    onError: () => toast?.error?.('Failed to queue enrichment'),
  })

  if (isLoading || !investor) {
    return <div className="p-8 text-ink-400 text-sm">Loading…</div>
  }

  const ai = investor.ai_enrichment || {}

  return (
    <div className="page-shell">
      <div className="page-content p-4 sm:p-6 md:p-8 max-w-[1400px] mx-auto">
        {/* Back */}
        <button
          onClick={() => navigate('/investors')}
          className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 mb-5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to investors
        </button>

        {/* Header */}
        <Card className="mb-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-hakuna-radial pointer-events-none" />
          <div className="relative flex items-start gap-4 sm:gap-5 flex-wrap">
            <Avatar name={investor.name || '?'} size="lg" />
            <div className="flex-1 min-w-[180px]">
              <h1 className="text-xl sm:text-2xl md:text-[28px] leading-tight font-display text-ink-900 truncate">{investor.name}</h1>
              <div className="flex items-center gap-2 sm:gap-3 mt-2 flex-wrap">
                <StatusBadge status={investor.enrichment_status} />
                {investor.type && (
                  <Pill label={investor.type.toUpperCase()} />
                )}
                {investor.stage_focus && (
                  <Pill label={investor.stage_focus} color="savanna" />
                )}
                <span className="text-xs text-ink-400">
                  {investor.last_enriched_at
                    ? `Last enriched ${new Date(investor.last_enriched_at).toLocaleString()}`
                    : 'Never enriched'}
                </span>
              </div>
            </div>
            <Button
              variant="primary"
              onClick={() => enrichMut.mutate()}
              loading={enrichMut.isPending}
              disabled={enrichMut.isPending}
              className="shrink-0 w-full sm:w-auto"
            >
              <RefreshCw className="w-4 h-4" />
              {enrichMut.isPending ? 'Queuing…' : 'Re-enrich Now'}
            </Button>
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
        </Card>

        {/* Tabs */}
        <div className="mb-6">
          <Tabs
            active={tab}
            onChange={setTab}
            tabs={TABS.map((t) => ({ key: t, label: t }))}
            variant="pill"
          />
        </div>

        {/* Tab content */}
        <Card>
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
        </Card>
      </div>
    </div>
  )
}


function OverviewTab({ investor, ai }) {
  const sec = investor.raw_sec || {}
  const fmtUsd = (n) => (n ? `$${(n / 1e6).toFixed(0)}M` : null)
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
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
      <dt className="text-xs text-ink-400 font-medium">{label}</dt>
      <dd className="text-sm mt-0.5">{value}</dd>
    </div>
  )
}


function PartnersTab({ partners }) {
  if (!partners.length) return <p className="text-ink-400 text-sm">No partner data available</p>
  return (
    <div className="space-y-4">
      {partners.map((p) => (
        <Card key={p.id}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">{p.name}</h3>
              <p className="text-sm text-ink-500">{p.title || 'Title unknown'}</p>
            </div>
            {p.linkedin_url && (
              <a
                href={p.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 text-sm hover:underline"
              >
                LinkedIn
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
          {p.network_degree && (
            <p className="text-xs text-ink-400 mt-1">Network degree: {p.network_degree}</p>
          )}
        </Card>
      ))}
    </div>
  )
}


function PortfolioTab({ portfolio }) {
  if (!portfolio.length) return <p className="text-ink-400 text-sm">No portfolio data</p>

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
                <div key={pc.id} className="border border-ink-100 rounded px-3 py-2 text-sm">
                  <span className="font-medium">{pc.name}</span>
                  {pc.category && <span className="text-ink-400 ml-2">· {pc.category}</span>}
                  {pc.description && (
                    <p className="text-ink-500 text-xs mt-0.5">{pc.description}</p>
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
    return <p className="text-ink-400 text-sm">No AI enrichment data. Trigger enrichment to generate.</p>
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
                    <li key={i} className="text-ink-600">• {item}</li>
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
      <p className="text-sm text-ink-600">{content}</p>
    </div>
  )
}


function OutreachTab({ investorId, outreach, suggestedAngle }) {
  const [form, setForm] = useState({ status: 'target', notes: '', next_action: '' })
  const qc = useQueryClient()
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: (data) => createOutreachNote(investorId, data),
    onSuccess: () => {
      qc.invalidateQueries(['outreach', investorId])
      setForm({ status: 'target', notes: '', next_action: '' })
      toast?.success?.('Note saved')
    },
    onError: () => toast?.error?.('Failed to save note'),
  })

  const statusOptions = ['target', 'contacted', 'meeting', 'passed', 'closed'].map((s) => ({
    value: s,
    label: s,
  }))

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
        className="border border-ink-100 rounded-lg p-4 space-y-3"
      >
        <h3 className="text-sm font-semibold">Add Note</h3>
        <Select
          options={statusOptions}
          value={form.status}
          onChange={(value) => setForm({ ...form, status: value })}
        />
        <textarea
          className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm"
          placeholder="Notes"
          rows={3}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        <Input
          placeholder="Next action"
          value={form.next_action}
          onChange={(value) => setForm({ ...form, next_action: value })}
        />
        <Button
          type="submit"
          variant="primary"
          loading={mutation.isPending}
          disabled={mutation.isPending}
        >
          Save
        </Button>
      </form>

      <div className="space-y-3">
        {outreach.map((note) => (
          <Card key={note.id}>
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={note.status} />
              <span className="text-xs text-ink-400">
                {new Date(note.created_at).toLocaleString()}
              </span>
            </div>
            {note.notes && <p className="text-sm">{note.notes}</p>}
            {note.next_action && (
              <p className="text-sm text-blue-600 mt-1">Next: {note.next_action}</p>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}


const JOBS_PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

function SourceBadge({ label, present }) {
  return (
    <Pill
      label={label}
      color={present ? 'emerald' : 'gray'}
    />
  )
}

function RawJsonCard({ title, data }) {
  const hasData = data && (Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0)
  return (
    <details className="border border-ink-100 rounded-lg bg-white group">
      <summary className="flex items-center justify-between cursor-pointer px-4 py-3 text-sm font-semibold select-none hover:bg-ink-50 rounded-lg">
        <span className="flex items-center gap-2">
          <ChevronRight className="w-4 h-4 text-ink-400 group-open:rotate-90 transition-transform" />
          {title}
        </span>
        <span className={`text-xs font-normal ${hasData ? 'text-emerald-600' : 'text-ink-400'}`}>
          {hasData ? 'available' : 'no data'}
        </span>
      </summary>
      <pre className="bg-ink-50 border-t border-ink-100 rounded-b-lg p-3 text-xs overflow-auto max-h-96 font-mono">
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

  const jobsFilterOptions = [
    { value: 'all', label: 'All statuses' },
    ...Object.keys(jobStatusCounts).map((s) => ({
      value: s,
      label: `${s} (${jobStatusCounts[s]})`,
    })),
  ]

  const jobsPageSizeOptions = JOBS_PAGE_SIZE_OPTIONS.map((s) => ({
    value: String(s),
    label: `${s} / page`,
  }))

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-2">
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
            <span className="text-xs text-ink-500">{filings.length} filing{filings.length === 1 ? '' : 's'}</span>
          </div>
          <div className="border border-ink-100 rounded-lg overflow-x-auto bg-white">
            <table className="w-full text-xs min-w-[600px]">
              <thead className="bg-ink-50 text-ink-500">
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
                  <tr key={i} className="border-t border-ink-100 hover:bg-ink-50">
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
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          {f.accession}
                          <ExternalLink className="w-3 h-3" />
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
            <p className="mt-2 text-xs text-ink-500">
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
              <Pill key={p} label={p} />
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

      <section className="border-t border-ink-100 pt-6">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-baseline gap-3">
            <h3 className="text-sm font-semibold">Enrichment Jobs</h3>
            <span className="text-xs text-ink-500">
              {jobs.length} total
              {jobStatusCounts.failed ? ` · ${jobStatusCounts.failed} failed` : ''}
              {jobStatusCounts.running ? ` · ${jobStatusCounts.running} running` : ''}
            </span>
          </div>
          <div className="min-w-[180px]">
            <Select
              options={jobsFilterOptions}
              value={jobsFilter}
              onChange={(value) => {
                setJobsFilter(value)
                setJobsPage(1)
              }}
            />
          </div>
        </div>

        {pagedJobs.length === 0 ? (
          <div className="text-xs text-ink-400 border border-ink-100 rounded-lg px-3 py-6 text-center bg-ink-50">
            No jobs{jobsFilter !== 'all' ? ` with status “${jobsFilter}”` : ''}.
          </div>
        ) : (
          <div className="space-y-2">
            {pagedJobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center gap-3 text-xs border border-ink-100 rounded-lg px-3 py-2 bg-white hover:bg-ink-50"
              >
                <span className="font-mono">{job.job_type}</span>
                <StatusBadge status={job.status} />
                {job.error_msg && (
                  <span className="text-red-500 truncate" title={job.error_msg}>
                    {job.error_msg}
                  </span>
                )}
                <span className="text-ink-400 ml-auto">
                  {new Date(job.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}

        {jobsTotal > 0 && (
          <div className="flex items-center justify-between mt-3 text-xs text-ink-600 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span>
                Showing <strong>{(jobsPageSafe - 1) * jobsPageSize + 1}</strong>–
                <strong>{Math.min(jobsPageSafe * jobsPageSize, jobsTotal)}</strong> of{' '}
                <strong>{jobsTotal}</strong>
              </span>
              <div className="min-w-[120px]">
                <Select
                  options={jobsPageSizeOptions}
                  value={String(jobsPageSize)}
                  onChange={(value) => {
                    setJobsPageSize(Number(value))
                    setJobsPage(1)
                  }}
                />
              </div>
            </div>
            <Pagination
              page={jobsPageSafe}
              totalPages={jobsTotalPages}
              onChange={setJobsPage}
            />
          </div>
        )}
      </section>
    </div>
  )
}
