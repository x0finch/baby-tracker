import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { PageHeader } from '../components/PageHeader'
import { Button, type ButtonTone } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { Sheet } from '../components/ui/Sheet'
import { messages } from '../messages'

// Component preview for development; linked from settings in dev builds only.
export const Route = createFileRoute('/ui')({
  component: UiPreviewPage,
})

const categories: { tone: ButtonTone; label: string }[] = [
  { tone: 'feeding', label: messages.uiFeeding },
  { tone: 'sleep', label: messages.uiSleep },
  { tone: 'diaper', label: messages.uiDiaper },
]

function UiPreviewPage() {
  const [side, setSide] = useState<'left' | 'right'>('left')
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={messages.uiTitle} />

      <div className="flex flex-col gap-3">
        <h2 className="text-title font-extrabold">{messages.uiButtons}</h2>
        <Button size="lg" block>
          {messages.uiSave}
        </Button>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1">
            {messages.uiCancel}
          </Button>
          <Button tone="danger" className="flex-1">
            {messages.uiDelete}
          </Button>
        </div>
        <Button variant="ghost" tone="diaper">
          {messages.uiCancel}
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-title font-extrabold">{messages.uiCategories}</h2>
        <div className="grid grid-cols-3 gap-3">
          {categories.map((category) => (
            <Button key={category.tone} tone={category.tone} size="lg">
              {category.label}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {categories.map((category) => (
            <Button key={category.tone} tone={category.tone} variant="soft">
              {category.label}
            </Button>
          ))}
        </div>
      </div>

      <Card className="flex flex-col gap-4">
        <SegmentedControl
          label={messages.uiSide}
          options={[
            { value: 'left', label: messages.uiLeft },
            { value: 'right', label: messages.uiRight },
          ]}
          value={side}
          onChange={setSide}
        />
        <Input label={messages.uiNameLabel} hint={messages.uiNameHint} />
      </Card>

      <Button variant="soft" tone="diaper" onClick={() => setSheetOpen(true)}>
        {messages.uiOpenSheet}
      </Button>
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={messages.uiSheetTitle}>
        <Input label={messages.uiNameLabel} inputMode="numeric" />
        <Button size="lg" block onClick={() => setSheetOpen(false)}>
          {messages.uiSave}
        </Button>
      </Sheet>
    </section>
  )
}
