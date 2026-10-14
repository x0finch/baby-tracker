import { type Quantity, type UnitPreferences, setUnits, unitLabel, useUnits } from '../lib/units'
import { m } from '../paraglide/messages.js'
import { Card } from './ui/Card'
import { SegmentedControl } from './ui/SegmentedControl'

const rows: { [Q in Quantity]: { label: () => string; options: UnitPreferences[Q][] } } = {
  volume: { label: m.unitsVolume, options: ['ml', 'oz'] },
  weight: { label: m.unitsWeight, options: ['kg', 'lb'] },
  length: { label: m.unitsLength, options: ['cm', 'in'] },
  temperature: { label: m.unitsTemperature, options: ['c', 'f'] },
}

const quantities = ['volume', 'weight', 'length', 'temperature'] as const

/** Display units for amounts, measurements and temperature; stored records never change. */
export function UnitsCard() {
  const units = useUnits()
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-title font-extrabold">{m.settingsUnits()}</h2>
      {quantities.map((quantity) => (
        <div key={quantity} className="flex flex-col gap-2">
          <span className="text-caption font-bold text-fg-muted">{rows[quantity].label()}</span>
          <SegmentedControl<string>
            label={rows[quantity].label()}
            options={rows[quantity].options.map((unit) => ({
              value: unit,
              label: unitLabel(quantity, { ...units, [quantity]: unit }),
            }))}
            value={units[quantity]}
            onChange={(unit) => setUnits({ ...units, [quantity]: unit })}
          />
        </div>
      ))}
      <p className="m-0 text-caption text-fg-muted">{m.settingsUnitsHint()}</p>
    </Card>
  )
}
