import { useEffect } from 'react'
import { useOnboardingStore } from '@shared/store/onboarding'

export function OnboardingInitializer(): null {
  const hydrate = useOnboardingStore((s) => s.hydrate)
  const hydrated = useOnboardingStore((s) => s.hydrated)

  useEffect(() => {
    if (hydrated) return
    hydrate().catch(console.error)
  }, [hydrate, hydrated])

  return null
}
