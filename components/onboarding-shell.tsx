'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import OnboardingChecklist from '@/components/onboarding-checklist'
import { useOnboarding, useOnboardingChecklist } from '@/components/onboarding-provider'

export default function OnboardingShell() {
  const pathname = usePathname()
  const { state, checklistOpen, setChecklistOpen, reopenChecklist } = useOnboarding()
  const { items, completed, quieted } = useOnboardingChecklist()

  const shouldRender = useMemo(() => {
    if (pathname === '/welcome') return false
    if (completed && quieted && state.checklist_dismissed) return false
    return true
  }, [completed, pathname, quieted, state.checklist_dismissed])

  if (!shouldRender) {
    return null
  }

  if (!checklistOpen && state.checklist_dismissed) {
    return (
      <button
        type="button"
        onClick={() => void reopenChecklist()}
        className="fixed bottom-6 left-6 z-30 hidden items-center gap-2 rounded-full border border-border bg-white px-4 py-3 text-sm font-medium shadow-lg transition-colors hover:bg-muted-light md:inline-flex"
      >
        <Sparkles className="h-4 w-4 text-primary" />
        Reopen onboarding
      </button>
    )
  }

  const shouldShowFloating = pathname !== '/dashboard'

  if (!shouldShowFloating) {
    return null
  }

  return (
    <div className="fixed bottom-6 left-6 z-30 hidden w-[360px] max-w-[calc(100vw-3rem)] md:block">
      <OnboardingChecklist compact />
      <button
        type="button"
        onClick={() => setChecklistOpen(false)}
        className="sr-only"
        aria-label={`Checklist has ${items.length} steps`}
      />
    </div>
  )
}
