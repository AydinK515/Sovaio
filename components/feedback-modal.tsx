'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Loader2, MessageSquareMore } from 'lucide-react'
import FancySelect from '@/components/fancy-select'

type FeedbackType = 'bug_report' | 'feature_request' | 'general_feedback'

type FeedbackModalProps = {
  open: boolean
  onClose: () => void
  userEmail?: string | null
  onSubmitted?: () => void
}

const FEEDBACK_TYPE_OPTIONS = [
  { value: 'general_feedback', label: 'General feedback' },
  { value: 'bug_report', label: 'Bug report' },
  { value: 'feature_request', label: 'Feature request' },
] as const

export default function FeedbackModal({
  open,
  onClose,
  userEmail,
  onSubmitted,
}: FeedbackModalProps) {
  const pathname = usePathname()
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('general_feedback')
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [canContactAboutFeedback, setCanContactAboutFeedback] = useState(true)
  const [submittingFeedback, setSubmittingFeedback] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !submittingFeedback) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open, submittingFeedback])

  useEffect(() => {
    if (open) {
      return
    }

    setFeedbackType('general_feedback')
    setFeedbackMessage('')
    setCanContactAboutFeedback(true)
    setSubmittingFeedback(false)
    setMessage('')
    setError('')
  }, [open])

  if (!open) {
    return null
  }

  async function handleSubmit() {
    setMessage('')
    setError('')

    const trimmedMessage = feedbackMessage.trim()

    if (trimmedMessage.length < 10) {
      setError('Please share a bit more detail so I can actually act on it.')
      return
    }

    setSubmittingFeedback(true)

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          feedbackType,
          message: trimmedMessage,
          pagePath: pathname,
          canContact: canContactAboutFeedback,
        }),
      })

      const payload = (await response.json().catch(() => null)) as { error?: string } | null

      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to send feedback right now.')
      }

      setMessage('Thanks — your feedback was sent.')
      onSubmitted?.()
      window.setTimeout(() => {
        onClose()
      }, 900)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to send feedback right now.')
    } finally {
      setSubmittingFeedback(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
      onClick={() => {
        if (!submittingFeedback) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-modal-title"
        className="w-full max-w-xl rounded-[28px] border border-border bg-white p-6 shadow-2xl animate-pop-in md:p-7"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-primary">
            <MessageSquareMore className="h-5 w-5" />
          </div>
          <div>
            <h2 id="feedback-modal-title" className="text-2xl font-semibold text-foreground">
              Send Feedback
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Share bugs, rough edges, or feature ideas. Feedback from this form is saved to your account so it can be reviewed with context.
            </p>
          </div>
        </div>

        {message || error ? (
          <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${error ? 'border-red-200 bg-primary-light text-primary' : 'border-green-200 bg-green-50 text-green-700'}`}>
            {error || message}
          </div>
        ) : null}

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">
              Feedback Type
            </label>
            <FancySelect
              value={feedbackType}
              onChange={(value) => setFeedbackType(value as FeedbackType)}
              options={[...FEEDBACK_TYPE_OPTIONS]}
              triggerClassName="rounded-2xl px-4 py-3.5"
              menuClassName="rounded-2xl"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted">
              What should I know?
            </label>
            <textarea
              value={feedbackMessage}
              onChange={(event) => setFeedbackMessage(event.target.value)}
              placeholder="What were you doing, what felt off, and what would make this better?"
              rows={6}
              maxLength={4000}
              className="w-full resize-y rounded-2xl border border-border px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <div className="mt-2 flex items-center justify-between text-xs text-muted">
              <span>Submitted from {pathname || '/settings'}</span>
              <span>{feedbackMessage.trim().length}/4000</span>
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-2xl border border-border px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={canContactAboutFeedback}
              onChange={(event) => setCanContactAboutFeedback(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
            />
            <span className="text-muted">
              You can follow up with me
              {userEmail ? <> at <span className="font-medium text-foreground">{userEmail}</span></> : null}
              {' '}about this feedback.
            </span>
          </label>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submittingFeedback}
            className="rounded-xl border border-border px-4 py-3 text-sm font-medium transition-colors hover:bg-muted-light disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submittingFeedback}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submittingFeedback && <Loader2 className="h-4 w-4 animate-spin" />}
            {submittingFeedback ? 'Sending...' : 'Send Feedback'}
          </button>
        </div>
      </div>
    </div>
  )
}
