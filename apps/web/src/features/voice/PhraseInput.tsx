import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { FormError } from '../../components/ui/FormError'
import { Input } from '../../components/ui/Input'
import { m } from '../../paraglide/messages.js'
import { type VoiceSettings, voiceApi } from './api'
import { voiceKeys } from './queries'

/** What the user says to Siri; the shortcut must carry the same name. */
export function PhraseInput({ settings }: { settings: VoiceSettings }) {
  const queryClient = useQueryClient()
  const [phrase, setPhrase] = useState(settings.phrase)
  const save = useMutation({
    mutationFn: voiceApi.rename,
    onSuccess: (next) => queryClient.setQueryData(voiceKeys.settings, next),
    onError: () => setPhrase(settings.phrase),
  })
  return (
    <div className="flex flex-col gap-2">
      <Input
        label={m.voicePhraseLabel()}
        value={phrase}
        maxLength={20}
        onChange={(event) => setPhrase(event.target.value)}
        onBlur={() => {
          const next = phrase.trim()
          if (!next) setPhrase(settings.phrase)
          else if (next !== settings.phrase) save.mutate(next)
        }}
      />
      <p className="m-0 text-fg-muted">{m.voiceSay({ phrase: settings.phrase })}</p>
      {save.isError && <FormError>{m.actionFailed()}</FormError>}
    </div>
  )
}
