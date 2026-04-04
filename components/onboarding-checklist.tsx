'use client'

import Link from 'next/link'
import { CheckCircle2, CircleDashed, Sparkles, X } from 'lucide-react'
import { useOnboarding, useOnboardingChecklist } from '@/components/onboarding-provider'

export default function OnboardingChecklist({
  compact = false,
}: {
  compact?: boolean
}) {
  const { checklistOpen, dismissChecklist, trackChecklistClick } = useOnboarding()
  const { items, completedCount, totalCount, quieted, completed } = useOnboardingChecklist()

  if (!checklistOpen) {
    return null
  }

  const allComplete = completed || (totalCount > 0 && completedCount === totalCount)

  const heading = allComplete
    ? 'You\'re all set'
    : quieted
      ? 'Keep the momentum going'
      : 'Make your first result happen fast'

  const description = allComplete
    ? 'You\'ve completed the setup. RateProof is fully ready to help with snapshots, pricing, deals, and AI guidance.'
    : quieted
      ? 'You already have the core setup in place. These last touches help you get even more value out of RateProof.'
      : 'RateProof works best when you move from a saved snapshot into a real rate card and then into a live deal or AI conversation.'

  return (
    <section className={`rounded-[28px] border border-border bg-white shadow-[0_18px_50px_-36px_rgba(15,23,42,0.3)] ${compact ? 'p-4' : 'p-6'}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-light px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Getting Started
          </div>
          <h2 className={`mt-3 font-semibold text-foreground ${compact ? 'text-lg' : 'text-2xl'}`}>
            {heading}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            {description}
          </p>
          {allComplete ? (
            <button
              type="button"
              onClick={() => void dismissChecklist()}
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-secondary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-secondary-hover"
            >
              Close
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void dismissChecklist()}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted transition-colors hover:bg-muted-light hover:text-foreground"
          aria-label="Dismiss onboarding checklist"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl bg-muted-light px-4 py-3">
        <p className="text-sm font-medium text-foreground">Progress</p>
        <p className="text-sm text-muted">{completedCount} of {totalCount} complete</p>
      </div>

      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const isComplete = item.status === 'complete'
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => trackChecklistClick(item.id, compact ? 'floating' : 'page')}
              className={`group flex items-start gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                isComplete
                  ? 'border-emerald-200 bg-emerald-50/70'
                  : item.status === 'active'
                    ? 'border-border bg-white hover:border-primary/25 hover:bg-primary-light/40'
                    : 'border-border bg-slate-50 text-muted'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {isComplete ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : (
                  <CircleDashed className={`h-5 w-5 ${item.status === 'active' ? 'text-primary' : 'text-border-dark'}`} />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{item.description}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
