import { createFileRoute } from '@tanstack/react-router'

import { BackLink } from '../components/SettingsLayout'
import { Card } from '../components/ui/Card'
import { FamilyDetail } from '../features/family/FamilyDetail'
import { m } from '../paraglide/messages.js'
import { useAccess } from '../sync/use-access'

export const Route = createFileRoute('/settings/family/$familyId')({
  component: FamilyPage,
})

function FamilyPage() {
  const { familyId } = Route.useParams()
  const { access, userId } = useAccess()
  const family = access?.find((item) => item.id === familyId)

  return (
    <section className="flex flex-col gap-4">
      <BackLink />
      {family && userId ? (
        <FamilyDetail key={family.id} family={family} userId={userId} />
      ) : (
        <Card>
          <p className="text-fg-muted">{m.familyNotFound()}</p>
        </Card>
      )}
    </section>
  )
}
