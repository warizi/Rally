import { useEffect } from 'react'
import { useOnboardingStore } from '@shared/store/onboarding'
import { toLogError } from '@shared/lib/logger'

const onError = toLogError('onboarding')

export function OnboardingInitializer(): null {
  const hydrate = useOnboardingStore((s) => s.hydrate)
  const hydrated = useOnboardingStore((s) => s.hydrated)

  useEffect(() => {
    if (hydrated) return
    hydrate().catch(onError)
  }, [hydrate, hydrated])

  return null
}
