import { useMutation } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { useState } from 'react'

import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Chevron } from '../../components/ui/Chevron'
import { FormError } from '../../components/ui/FormError'
import { Input } from '../../components/ui/Input'
import { Pill } from '../../components/ui/Pill'
import { Sheet } from '../../components/ui/Sheet'
import { m } from '../../paraglide/messages.js'
import {
  type AiModel,
  type AiProvider,
  type ModelTag,
  PROVIDER_LABEL,
  type ProviderModels,
  type UserAi,
  aiApi,
} from './api'
import { useSaved } from './use-saved'

/** The model in use; tapping opens the picker. */
export function ModelCard({
  ai,
  providers,
  loading,
}: {
  ai: UserAi
  providers?: ProviderModels[]
  loading: boolean
}) {
  const [open, setOpen] = useState(false)
  const { choice } = ai
  if (ai.keys.length === 0) {
    return (
      <Card as="section" className="flex flex-col gap-1">
        <h2 className="m-0 text-body font-extrabold">{m.aiModelTitle()}</h2>
        <p className="m-0 text-caption text-fg-muted">{m.aiModelNeedsKey()}</p>
      </Card>
    )
  }
  return (
    <Card as="section" className="flex flex-col gap-1">
      <h2 className="m-0 text-body font-extrabold">{m.aiModelTitle()}</h2>
      <button
        type="button"
        className="press-row flex min-h-touch items-center gap-3 py-2 text-left"
        onClick={() => setOpen(true)}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={clsx('truncate font-extrabold', !choice && 'text-fg-muted')}>
            {choice ? choice.model : m.aiModelNone()}
          </span>
          {choice && (
            <span className="text-caption text-fg-muted">{PROVIDER_LABEL[choice.provider]}</span>
          )}
        </span>
        <Chevron />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={m.aiModelPick()}>
        {open && (
          <ModelPicker
            choice={choice}
            providers={providers ?? []}
            loading={loading}
            onDone={() => setOpen(false)}
          />
        )}
      </Sheet>
    </Card>
  )
}

interface Listed extends AiModel {
  provider: AiProvider
}

/** Who makes a model: OpenRouter ids start with it; OpenAI's are all OpenAI's. */
const vendorOf = (model: Listed): string =>
  model.provider === 'openai' ? 'openai' : (model.id.split('/')[0] ?? '')

// The monthly estimate on recommended models: 20 commands a day, each about 10,000 tokens in
// (instructions, tools and the conversation, over one to three calls) and 300 out.
const MONTHLY_MILLIONS = { input: 6, output: 0.18 }
const CNY_PER_USD = 7.2

function monthly(price: NonNullable<AiModel['price']>) {
  const usd = price.input * MONTHLY_MILLIONS.input + price.output * MONTHLY_MILLIONS.output
  const cny = usd * CNY_PER_USD
  return cny < 1 ? m.aiMonthlyUnder() : m.aiMonthly({ amount: Math.round(cny) })
}

const TAG_LABEL: Record<ModelTag, () => string> = {
  steady: m.aiTagSteady,
  cheapest: m.aiTagCheapest,
  balanced: m.aiTagBalanced,
}

