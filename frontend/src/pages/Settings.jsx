import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, Button, ErrorBanner, Pill, Spinner, useToast } from '@hakunahq/ui'
import { fetchSettings, updateSettings } from '../api/settings'

export default function Settings() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  })

  const [drafts, setDrafts] = useState({})
  const [reveal, setReveal] = useState({})

  useEffect(() => { setDrafts({}) }, [data])

  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      setReveal({})
      toast.success('Settings saved')
    },
  })

  if (isLoading) {
    return (
      <div className="p-8 flex items-center gap-2 text-sm" style={{ color: 'var(--hk-text-secondary)' }}>
        <Spinner size={16} /> Loading settings…
      </div>
    )
  }

  const fields = data?.fields ?? []
  const dirty = Object.keys(drafts).length > 0
  const onChange = (key, value) => setDrafts((d) => ({ ...d, [key]: value }))
  const onSave = (e) => { e.preventDefault(); if (dirty) mutation.mutate(drafts) }
  const onClear = (key) => setDrafts((d) => ({ ...d, [key]: '' }))

  const inputStyle = (editing) => ({
    flex: 1,
    minWidth: 0,
    padding: '8px 10px',
    fontSize: 13,
    fontFamily: 'var(--hk-font-sans)',
    background: 'var(--hk-bg)',
    color: 'var(--hk-text)',
    border: `1px solid ${editing ? 'var(--hk-primary)' : 'var(--hk-border)'}`,
    borderRadius: 'var(--hk-radius-sm)',
    outline: 'none',
  })

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 md:p-8">
      <header className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--hk-text)' }}>
          Settings
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--hk-text-secondary)' }}>
          API keys and model configuration. Values are persisted to disk and override the
          environment defaults. Leave blank and save to clear an override.
        </p>
      </header>

      <Card>
        <form onSubmit={onSave} className="space-y-5 p-4 sm:p-6">
          {fields.map((field) => {
            const draft = drafts[field.key]
            const editing = draft !== undefined
            const showReveal = reveal[field.key]
            return (
              <div key={field.key} className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 sm:items-start">
                <label
                  htmlFor={field.key}
                  className="text-sm font-medium sm:pt-2 flex items-center gap-2 flex-wrap"
                  style={{ color: 'var(--hk-text)' }}
                >
                  {field.label}
                  {field.overridden && <Pill label="overridden" color="var(--hk-info)" />}
                </label>
                <div className="sm:col-span-2 space-y-1">
                  <div className="flex gap-2 flex-wrap sm:flex-nowrap items-center">
                    <input
                      id={field.key}
                      type={field.secret && !showReveal ? 'password' : 'text'}
                      value={editing ? draft : ''}
                      placeholder={field.is_set ? `Current: ${field.preview}` : 'Not set'}
                      onChange={(e) => onChange(field.key, e.target.value)}
                      style={inputStyle(editing)}
                    />
                    {field.secret && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setReveal((r) => ({ ...r, [field.key]: !r[field.key] }))}
                      >
                        {showReveal ? 'Hide' : 'Show'}
                      </Button>
                    )}
                    {field.is_set && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onClear(field.key)}
                        style={{ color: 'var(--hk-danger)' }}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          <div
            className="flex items-center gap-3 pt-4 flex-wrap"
            style={{ borderTop: '1px solid var(--hk-border)' }}
          >
            <Button type="submit" variant="primary" disabled={!dirty} loading={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
            {dirty && (
              <Button type="button" variant="ghost" onClick={() => setDrafts({})}>
                Discard
              </Button>
            )}
            {mutation.isError && <ErrorBanner error={mutation.error} />}
          </div>
        </form>
      </Card>
    </div>
  )
}
