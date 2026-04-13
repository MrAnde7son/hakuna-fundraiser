import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createInvestor, importCSV } from '../api/investors'

export default function AddInvestorModal({ onClose }) {
  const qc = useQueryClient()
  const [tab, setTab] = useState('manual') // manual | csv
  const [form, setForm] = useState({ name: '', type: 'vc', website: '', contact: '', stage_focus: '', notes: '' })
  const [file, setFile] = useState(null)

  const createMut = useMutation({
    mutationFn: createInvestor,
    onSuccess: () => { qc.invalidateQueries(['investors']); onClose() },
  })

  const csvMut = useMutation({
    mutationFn: importCSV,
    onSuccess: (data) => {
      alert(`Imported ${data.created} investors, skipped ${data.skipped}`)
      qc.invalidateQueries(['investors'])
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Add Investors</h2>

        <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1">
          {['manual', 'csv'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${
                tab === t ? 'bg-white shadow font-medium' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'manual' ? 'Manual' : 'CSV Upload'}
            </button>
          ))}
        </div>

        {tab === 'manual' && (
          <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(form) }} className="space-y-3">
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Investor name *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="vc">VC</option>
              <option value="angel">Angel</option>
            </select>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Website URL (e.g. https://example.vc)"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Contact"
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
            />
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Stage focus (e.g. Seed, Series A)"
              value={form.stage_focus}
              onChange={(e) => setForm({ ...form, stage_focus: e.target.value })}
            />
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
            <button
              type="submit"
              disabled={createMut.isPending}
              className="w-full bg-hakuna-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-hakuna-700 disabled:opacity-50"
            >
              {createMut.isPending ? 'Adding...' : 'Add & Enrich'}
            </button>
          </form>
        )}

        {tab === 'csv' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              CSV format: name, type, contact, stage, notes, website
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files[0])}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <button
              onClick={() => file && csvMut.mutate(file)}
              disabled={!file || csvMut.isPending}
              className="w-full bg-hakuna-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-hakuna-700 disabled:opacity-50"
            >
              {csvMut.isPending ? 'Importing...' : 'Import CSV'}
            </button>
          </div>
        )}

        {(createMut.isError || csvMut.isError) && (
          <p className="text-red-600 text-sm mt-2">
            Error: {(createMut.error || csvMut.error)?.response?.data?.detail || 'Something went wrong'}
          </p>
        )}
      </div>
    </div>
  )
}
