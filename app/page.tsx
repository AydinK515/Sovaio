import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { MarketingNav, Footer } from '@/components/navbar'
import { createClient } from '@/lib/supabase-server'
import { normalizeAuthRedirectPath } from '@/lib/security'
import { ArrowRight, ChevronDown, Upload, BarChart3, MessageSquare } from 'lucide-react'
import type { Metadata } from 'next'

const description =
  "Upload your YouTube Studio analytics, get a data-backed sponsorship rate card, and negotiate better brand deals with AI that knows your exact numbers. Join creators closing bigger deals."

export const metadata: Metadata = {
  title: {
    absolute: "Sovaio | Stop Leaving Money on the Table",
  },
  description,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Sovaio | Stop Leaving Money on the Table",
    description,
    url: "https://sovaio.com",
    siteName: "Sovaio",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/sovaiolandingpage.PNG",
        width: 2355,
        height: 1349,
        alt: "Sovaio — stop leaving money on the table. Get a data-backed sponsorship rate card and AI deal guidance.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sovaio | Stop Leaving Money on the Table",
    description,
    images: [
      {
        url: "/sovaiolandingpage.PNG",
        width: 2355,
        height: 1349,
        alt: "Sovaio — stop leaving money on the table. Get a data-backed sponsorship rate card and AI deal guidance.",
      },
    ],
  },
}

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const resolvedSearchParams = await searchParams
  const code = typeof resolvedSearchParams.code === 'string' ? resolvedSearchParams.code : null
  const authRedirect = normalizeAuthRedirectPath(
    typeof resolvedSearchParams.redirect === 'string'
      ? resolvedSearchParams.redirect
      : '/auth/reset-password?type=recovery'
  )

  if (code) {
    const callbackParams = new URLSearchParams({
      code,
      redirect: authRedirect,
    })

    redirect(`/auth/callback?${callbackParams.toString()}`)
  }

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

  const marqueeItems = [
    'Closed $4,200 for a 60s integration',
    'Countered from $800 → $2,100',
    'Walked away from a lowball — got a better offer 3 days later',
    'First deal closed at $3,100',
    'Negotiated a 90-day exclusivity clause removed',
    'Closed $5,800 for a dedicated video',
    'Raised rate floor after uploading new analytics',
    'Turned a flat $1,500 into $2,900 + commission',
  ]

  return (
    <>
      <MarketingNav isLoggedIn={Boolean(user)} avatarUrl={avatarUrl} channelName={channelName} />
      <main className="flex-1">

        {/* ─── HERO ──────────────────────────────────────────────────────────── */}
        <section className="relative min-h-screen bg-secondary overflow-hidden flex flex-col justify-center">
          {/* Background texture */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
          {/* Red glow top-left */}
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
          {/* Red glow bottom-right */}
          <div className="absolute -bottom-40 -right-20 w-[400px] h-[400px] rounded-full bg-primary/10 blur-[100px] pointer-events-none" />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32 w-full">
            <div className="grid items-center gap-12 lg:grid-cols-[1fr_460px]">

              {/* Left: headline */}
              <div>
                <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-8">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-xs font-semibold text-white/70 tracking-widest uppercase">For YouTube Creators</span>
                </div>

                <h1 className="text-5xl sm:text-6xl md:text-7xl xl:text-8xl font-black tracking-tighter leading-[0.92] text-white">
                  Stop leaving<br />
                  <span className="text-primary">money</span><br />
                  on the table.
                </h1>

                <p className="mt-8 text-lg md:text-xl text-white/60 max-w-lg leading-relaxed">
                  Upload your YouTube Studio analytics. Get a data-backed valuation, a ready-to-send pitch, and an AI negotiation advisor that knows your exact numbers.
                </p>

                <div className="mt-10 flex flex-col sm:flex-row gap-4 items-start">
                  <Link
                    href="/auth/signup"
                    className="group inline-flex items-center gap-2 bg-primary text-white font-bold px-8 py-4 rounded-xl hover:bg-primary-hover transition-all text-base"
                  >
                    Start Earning More
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <a href="#how-it-works" className="inline-flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors text-sm font-medium py-4">
                    See how it works ↓
                  </a>
                </div>

                <p className="mt-6 text-sm text-white/50">
                  So many creators are already closing bigger deals with Sovaio
                </p>

              </div>

              {/* Right: AI chat demo */}
              <div className="relative">
                <div className="absolute -inset-4 rounded-[40px] bg-primary/5 blur-2xl" />
                <p className="mb-3 text-center text-xs font-bold tracking-widest uppercase text-white/70">
                  AI guidance trained on your actual channel analytics
                </p>
                <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
                  <div className="space-y-4 p-5 sm:p-6">
                    {/* User message */}
                    <div className="flex justify-end">
                      <div className="max-w-[85%] rounded-[20px] rounded-br-md bg-white px-4 py-3 text-sm leading-relaxed text-slate-900 shadow-sm font-medium">
                        Hey, I got offered <span className="font-bold text-primary">$2,000</span> for a 60-second ad. Based on my channel, is that actually worth taking?
                      </div>
                    </div>

                    {/* AI response */}
                    <div className="flex justify-start">
                      <div className="max-w-[92%] rounded-[20px] rounded-bl-md border border-white/10 bg-secondary/80 backdrop-blur px-4 py-4 text-sm text-white/80 shadow-sm">
                        <div className="flex items-center gap-2.5 mb-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10">
                            <Image
                              src="/sovaiologotransparent.png"
                              alt="Sovaio"
                              width={24}
                              height={24}
                              className="h-6 w-6 object-contain invert"
                            />
                          </div>
                          <p className="text-sm font-bold text-white">Sovaio AI</p>
                          <span className="ml-auto text-[10px] text-primary font-semibold bg-primary/10 px-2 py-0.5 rounded-full">LIVE</span>
                        </div>
                        <p className="leading-relaxed text-white/70">
                          Based on your <span className="font-semibold text-white">142K median views</span>, <span className="font-semibold text-white">61% US/UK/CA/AU audience</span>, and your <span className="font-semibold text-white">finance CPM tier</span>, I&apos;d treat $2,000 as a soft offer — not a yes.
                        </p>
                        <div className="mt-4 grid gap-2 rounded-2xl border border-white/8 bg-white/5 p-3 text-xs sm:grid-cols-3">
                          <div>
                            <p className="font-bold uppercase tracking-wide text-primary text-[10px]">Suggested move</p>
                            <p className="mt-1 text-white/80">Counter at $3,100</p>
                          </div>
                          <div>
                            <p className="font-bold uppercase tracking-wide text-primary text-[10px]">Why</p>
                            <p className="mt-1 text-white/80">Strong geo + repeatable views</p>
                          </div>
                          <div>
                            <p className="font-bold uppercase tracking-wide text-primary text-[10px]">Push on</p>
                            <p className="mt-1 text-white/80">Audience quality, not reach</p>
                          </div>
                        </div>
                        <p className="mt-3 leading-relaxed text-white/70">
                          Counter with confidence anchored in your audience quality. Leave room to land above your true minimum.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ─── MARQUEE TICKER ────────────────────────────────────────────────── */}
        <div className="bg-primary py-4 overflow-hidden border-y-0 select-none">
          <div className="flex animate-marquee whitespace-nowrap">
            {[...marqueeItems, ...marqueeItems].map((item, i) => (
              <span key={i} className="inline-flex items-center gap-3 px-8 text-sm font-semibold text-white">
                <span className="w-1.5 h-1.5 rounded-full bg-white/60 flex-shrink-0" />
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* ─── BRUTAL STATS ──────────────────────────────────────────────────── */}
        <section className="py-24 md:py-32 bg-white overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-20">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter text-secondary leading-tight">
                You&apos;re being underpaid.<br />
                <span className="text-primary">Here&apos;s the proof.</span>
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-px bg-border overflow-hidden rounded-3xl border border-border">
              {[
                { number: '40%', label: 'Below market rate', sub: 'What the average creator charges vs. what they should' },
                { number: '$2,400', label: 'Left on the table', sub: 'Average annual revenue lost by creators who don\'t negotiate' },
                { number: '3×', label: 'Higher close rate', sub: 'When creators use data-backed rates instead of guessing' },
              ].map((stat, i) => (
                <div key={i} className="bg-white p-10 md:p-14 flex flex-col justify-between group hover:bg-muted-light transition-colors">
                  <div>
                    <p className="text-6xl md:text-7xl xl:text-8xl font-black text-secondary tracking-tighter group-hover:text-primary transition-colors">{stat.number}</p>
                    <p className="mt-3 text-lg md:text-xl font-bold text-secondary">{stat.label}</p>
                  </div>
                  <p className="mt-6 text-sm text-muted leading-relaxed border-t border-border pt-6">{stat.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── HOW IT WORKS ──────────────────────────────────────────────────── */}
        <section id="how-it-works" className="py-24 md:py-32 bg-secondary overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-20">
              <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-tight">
                Three steps.<br /><span className="text-primary">Bigger deals.</span>
              </h2>
              <p className="text-white/40 text-sm max-w-xs leading-relaxed">From raw CSV to closed deal — most creators are done in under 10 minutes.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: Upload,
                  step: '01',
                  title: 'Upload Your Analytics',
                  description: 'Export CSVs from YouTube Studio and drop them in. Parsed locally in your browser — we only store the structured data we need.',
                  accent: 'Upload. Done.',
                },
                {
                  icon: BarChart3,
                  step: '02',
                  title: 'Get Your Rate Card',
                  description: 'AI analyzes your audience geo, niche CPM, and view velocity to generate data-backed price ranges for every deal type.',
                  accent: 'Know your number.',
                },
                {
                  icon: MessageSquare,
                  step: '03',
                  title: 'Negotiate & Close',
                  description: 'Paste what the brand says. Get exact words back — push, counter, or walk away — guided by your real data.',
                  accent: 'Close bigger.',
                },
              ].map((item) => (
                <div key={item.step} className="group relative rounded-3xl border border-white/8 bg-white/5 p-8 hover:border-primary/30 hover:bg-white/8 transition-all duration-300">
                  <div className="flex items-start justify-between mb-8">
                    <span className="text-7xl font-black text-white/5 group-hover:text-primary/10 transition-colors leading-none font-mono">{item.step}</span>
                    <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                  <p className="text-xs font-bold tracking-widest uppercase text-primary mb-2">{item.accent}</p>
                  <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FEATURE BENTO ─────────────────────────────────────────────────── */}
        <section id="features" className="py-24 md:py-32 bg-muted-light">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-xs font-bold tracking-widest uppercase text-primary mb-3">Built different</p>
              <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-secondary">Everything you need to win.</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
              {/* Big card */}
              <div className="lg:col-span-2 rounded-3xl bg-secondary p-10 flex flex-col justify-between min-h-[280px] group overflow-hidden relative">
                <div className="absolute -right-10 -bottom-10 w-48 h-48 rounded-full bg-primary/10 blur-3xl" />
                <div>
                  <p className="text-xs font-bold tracking-widest uppercase text-primary mb-4">Negotiation AI</p>
                  <h3 className="text-2xl md:text-3xl font-black text-white leading-tight">Never guess what to say again.</h3>
                  <p className="mt-3 text-white/50 text-sm leading-relaxed max-w-md">
                    Paste the brand&apos;s offer. Get back the exact reply — calibrated to your data, not generic advice. Know when to push, when to accept, when to walk.
                  </p>
                </div>
                <div className="mt-8 inline-flex text-primary text-sm font-bold">
                  AI trained on your channel
                </div>
              </div>

              {/* Privacy card */}
              <div className="rounded-3xl bg-white border border-border p-8 flex flex-col justify-between min-h-[280px] hover:border-primary/20 transition-colors">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-primary/8 flex items-center justify-center mb-6">
                    <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  </div>
                  <h3 className="text-xl font-black text-secondary mb-2">Privacy First</h3>
                  <p className="text-sm text-muted leading-relaxed">CSV files are parsed in your browser. We never store the original file — only the structured analytics we need to generate your reports.</p>
                </div>
                <p className="mt-6 text-xs text-muted font-semibold">No YouTube API connection required</p>
              </div>

              {/* Rate card card */}
              <div className="rounded-3xl bg-white border border-border p-8 flex flex-col justify-between min-h-[240px] hover:border-primary/20 transition-colors">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-primary/8 flex items-center justify-center mb-6">
                    <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  </div>
                  <h3 className="text-xl font-black text-secondary mb-2">Real Valuations</h3>
                  <p className="text-sm text-muted leading-relaxed">Not a generic calculator. Your rate card uses your actual audience geo, niche CPM, and view patterns to price every deal type.</p>
                </div>
              </div>

              {/* Deal tracking card */}
              <div className="rounded-3xl bg-primary p-8 flex flex-col justify-between min-h-[240px] group">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-6">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                  </div>
                  <h3 className="text-xl font-black text-white mb-2">Deal Dashboard</h3>
                  <p className="text-sm text-white/70 leading-relaxed">Track every active negotiation. See status, last offer, and AI-suggested next move — all in one place.</p>
                </div>
                <p className="mt-6 text-xs text-white/60 font-semibold">Close more. Forget less.</p>
              </div>

              {/* Pitch email card */}
              <div className="rounded-3xl bg-secondary border border-white/5 p-8 flex flex-col justify-between min-h-[240px]">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mb-6">
                    <svg className="w-6 h-6 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  </div>
                  <h3 className="text-xl font-black text-white mb-2">Pitch Email Generator</h3>
                  <p className="text-sm text-white/50 leading-relaxed">Ready-to-send pitch templates built from your data. Position your channel like a pro on the first email.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── PRICING (commented out — launching free first) ─────────────────
        <section id="pricing" className="py-24 md:py-32 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-xs font-bold tracking-widest uppercase text-primary mb-3">Pricing</p>
              <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-secondary">
                Pays for itself on<br />your first deal.
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              Free
              <div className="rounded-3xl border border-border p-10 bg-white flex flex-col">
                <div className="flex-1">
                  <p className="text-xs font-bold tracking-widest uppercase text-muted mb-1">Free</p>
                  <p className="text-5xl font-black text-secondary mt-2">$0</p>
                  <p className="text-sm text-muted mt-1">Forever free</p>
                  <ul className="mt-8 space-y-3">
                    {['1 rate card generation', 'Basic price ranges', 'Pitch email template'].map(f => (
                      <li key={f} className="flex items-start gap-3 text-sm text-muted">
                        <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <Link href="/auth/signup" className="mt-10 block text-center py-3.5 rounded-xl border border-border text-sm font-bold hover:bg-muted-light transition-colors text-secondary">
                  Get Started Free
                </Link>
              </div>

              Pro
              <div className="rounded-3xl bg-secondary p-10 flex flex-col relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
                <div className="absolute top-0 left-6">
                  <div className="bg-primary text-white text-[10px] font-black px-3 py-1 rounded-b-xl tracking-widest uppercase">Most Popular</div>
                </div>
                <div className="flex-1 pt-4">
                  <p className="text-xs font-bold tracking-widest uppercase text-white/40 mb-1">Pro</p>
                  <p className="text-5xl font-black text-white mt-2">$20<span className="text-xl font-normal text-white/40">/mo</span></p>
                  <p className="text-sm text-white/40 mt-1">Cancel anytime</p>
                  <ul className="mt-8 space-y-3">
                    {['Unlimited rate cards', 'Negotiation AI advisor', 'Deal tracking dashboard', 'PDF exports', 'Priority support'].map(f => (
                      <li key={f} className="flex items-start gap-3 text-sm text-white/70">
                        <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <Link href="/auth/signup" className="mt-10 block text-center py-3.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-hover transition-colors shadow-[0_0_30px_rgba(220,38,38,0.3)]">
                  Start Pro Trial
                </Link>
              </div>
            </div>
          </div>
        </section>
        ─────────────────────────────────────────────────────────────────────── */}

        {/* ─── FAQ ───────────────────────────────────────────────────────────── */}
        <section id="faq" className="py-24 md:py-28 bg-muted-light">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-black text-secondary text-center tracking-tighter mb-12">Questions?</h2>
            <div className="space-y-3">
              {[
                { q: 'Is my YouTube data safe?', a: 'We parse your CSV files in your browser and do not store the original file uploads. We do store the structured analytics data needed to generate snapshots, rate cards, and AI guidance — and that data is protected in transit and at rest.' },
                { q: 'How accurate are the rate estimates?', a: 'Your rates come from your actual analytics combined with current market benchmarks for your niche. The more data you upload, the higher your Report Confidence score and the more precise your rates.' },
                { q: "What if the brand says no to my rate?", a: "That's exactly what our Negotiation AI is built for. It advises you on whether to counter, compromise, or walk away — and gives you the exact words to say." },
                { q: 'Do I need to connect my YouTube account?', a: 'No. We deliberately avoid API connections. You export CSVs directly from YouTube Studio, giving you full control over what data you share.' },
].map((item, i) => (
                <details key={i} className="group bg-white rounded-2xl border border-border px-6 py-5 cursor-pointer">
                  <summary className="flex items-center justify-between list-none">
                    <span className="font-bold text-sm text-secondary">{item.q}</span>
                    <ChevronDown className="w-4 h-4 text-muted group-open:rotate-180 transition-transform flex-shrink-0 ml-4" />
                  </summary>
                  <p className="mt-3 text-sm text-muted leading-relaxed">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FINAL CTA ─────────────────────────────────────────────────────── */}
        <section className="relative py-28 md:py-40 bg-secondary overflow-hidden">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-primary/15 blur-[120px] pointer-events-none rounded-full" />
          <div className="relative max-w-3xl mx-auto px-4 text-center">
            <p className="text-xs font-bold tracking-widest uppercase text-primary mb-6">Ready to earn more?</p>
            <h2 className="text-5xl md:text-6xl lg:text-7xl font-black text-white tracking-tighter leading-tight">
              Know your worth.<br /><span className="text-primary">Prove it.</span> Close the deal.
            </h2>
            <p className="mt-6 text-lg text-white/50 max-w-md mx-auto">From analytics to closed deal — most creators are up and running in under 10 minutes.</p>
            <Link
              href="/auth/signup"
              className="mt-10 inline-flex items-center gap-2 bg-primary text-white font-bold px-10 py-5 rounded-xl hover:bg-primary-hover transition-all text-lg"
            >
              Get Started — It&apos;s Free
              <ArrowRight className="w-5 h-5" />
            </Link>
            <p className="mt-5 text-sm text-white/30">No credit card. No YouTube connection. Just your CSVs.</p>
          </div>
        </section>

      </main>
      <Footer />
    </>
  )
}
