import Link from 'next/link'
import { MarketingNav, Footer } from '@/components/navbar'
import { createClient } from '@/lib/supabase-server'
import { ArrowRight, Upload, BarChart3, MessageSquare, Check, ChevronDown, Shield, Zap, TrendingUp } from 'lucide-react'

export default async function LandingPage() {
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
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-light via-white to-white" />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
            <div className="max-w-3xl">
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.1]">
                Know your worth.{' '}
                <span className="text-primary">Prove it.</span>
                <br />Close the deal.
              </h1>
              <p className="mt-6 text-lg md:text-xl text-muted max-w-2xl leading-relaxed">
                Upload your YouTube Studio analytics. Get a data-backed sponsorship rate card with a ready-to-send pitch email. Then let AI guide your negotiation to close.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Link
                  href="/auth/signup"
                  className="inline-flex items-center justify-center gap-2 bg-primary text-white font-semibold px-8 py-4 rounded-xl hover:bg-primary-hover transition-colors text-lg"
                >
                  Get My Rate Card
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
              <p className="mt-4 text-sm text-muted">
                Creators using Sovaio close deals for <span className="font-semibold text-foreground">up to 40% more</span>.
              </p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="features" className="py-20 md:py-28 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-sm font-semibold text-primary uppercase tracking-wider">Your Path to Higher Pay</p>
              <h2 className="mt-3 text-3xl md:text-4xl font-bold">Three steps to better deals</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: Upload,
                  step: '01',
                  title: 'Upload Your Analytics',
                  description: 'Export CSVs from YouTube Studio and drop them in. We parse everything locally — your raw files are never stored.',
                },
                {
                  icon: BarChart3,
                  step: '02',
                  title: 'Get Your Rate Card',
                  description: 'AI analyzes your audience, niche, and performance to generate price ranges for dedicated videos, 60s, and 30s integrations.',
                },
                {
                  icon: MessageSquare,
                  step: '03',
                  title: 'Negotiate with Confidence',
                  description: 'Track your deal, paste in what the brand says, and get AI-powered advice on when to push back, accept, or walk away.',
                },
              ].map((item) => (
                <div key={item.step} className="relative bg-muted-light rounded-2xl p-8 border border-border hover:border-primary/20 transition-colors group">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <item.icon className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-xs font-mono text-muted">STEP {item.step}</span>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-20 md:py-28 bg-muted-light">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-white rounded-2xl p-8 border border-border">
                <Shield className="w-8 h-8 text-primary mb-4" />
                <h3 className="text-lg font-semibold mb-2">Privacy First</h3>
                <p className="text-sm text-muted">CSVs are parsed in your browser. We extract metrics and discard the files immediately. No raw data ever hits our servers.</p>
              </div>
              <div className="bg-white rounded-2xl p-8 border border-border">
                <Zap className="w-8 h-8 text-primary mb-4" />
                <h3 className="text-lg font-semibold mb-2">Real-Time Valuations</h3>
                <p className="text-sm text-muted">Your rate card is generated from your actual data — not generic calculators. The more data you provide, the more precise your rates.</p>
              </div>
              <div className="bg-white rounded-2xl p-8 border border-border">
                <TrendingUp className="w-8 h-8 text-primary mb-4" />
                <h3 className="text-lg font-semibold mb-2">Negotiation AI</h3>
                <p className="text-sm text-muted">Stop guessing how to respond. Our AI suggests exactly what to say based on thousands of successful creator deals.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-20 md:py-28 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-sm font-semibold text-primary uppercase tracking-wider">Simple Pricing</p>
              <h2 className="mt-3 text-3xl md:text-4xl font-bold">Pricing for Every Stage</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
              {/* Free */}
              <div className="rounded-2xl border border-border p-8 bg-white">
                <h3 className="text-lg font-semibold">Free</h3>
                <p className="mt-1 text-sm text-muted">Try it out</p>
                <p className="mt-6 text-4xl font-bold">$0</p>
                <ul className="mt-8 space-y-3">
                  {['1 rate card generation', 'Basic price ranges', 'Pitch email template'].map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted">
                      <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/auth/signup" className="mt-8 block text-center py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted-light transition-colors">
                  Get Started Free
                </Link>
              </div>
              {/* Pro */}
              <div className="rounded-2xl border-2 border-primary p-8 bg-white relative">
                <div className="absolute -top-3 left-6 bg-primary text-white text-xs font-semibold px-3 py-1 rounded-full">Most Popular</div>
                <h3 className="text-lg font-semibold">Pro</h3>
                <p className="mt-1 text-sm text-muted">For serious creators</p>
                <p className="mt-6 text-4xl font-bold">$20<span className="text-lg font-normal text-muted">/mo</span></p>
                <ul className="mt-8 space-y-3">
                  {['Unlimited rate cards', 'Negotiation AI advisor', 'Deal tracking dashboard', 'Priority support', 'PDF exports'].map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted">
                      <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/auth/signup" className="mt-8 block text-center py-3 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors">
                  Start Pro Trial
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 md:py-28 bg-muted-light">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {[
                { q: 'Is my YouTube data safe?', a: 'Absolutely. Your CSV files are parsed entirely in your browser. We only store the extracted metrics — never the raw files. Your data is encrypted in transit and at rest.' },
                { q: 'How accurate are the rate estimates?', a: 'Our rates are generated from your actual channel analytics combined with current market benchmarks for your niche. The more data you upload, the higher your Report Confidence score and the more precise your rates.' },
                { q: 'What if the brand says no to my rate?', a: "That's exactly what our Negotiation AI is built for. It will advise you on whether to counter, compromise, or walk away — and give you the exact words to say." },
                { q: 'Do I need to connect my YouTube account?', a: 'No. We deliberately avoid API connections. You export CSVs directly from YouTube Studio, which gives you full control over what data you share.' },
                { q: 'Can I cancel anytime?', a: 'Yes. Pro is month-to-month with no contracts. Cancel anytime from your settings page.' },
              ].map((item, i) => (
                <details key={i} className="group bg-white rounded-xl border border-border p-5">
                  <summary className="flex items-center justify-between cursor-pointer list-none">
                    <span className="font-medium text-sm">{item.q}</span>
                    <ChevronDown className="w-4 h-4 text-muted group-open:rotate-180 transition-transform" />
                  </summary>
                  <p className="mt-3 text-sm text-muted leading-relaxed">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-secondary text-white">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold">Stop underpricing your influence.</h2>
            <p className="mt-4 text-lg text-white/70">Get your data-backed rate card in under 5 minutes.</p>
            <Link
              href="/auth/signup"
              className="mt-8 inline-flex items-center gap-2 bg-primary text-white font-semibold px-8 py-4 rounded-xl hover:bg-primary-hover transition-colors text-lg"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
