import Link from 'next/link'
import { Footer, MarketingNav } from '@/components/navbar'
import { createClient } from '@/lib/supabase-server'

type LegalPageProps = {
  title: string
  summary: string
  effectiveDate: string
  children: React.ReactNode
}

export async function LegalPage({ title, summary, effectiveDate, children }: LegalPageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let avatarUrl: string | null = null
  let channelName: string | null = null

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('channel_name, avatar_path')
      .eq('id', user.id)
      .single()

    channelName = profile?.channel_name ?? null

    if (profile?.avatar_path) {
      const { data: signedAvatar } = await supabase.storage
        .from('avatars')
        .createSignedUrl(profile.avatar_path, 60 * 60)

      avatarUrl = signedAvatar?.signedUrl ?? null
    }
  }

  return (
    <>
      <MarketingNav isLoggedIn={Boolean(user)} avatarUrl={avatarUrl} channelName={channelName} />
      <main className="flex-1 bg-muted-light">
        <section className="border-b border-border bg-white">
          <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-16 sm:px-6 lg:px-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Legal</p>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">{title}</h1>
            <p className="max-w-3xl text-base leading-7 text-muted sm:text-lg">{summary}</p>
            <p className="text-sm text-muted">Effective date: {effectiveDate}</p>
          </div>
        </section>
        <section>
          <article className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-12 text-sm leading-7 text-slate-700 sm:px-6 sm:text-base lg:px-8">
            {children}
            <div className="rounded-2xl border border-border bg-white p-6">
              <p className="font-semibold text-foreground">Questions?</p>
              <p className="mt-2 text-muted">
                Contact us at{' '}
                <a className="text-primary hover:text-primary-hover" href="mailto:team@sovaio.com">
                  team@sovaio.com
                </a>
                . You can also return to the{' '}
                <Link className="text-primary hover:text-primary-hover" href="/">
                  homepage
                </Link>
                .
              </p>
            </div>
          </article>
        </section>
      </main>
      <Footer />
    </>
  )
}

export function LegalSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border bg-white p-6 sm:p-8">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      <div className="mt-4 space-y-4 text-muted">{children}</div>
    </section>
  )
}
