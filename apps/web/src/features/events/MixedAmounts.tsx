import { Input } from '../../components/ui/Input'
import { formatNumber } from '../../lib/i18n'
import { m } from '../../paraglide/messages.js'
import { mixedTotal } from './bottle-input'

/** Breast milk and formula amounts of a mixed bottle, with their total. */
export function MixedAmounts({
  breast,
  formula,
  error,
  onBreast,
  onFormula,
}: {
  breast: string
  formula: string
  error?: string
  onBreast: (value: string) => void
  onFormula: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3">
        <Input
          label={m.mixedBreastMl()}
          type="number"
          inputMode="numeric"
          min={0}
          max={1000}
          value={breast}
          onChange={(event) => onBreast(event.target.value)}
        />
        <Input
          label={m.mixedFormulaMl()}
          type="number"
          inputMode="numeric"
          min={0}
          max={1000}
          value={formula}
          onChange={(event) => onFormula(event.target.value)}
        />
      </div>
      <p className="m-0 font-bold tabular-nums">
        {m.mixedTotal({ amount: formatNumber(mixedTotal({ breast, formula })) })}
      </p>
      {error && <p className="m-0 text-caption font-bold text-danger-text">{error}</p>}
    </div>
  )
}
