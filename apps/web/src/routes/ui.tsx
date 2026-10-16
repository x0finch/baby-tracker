import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { PageHeader } from '../components/PageHeader'
import { SettingsGroup, SettingsRow } from '../components/SettingsLayout'
import { Button, type ButtonTone } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Chevron } from '../components/ui/Chevron'
import { DeleteConfirmSheet } from '../components/ui/DeleteConfirmSheet'
import { Input } from '../components/ui/Input'
import { Pill } from '../components/ui/Pill'
import { RollingText } from '../components/ui/RollingText'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { Sheet } from '../components/ui/Sheet'
import { showToast } from '../components/ui/Toast'
import { m } from '../paraglide/messages.js'

// Component preview for development; linked from settings in dev builds only.
export const Route = createFileRoute('/ui')({
  component: UiPreviewPage,
})

const categories: { tone: ButtonTone; label: () => string }[] = [
  { tone: 'feeding', label: m.uiFeeding },
  { tone: 'sleep', label: m.uiSleep },
  { tone: 'diaper', label: m.uiDiaper },
]

function UiPreviewPage() {
  const [side, setSide] = useState<'left' | 'right'>('left')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [count, setCount] = useState(1)

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={m.uiTitle()} />

      <div className="flex flex-col gap-3">
        <h2 className="text-title font-extrabold">{m.uiButtons()}</h2>
        <Button size="lg" block>
          {m.uiSave()}
        </Button>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1">
            {m.uiCancel()}
          </Button>
          <Button tone="danger" className="flex-1">
            {m.uiDelete()}
          </Button>
        </div>
        <Button variant="ghost" tone="diaper">
          {m.uiCancel()}
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-title font-extrabold">{m.uiCategories()}</h2>
        <div className="grid grid-cols-3 gap-3">
          {categories.map((category) => (
            <Button key={category.tone} tone={category.tone} size="lg">
              {category.label()}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {categories.map((category) => (
            <Button key={category.tone} tone={category.tone} variant="soft">
              {category.label()}
            </Button>
          ))}
        </div>
      </div>

      <Card className="flex flex-col gap-4">
        <SegmentedControl
          label={m.uiSide()}
          options={[
            { value: 'left', label: m.uiLeft() },
            { value: 'right', label: m.uiRight() },
          ]}
          value={side}
          onChange={setSide}
        />
        <Input label={m.uiNameLabel()} hint={m.uiNameHint()} />
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="text-title font-extrabold">{m.uiPills()}</h2>
        <div className="flex items-center gap-3">
          <Pill>{m.uiPillRole()}</Pill>
          <Pill tone="danger">{m.uiPillRunning()}</Pill>
          <Chevron direction="left" />
          <Chevron />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-title font-extrabold">{m.uiSettingsList()}</h2>
        <SettingsGroup>
          <SettingsRow link={{ to: '/ui' }} title={m.uiSave()} summary={m.uiRowSummary()} />
          <SettingsRow
            link={{ to: '/ui' }}
            title={m.uiNameLabel()}
            badge={<Pill className="shrink-0">{m.uiPillRole()}</Pill>}
            summary={m.uiRowSummary()}
          />
        </SettingsGroup>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-title font-extrabold">{m.uiToasts()}</h2>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={() => showToast(m.uiToastMessage())}>
            {m.uiToastNeutral()}
          </Button>
          <Button
            variant="outline"
            onClick={() => showToast(m.uiToastMessage(), { tone: 'success' })}
          >
            {m.uiToastSuccess()}
          </Button>
          <Button
            variant="outline"
            onClick={() => showToast(m.uiToastMessage(), { tone: 'error' })}
          >
            {m.uiToastError()}
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              showToast(m.uiToastMessage(), {
                action: { label: m.uiSave(), onClick: () => undefined },
              })
            }
          >
            {m.uiToastAction()}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-title font-extrabold">{m.uiRolling()}</h2>
        <div className="flex items-center gap-3">
          <span className="text-display font-extrabold">
            <RollingText>{String(count)}</RollingText>
          </span>
          <Button variant="soft" onClick={() => setCount((value) => value + 1)}>
            {m.uiRollingNext()}
          </Button>
        </div>
      </div>

      <Button variant="soft" tone="danger" onClick={() => setDeleteOpen(true)}>
        {m.uiDeleteConfirm()}
      </Button>
      <DeleteConfirmSheet
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={m.uiDeleteConfirm()}
        emptyMessage={m.uiDeleteItem()}
        consequences={{
          lead: m.uiDeleteLead(),
          items: [m.uiDeleteItem()],
          name: m.uiDeleteName(),
          typeLabel: m.uiDeleteType(),
        }}
        onConfirm={() => setDeleteOpen(false)}
      />

      <Button variant="soft" tone="diaper" onClick={() => setSheetOpen(true)}>
        {m.uiOpenSheet()}
      </Button>
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={m.uiSheetTitle()}>
        <Input label={m.uiNameLabel()} inputMode="numeric" />
        <Button size="lg" block onClick={() => setSheetOpen(false)}>
          {m.uiSave()}
        </Button>
      </Sheet>
    </section>
  )
}
