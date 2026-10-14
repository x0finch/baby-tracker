import { Link, createFileRoute } from '@tanstack/react-router'

import { Card } from '../components/ui/Card'
import { FamilyDetail } from '../features/family/FamilyDetail'
import { m } from '../paraglide/messages.js'
import { useAccess } from '../sync/use-access'

export const Route = createFileRoute('/family/$familyId')({
  component: FamilyPage,
})

function FamilyPage() {
  const { familyId } = Route.useParams()
  const { access, userId } = useAccess()
  const family = access?.find((item) => item.id === familyId)

  return (
    <section className="flex flex-col gap-4">
      <Link
        to="/settings"
        className="flex min-h-touch items-center gap-1 self-start font-bold text-fg-muted"
      >
        <svg aria-hidden viewBox="0 0 24 24" className="size-5">
          <path
            d="M15 5l-7 7 7 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {m.familyBack()}
      </Link>
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