function ModelPicker({
  choice,
  providers,
  loading,
  onDone,
}: {
  choice: UserAi['choice']
  providers: ProviderModels[]
  loading: boolean
  onDone: () => void
}) {
  const onSaved = useSaved()
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const pick = useMutation({
    mutationFn: aiApi.choose,
    onSuccess: (saved) => {
      onSaved(saved)
      onDone()
    },
  })

  const all: Listed[] = providers.flatMap((entry) =>
    entry.status === 'ok'
      ? entry.models.map((model) => ({ ...model, provider: entry.provider }))
      : [],
  )
  const broken = providers.filter((entry) => entry.status !== 'ok')
  const bothKeys = providers.length > 1
  const search = query.trim().toLowerCase()
  // Searching looks through every model; otherwise only everyday ones unless asked.
  const shown = search
    ? all.filter((model) => model.id.toLowerCase().includes(search))
    : all.filter((model) => showAll || model.everyday)
  const recommended = search ? [] : shown.filter((model) => model.tag)
  // The rest by provider, and on OpenRouter by who makes the model.
  const groups = new Map<string, { title: string; models: Listed[] }>()
  for (const model of shown) {
    if (recommended.includes(model)) continue
    const vendor = vendorOf(model)
    const key = `${model.provider}:${vendor}`
    const title =
      model.provider === 'openai'
        ? PROVIDER_LABEL.openai
        : bothKeys
          ? `${PROVIDER_LABEL.openrouter} · ${vendor}`
          : vendor
    const group = groups.get(key) ?? { title, models: [] as Listed[] }
    group.models.push(model)
    groups.set(key, group)
  }
  const hidden = all.filter((model) => !model.everyday).length

  const row = (model: Listed, inGroup = false) => (
    <ModelRow
      key={`${model.provider}:${model.id}`}
      model={model}
      // In a group the heading says the provider and maker.
      label={inGroup ? model.id.replace(`${vendorOf(model)}/`, '') : model.id}
      showProvider={bothKeys && !inGroup}
      selected={choice?.provider === model.provider && choice.model === model.id}
      disabled={pick.isPending}
      onPick={() => pick.mutate({ provider: model.provider, model: model.id })}
    />
  )

  return (
    <div className="flex flex-col gap-4">
      <Input
        label={m.aiModelSearch()}
        type="search"
        placeholder={m.aiModelSearchHint()}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {broken.map((entry) => (
        <p key={entry.provider} className="m-0 text-caption font-bold text-danger-text">
          {m.aiModelsMissing({ provider: PROVIDER_LABEL[entry.provider] })}
        </p>
      ))}
      {pick.isError && <FormError>{m.actionFailed()}</FormError>}
      {loading ? (
        <p className="m-0 text-fg-muted">{m.aiModelsLoading()}</p>
      ) : (
        <>
          {recommended.length > 0 && (
            <ModelGroup title={m.aiModelRecommended()}>
              {recommended.map((model) => row(model))}
            </ModelGroup>
          )}
          {[...groups].map(([key, group]) => (
            <ModelGroup key={key} title={group.title}>
              {group.models.map((model) => row(model, true))}
            </ModelGroup>
          ))}
          {shown.length === 0 && <p className="m-0 text-fg-muted">{m.aiModelsNone()}</p>}
          {!search && hidden > 0 && (
            <Button variant="ghost" onClick={() => setShowAll(!showAll)}>
              {showAll ? m.aiModelsEveryday() : m.aiModelsShowAll({ count: hidden })}
            </Button>
          )}
          <p className="m-0 text-caption text-fg-muted">{m.aiModelPriceNote()}</p>
        </>
      )}
    </div>
  )
}

function ModelGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col">
      <h3 className="m-0 pb-1 text-caption font-bold text-fg-muted">{title}</h3>
      <ul className="m-0 flex list-none flex-col p-0">{children}</ul>
    </section>
  )
}

function ModelRow({
  model,
  label,
  showProvider,
  selected,
  disabled,
  onPick,
}: {
  model: Listed
  label: string
  showProvider: boolean
  selected: boolean
  disabled: boolean
  onPick: () => void
}) {
  const { price, tag } = model
  return (
    <li className="border-b-2 border-border last:border-b-0">
      <button
        type="button"
        aria-pressed={selected}
        disabled={disabled}
        className="press-row flex min-h-touch w-full items-center gap-3 py-2 text-left"
        onClick={onPick}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-2">
            <span className="truncate font-extrabold">{label}</span>
            {showProvider && <Pill>{PROVIDER_LABEL[model.provider]}</Pill>}
          </span>
          {(tag || price) && (
            <span className="text-caption text-fg-muted">
              {[
                tag && TAG_LABEL[tag](),
                price &&
                  (price.input === 0 && price.output === 0
                    ? m.aiFree()
                    : m.aiPrice({
                        input: formatUsd(price.input),
                        output: formatUsd(price.output),
                      })),
                tag && price && monthly(price),
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
        </span>
        {selected && <Tick />}
      </button>
    </li>
  )
}

/** "$0.04", "$4.5": enough digits to tell cheap models apart. */
const formatUsd = (value: number) => `$${Number(value.toPrecision(2))}`

function Tick() {
  return (
    <svg viewBox="0 0 24 24" className="size-6 shrink-0 text-primary-text" fill="none" aria-hidden>
      <path
        d="m5.5 12.5 4.5 4.5 8.5-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
