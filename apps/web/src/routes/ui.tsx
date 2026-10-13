import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { PageHeader } from '../components/PageHeader'
import { Button, type ButtonTone } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { Sheet } from '../components/ui/Sheet'
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
