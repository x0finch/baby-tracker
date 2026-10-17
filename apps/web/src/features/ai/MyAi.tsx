import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { FormError } from '../../components/ui/FormError'
import { Input } from '../../components/ui/Input'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { Sheet } from '../../components/ui/Sheet'
import { ToggleChip } from '../../components/ui/ToggleChip'
import { m } from '../../paraglide/messages.js'
import { useAccess } from '../../sync/use-access'
import { voiceKeys } from '../voice/api'
import { type AiModel, type AiProvider, PROVIDER_LABEL, type UserAi, aiApi, aiKeys } from './api'

/** What shows which AI is used: the families' and Siri's settings. */
const refreshUsers = (queryClient: QueryClient) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: ['family-ai'] }),
    queryClient.invalidateQueries({ queryKey: voiceKeys.settings }),
  ])

/** The settings row's status: the model in use, if the user set one. */
export function useAiSummary() {
  const { userId } = useAccess()
  const { data } = useQuery({ queryKey: aiKeys.mine, queryFn: aiApi.get, enabled: Boolean(userId) })
  if (!userId) return m.settingsNeedsSignIn()
  return data ? data.model : m.aiSummaryOff()
}

/** The user's own AI: what voice commands use in every family, and who it is shared with. */
export function MyAi() {
  const { userId } = useAccess()
  if (!userId) {
    return (
      <Card>
        <p className="m-0 text-fg-muted">{m.aiSignedOut()}</p>
      </Card>
    )
  }
  return <MyAiCards />
}

function MyAiCards() {
  const { data: ai, isPending, isError } = useQuery({ queryKey: aiKeys.mine, queryFn: aiApi.get })
  const [open, setOpen] = useState(false)
  if (isPending || isError) {
    return (
      <Card>
        <p className="m-0 text-fg-muted">{isError ? m.voiceLoadFailed() : m.joinLoading()}</p>
      </Card>
    )
  }
  return (
    <>
      <Card as="section" className="flex flex-col gap-3">
        <p className="m-0">{m.aiIntro()}</p>
        <p className="m-0 text-caption text-fg-muted">
          {ai
            ? `${PROVIDER_LABEL[ai.provider]} · ${ai.model} · ${m.aiKeyHint({ hint: ai.keyHint })}`
            : m.aiNotSet()}
        </p>
        <Button variant={ai ? 'outline' : 'solid'} onClick={() => setOpen(true)}>
          {ai ? m.aiChange() : m.aiSetUp()}
        </Button>
        <Sheet open={open} onClose={() => setOpen(false)} title={m.aiTitle()}>
          {open && <AiForm ai={ai} onDone={() => setOpen(false)} />}
        </Sheet>
      </Card>
      {ai && <ShareCard ai={ai} />}
    </>
  )
}

/** Families the user shares their AI with: members without a key of their own use it there. */
function ShareCard({ ai }: { ai: UserAi }) {
  const queryClient = useQueryClient()
  const { access = [] } = useAccess()
  const share = useMutation({
    mutationFn: aiApi.share,
    onSuccess: (next) => {
      queryClient.setQueryData(aiKeys.mine, next)
      void refreshUsers(queryClient)
    },
  })
  if (access.length === 0) return null
  const shared = new Set(ai.sharedFamilyIds)
  const toggle = (familyId: string) => {
    const next = new Set(shared)
    if (next.has(familyId)) next.delete(familyId)
    else next.add(familyId)
    share.mutate([...next])
  }
  return (
    <Card as="section" className="flex flex-col gap-3">
      <h2 className="m-0 text-body font-extrabold">{m.aiShareTitle()}</h2>
      <div className="flex flex-wrap gap-2">
        {access.map((family) => (
          <ToggleChip
            key={family.id}
            className="min-h-touch rounded-lg px-4 font-bold"
            pressed={shared.has(family.id)}
            disabled={share.isPending}
            onClick={() => toggle(family.id)}
          >
            {family.alias ?? family.name}
          </ToggleChip>
        ))}
      </div>
      <p className="m-0 text-caption text-fg-muted">{m.aiShareHint()}</p>
      {share.isError && <FormError>{m.actionFailed()}</FormError>}
    </Card>
  )
}

function AiForm({ ai, onDone }: { ai: UserAi | null; onDone: () => void }) {
  const queryClient = useQueryClient()
  const [provider, setProvider] = useState<AiProvider>(ai?.provider ?? 'openai')
  const [apiKey, setApiKey] = useState('')
  const [models, setModels] = useState<AiModel[] | null>(null)
  const [model, setModel] = useState(ai?.model ?? '')
  // The saved key only works for the provider it was saved with.
  const usesSavedKey = ai !== null && ai.provider === provider && apiKey.trim() === ''

  const check = useMutation({
    mutationFn: () => aiApi.models(provider, usesSavedKey ? null : apiKey.trim()),
    onSuccess: ({ models: found }) => {
      setModels(found)
      if (!found.some((item) => item.id === model)) {
        setModel(found.find((item) => item.recommended)?.id ?? found[0]?.id ?? '')
      }
    },
  })
  const save = useMutation({
    mutationFn: () => aiApi.save({ provider, model, apiKey: usesSavedKey ? null : apiKey.trim() }),
    onSuccess: (saved) => {
      queryClient.setQueryData(aiKeys.mine, saved)
      void refreshUsers(queryClient)
      onDone()
    },
  })
  const remove = useMutation({
    mutationFn: aiApi.remove,
    onSuccess: () => {
      queryClient.setQueryData(aiKeys.mine, null)
      void refreshUsers(queryClient)
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
