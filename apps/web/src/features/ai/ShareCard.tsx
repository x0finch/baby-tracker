import { useMutation } from '@tanstack/react-query'

import { Card, CardTitle } from '../../components/ui/Card'
import { FormError } from '../../components/ui/FormError'
import { ToggleChip } from '../../components/ui/ToggleChip'
import { m } from '../../paraglide/messages.js'
import { useAccess } from '../../sync/use-access'
import { type UserAi, aiApi } from './api'
import { useSaved } from './use-saved'

/** Families the user shares their AI with: members without a key of their own use it there. */
export function ShareCard({ ai }: { ai: UserAi }) {
  const onSaved = useSaved()
  const { access = [] } = useAccess()
  const share = useMutation({ mutationFn: aiApi.share, onSuccess: onSaved })
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
      <CardTitle small>{m.aiShareTitle()}</CardTitle>
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
