import { localDateString } from '@bobo/shared'

import { Card } from '../../components/ui/Card'
import { useLocalStore } from '../../db'
import { m } from '../../paraglide/messages.js'
import { createBaby } from './actions'
import { BabyForm } from './BabyForm'

/** First-run flow: shown instead of a page's content until a baby exists. */
export function BabyOnboarding() {
  const store = useLocalStore()

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-display font-extrabold">{m.onboardingTitle()}</h1>
      <p className="text-fg-muted">{m.onboardingBody()}</p>
      <Card>
        <BabyForm
          initial={{
            name: '',
            birthDate: localDateString(),
            sex: 'unspecified',
            avatarColor: 'green',
          }}
          submitLabel={m.onboardingSubmit()}
          onSubmit={(input) => createBaby(store, input)}
        />
      </Card>
    </section>
  )
}
