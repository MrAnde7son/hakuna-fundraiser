import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchSettings, updateSettings } from '../api/settings'
import clsx from 'clsx'

export default function Settings() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  })

  const [drafts, setDrafts] = useState({})
  const [reveal, setReveal] = useState({})
  const [savedAt, setSavedAt] = useState(null)

  useEffect(() => {
    setDrafts({})
  }, [data])

  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      setSavedAt(new Date())
      setReveal({})
    },
  })

  if (isLoading) {
    return <div className="p-8 text-sm text-hakuna-500">Loading settings…</div>
  }

  const fields = data?.fields ?? []

  const onChange = (key, value) => {
    setDrafts((d) => ({ ...d, [key]: value }))
  }

  const dirty = Object.keys(drafts).length > 0

  const onSave = (e) => {
    e.preventDefault()
    if (!dirty) return
    mutation.mutate(drafts)
  }

  const onClear = (key) => {
    setDrafts((d) => ({ ...d, [key]: '' }))
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-hakuna-900">Settings</h1>
        <p className="text-sm text-hakuna-500 mt-1">
          API keys and model configuration. Values are persisted to disk and override the
          environment defaults. Leave blank and save to clear an override.
        </p>
      </header>

      <form onSubmit={onSave} className="space-y-5 bg-white border border-hakuna-200 rounded-lg p-6">
        {fields.map((field) => {
          const draft = drafts[field.key]
          const editing = draft !== undefined
          const showReveal = reveal[field.key]
          return (
            <div key={field.key} className="grid grid-cols-3 gap-4 items-start">
              <label htmlFor={field.key} className="text-sm font-medium text-hakuna-800 pt-2">
                {field.label}
                {field.overridden && (
                  <span className="ml-2 text-[10px] uppercase tracking-wide text-blue-600">
                    overridden
                  </span>
                )}
              </label>
              <div className="col-span-2 space-y-1">
                <div className="flex gap-2">
                  <input
                    id={field.key}
                    type={field.secret && !showReveal ? 'password' : 'text'}
                    value={editing ? draft : ''}
                    placeholder={
                      field.is_set ? `Current: ${field.preview}` : 'Not set'
                    }
                    onChange={(e) => onChange(field.key, e.target.value)}
                    className={clsx(
                      'flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-hakuna-500',
                      editing ? 'border-hakuna-500' : 'border-hakuna-300'
                    )}
                  />
                  {field.secret && (
                    <button
                      type="button"
                      onClick={() => setReveal((r) => ({ ...r, [field.key]: !r[field.key] }))}
                      className="text-xs text-hakuna-500 hover:text-hakuna-800 px-2"
                    >
                      {showReveal ? 'Hide' : 'Show'}
                    </button>
                  )}
                  {field.is_set && (
                    <button
                      type="button"
                      onClick={() => onClear(field.key)}
                      className="text-xs text-red-600 hover:text-red-800 px-2"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        <div className="flex items-center gap-3 pt-2 border-t border-hakuna-200">
          <button
            type="submit"
            disabled={!dirty || mutation.isPending}
            className={clsx(
              'px-4 py-2 rounded-md text-sm font-medium',
              dirty && !mutation.isPending
                ? 'bg-hakuna-900 text-white hover:bg-hakuna-800'
                : 'bg-hakuna-200 text-hakuna-500 cursor-not-allowed'
            )}
          >
            {mutation.isPending ? 'Saving…' : 'Save changes'}
          </button>
          {dirty && (
            <button
              type="button"
              onClick={() => setDrafts({})}
              className="text-sm text-hakuna-600 hover:text-hakuna-900"
            >
              Discard
            </button>
          )}
          {mutation.isError && (
            <span className="text-sm text-red-600">
              {mutation.error?.response?.data?.detail || 'Save failed'}
            </span>
          )}
          {savedAt && !dirty && !mutation.isPending && (
            <span className="text-sm text-green-700">
              Saved at {savedAt.toLocaleTimeString()}
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
