import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'

import { Card, CardTitle } from '../../components/ui/Card'
import { FormError } from '../../components/ui/FormError'
import { m } from '../../paraglide/messages.js'
import { voiceKeys } from '../voice/queries'
import { PROVIDER_LABEL, aiApi } from './api'
import { aiKeys, aiQueries } from './queries'

/**
 * On the family page: whose shared AI members without a key of their own use here. Owners
 * and admins pick one when several members share.
 */
export function FamilyAiCard({ familyId, managing }: { familyId: string; managing: boolean }) {
  const queryClient = useQueryClient()
  const { data } = useQuery(aiQueries.family(familyId))
  const choose = useMutation({
    mutationFn: (userId: string) => aiApi.chooseForFamily(familyId, userId),
    onSuccess: (next) => {
      queryClient.setQueryData(aiKeys.family(familyId), next)
      void queryClient.invalidateQueries({ queryKey: voiceKeys.settings })
    },
  })
  if (!data) return null
  const inUse = data.shares.find((share) => share.userId === data.inUse)
  return (
    <Card as="section" className="flex flex-col gap-3">
      <CardTitle small>{m.aiTitle()}</CardTitle>
      {inUse ? (
        <p className="m-0">
          {m.familyAiInUse({ name: inUse.name })}
          <span className="block text-caption text-fg-muted">
            {`${PROVIDER_LABEL[inUse.provider]} · ${inUse.model}`}
          </span>
        </p>
      ) : (
        <p className="m-0 text-fg-muted">{m.familyAiNone()}</p>
      )}
      {managing && data.shares.length > 1 && (
        <label className="flex flex-col gap-1.5">
          <span className="font-bold">{m.familyAiChoose()}</span>
          <select
            className="min-h-touch rounded-lg border-2 border-border bg-surface px-4 text-fg"
            value={data.inUse ?? ''}
            disabled={choose.isPending}
            onChange={(event) => choose.mutate(event.target.value)}
          >
            {data.shares.map((share) => (
              <option key={share.userId} value={share.userId}>
                {`${share.name} · ${share.model}`}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="m-0 text-caption text-fg-muted">
        {m.familyAiHint()}{' '}
        <Link to="/settings/ai" className="font-bold text-primary-text underline">
          {m.aiMineTitle()}
        </Link>
      </p>
      {choose.isError && <FormError>{m.actionFailed()}</FormError>}
    </Card>
  )
}
