import { ChipGroup } from '../../components/ui/ToggleChip'
import { m } from '../../paraglide/messages.js'

/** Quick choices for how long a bottle or solids feed took, in minutes. */
const FEED_DURATIONS = [5, 10, 15, 20, 30] as const

/** Optional duration chips; `null` means not recorded. */
export function FeedDurationField({
  value,
  onChange,
}: {
  value: number | null
  onChange: (minutes: number | null) => void
}) {
  // An edited record may carry a duration that isn't one of the quick choices.
  const choices: (number | null)[] = [null, ...FEED_DURATIONS]
  if (value !== null && !choices.includes(value)) choices.push(value)
  return (
    <ChipGroup<number | null>
      legend={m.feedDuration()}
      options={choices}
      value={value}
      onChange={onChange}
      optionLabel={(minutes) =>
        minutes === null ? m.feedDurationNone() : m.feedDurationMinutes({ minutes })
      }
      tone="feeding"
    />
  )
}
