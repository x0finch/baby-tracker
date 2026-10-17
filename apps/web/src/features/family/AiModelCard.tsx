import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { FormError } from '../../components/ui/FormError'
import { Input } from '../../components/ui/Input'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { Sheet } from '../../components/ui/Sheet'
import { m } from '../../paraglide/messages.js'
import { type AiModel, type AiProvider, type FamilyAi, aiApi, aiKeys } from './ai'

const PROVIDER_LABEL: Record<AiProvider, string> = { openai: 'OpenAI', openrouter: 'OpenRouter' }

/** Shown to the family's owner and admins: the AI model their voice commands use. */
export function AiModelCard({ familyId }: { familyId: string }) {
  const { data: ai, isPending } = useQuery({
    queryKey: aiKeys.family(familyId),
    queryFn: () => aiApi.get(familyId),
  })
  const [open, setOpen] = useState(false)
  if (isPending) return null
  return (
    <Card as="section" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-body font-extrabold">{m.aiTitle()}</h2>
        <p className="m-0 text-caption text-fg-muted">
          {ai
            ? `${PROVIDER_LABEL[ai.provider]} · ${ai.model} · ${m.aiKeyHint({ hint: ai.keyHint })}`
            : m.aiNotSet()}
        </p>
      </div>
      <Button variant="outline" onClick={() => setOpen(true)}>
        {ai ? m.aiChange() : m.aiSetUp()}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={m.aiTitle()}>
        {open && <AiForm familyId={familyId} ai={ai ?? null} onDone={() => setOpen(false)} />}
      </Sheet>
    </Card>
  )
}

function AiForm({
  familyId,
  ai,
  onDone,
}: {
  familyId: string
  ai: FamilyAi | null
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const [provider, setProvider] = useState<AiProvider>(ai?.provider ?? 'openai')
  const [apiKey, setApiKey] = useState('')
  const [models, setModels] = useState<AiModel[] | null>(null)
  const [model, setModel] = useState(ai?.model ?? '')
  // The saved key only works for the provider it was saved with.
  const usesSavedKey = ai !== null && ai.provider === provider && apiKey.trim() === ''

  const check = useMutation({
    mutationFn: () => aiApi.models(familyId, provider, usesSavedKey ? null : apiKey.trim()),
    onSuccess: ({ models: found }) => {
      setModels(found)
      if (!found.some((item) => item.id === model)) {
        setModel(found.find((item) => item.recommended)?.id ?? found[0]?.id ?? '')
      }
    },
  })
  const save = useMutation({
    mutationFn: () =>
      aiApi.save(familyId, { provider, model, apiKey: usesSavedKey ? null : apiKey.trim() }),
    onSuccess: (saved) => {
      queryClient.setQueryData(aiKeys.family(familyId), saved)
      onDone()
    },
  })
  const remove = useMutation({
    mutationFn: () => aiApi.remove(familyId),
    onSuccess: () => {
      queryClient.setQueryData(aiKeys.family(familyId), null)
      onDone()
    },
  })
  const reset = () => {
    setModels(null)
    check.reset()
  }

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        label={m.aiProvider()}
        labelStyle="field"
        options={[
          { value: 'openai', label: PROVIDER_LABEL.openai },
          { value: 'openrouter', label: PROVIDER_LABEL.openrouter },
        ]}
        value={provider}
        onChange={(next) => {
          setProvider(next)
          reset()
        }}
      />
      <Input
        label={m.aiKeyLabel()}
        type="password"
        autoComplete="off"
        placeholder={
          ai && ai.provider === provider
            ? m.aiKeyKeep({ hint: ai.keyHint })
            : provider === 'openai'
              ? 'sk-…'
              : 'sk-or-…'
        }
        hint={m.aiKeyPrivacy()}
        value={apiKey}
        onChange={(event) => {
          setApiKey(event.target.value)
          reset()
        }}
      />
      {models === null ? (
        <Button
          size="lg"
          block
          disabled={check.isPending || (!usesSavedKey && apiKey.trim() === '')}
          onClick={() => check.mutate()}
        >
          {check.isPending ? m.aiChecking() : m.aiCheck()}
        </Button>
      ) : (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="font-bold">{m.aiModel()}</span>
            <select
              className="min-h-touch rounded-lg border-2 border-border bg-surface px-4 text-fg"
              value={model}
              onChange={(event) => setModel(event.target.value)}
            >
              {models.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.recommended ? m.aiRecommended({ model: item.id }) : item.id}
                </option>
              ))}
            </select>
          </label>
          <Button size="lg" block disabled={save.isPending || !model} onClick={() => save.mutate()}>
            {m.actionSave()}
          </Button>
        </>
      )}
      {check.isError && <FormError>{m.aiKeyInvalid()}</FormError>}
      {save.isError && <FormError>{m.actionFailed()}</FormError>}
      {ai && (
        <Button
          variant="ghost"
          tone="danger"
          disabled={remove.isPending}
          onClick={() => remove.mutate()}
        >
          {m.aiRemove()}
        </Button>
      )}
    </div>
  )
}
