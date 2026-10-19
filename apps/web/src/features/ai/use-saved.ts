import { type QueryClient, useQueryClient } from '@tanstack/react-query'

import { voiceKeys } from '../voice/queries'
import { type UserAi } from './api'
import { aiKeys } from './queries'

/** What shows which AI is used: the families' and Siri's settings. */
export const refreshUsers = (queryClient: QueryClient) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: aiKeys.families }),
    queryClient.invalidateQueries({ queryKey: voiceKeys.settings }),
  ])

/** Saved settings from a mutation, and everything that shows them. */
export const useSaved = () => {
  const queryClient = useQueryClient()
  return (saved: UserAi) => {
    queryClient.setQueryData(aiKeys.mine, saved)
    void refreshUsers(queryClient)
  }
}
