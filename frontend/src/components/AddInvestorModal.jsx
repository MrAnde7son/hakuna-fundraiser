import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal, Tabs, Input, Select, Button, ErrorBanner, useToast } from '@hakunahq/ui'
import { createInvestor, importCSV } from '../api/investors'

export default function AddInvestorModal({ open, onClose }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [tab, setTab] = useState('manual')
  const [form, setForm] = useState({
    name: '', type: 'vc', website: '', contact: '', stage_focus: '', notes: '',
  })
  const [file, setFile] = useState(null)

  const createMut = useMutation({
    mutationFn: createInvestor,
    onSuccess: () => {
      qc.invalidateQueries(['investors'])
      toast.success('Investor added')
      onClose()
    },
  })

  const csvMut = useMutation({
    mutationFn: importCSV,
    onSuccess: (data) => {
      toast.success(`Imported ${data.created} investors, skipped ${data.skipped}`)
      qc.invalidateQueries(['investors'])
      onClose()
    },
  })

  const submitManual = (e) => {
    e.preventDefault()
    createMut.mutate(form)
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Investors" size="md">
      <div className="space-y-4">
        <Tabs
          variant="pill"
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'manual', label: 'Manual' },
            { key: 'csv', label: 'CSV Upload' },
          ]}
        />

        {tab === 'manual' && (
          <form onSubmit={submitManual} className="space-y-3">
            <Input
              label="Investor name"
              placeholder="Acme Ventures"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              required
            />
            <Select
              label="Type"
              value={form.type}
              onChange={(v) => setForm({ ...form, type: v })}
              options={[
                { value: 'vc', label: 'VC' },
                { value: 'angel', label: 'Angel' },
              ]}
            />
            <Input
              label="Website"
              placeholder="https://example.vc"
              value={form.website}
              onChange={(v) => setForm({ ...form, website: v })}
            />
            <Input
              label="Contact"
              value={form.contact}
              onChange={(v) => setForm({ ...form, contact: v })}
            />
            <Input
              label="Stage focus"
              placeholder="Seed, Series A"
              value={form.stage_focus}
              onChange={(v) => setForm({ ...form, stage_focus: v })}
            />
            <label className="block">
              <span className="block text-xs font-medium mb-1" style={{ color: 'var(--hk-text-secondary)' }}>
                Notes
              </span>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  fontSize: 13,
                  fontFamily: 'var(--hk-font-sans)',
                  background: 'var(--hk-bg)',
                  color: 'var(--hk-text)',
                  border: '1px solid var(--hk-border)',
                  borderRadius: 'var(--hk-radius-sm)',
                  resize: 'vertical',
                }}
              />
            </label>
            <Button
              type="submit"
              variant="primary"
              loading={createMut.isPending}
              style={{ width: '100%' }}
            >
              {createMut.isPending ? 'Adding…' : 'Add & Enrich'}
            </Button>
          </form>
        )}

        {tab === 'csv' && (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: 'var(--hk-text-secondary)' }}>
              CSV format: name, type, contact, stage, notes, website
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files[0])}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: 13,
                background: 'var(--hk-bg)',
                color: 'var(--hk-text)',
                border: '1px solid var(--hk-border)',
                borderRadius: 'var(--hk-radius-sm)',
              }}
            />
            <Button
              variant="primary"
              disabled={!file}
              loading={csvMut.isPending}
              onClick={() => file && csvMut.mutate(file)}
              style={{ width: '100%' }}
            >
              {csvMut.isPending ? 'Importing…' : 'Import CSV'}
            </Button>
          </div>
        )}

        {(createMut.isError || csvMut.isError) && (
          <ErrorBanner error={createMut.error || csvMut.error} />
        )}
      </div>
    </Modal>
  )
}
