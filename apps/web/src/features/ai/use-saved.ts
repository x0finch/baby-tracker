import { type QueryClient, useQueryClient } from '@tanstack/react-query'

import { useOptimisticMutation } from '../../lib/optimistic'
import { voiceKeys } from '../voice/queries'
import { type UserAi } from './api'
import { aiKeys } from './queries'

/** What shows which AI is used: the families' and Siri's settings. */
export const refreshUsers = (queryClient: QueryClient) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: aiKeys.families }),
    queryClient.invalidateQueries({ queryKey: voiceKeys.settings }),
  ])

/**
 * A change to the user's AI settings, shown at once (lib/optimistic.ts); once saved, the
 * families' and Siri's settings refresh too.
 */
export function useAiChange<TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<UserAi>,
  apply: (ai: UserAi, variables: TVariables) => UserAi,
  onSaved?: () => void,
) {
  const queryClient = useQueryClient()
  return useOptimisticMutation({
    queryKey: aiKeys.mine,
    mutationFn,
    apply,
    onSaved: () => {
      void refreshUsers(queryClient)
      onSaved?.()
    },
  })
}

/** Saved settings from a mutation, and everything that shows them. */
export const useSaved = () => {
  const queryClient = useQueryClient()
  return (saved: UserAi) => {
    queryClient.setQueryData(aiKeys.mine, saved)
    void refreshUsers(queryClient)
  }
}
