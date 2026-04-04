'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Menu, User, X } from 'lucide-react'

interface MarketingNavProps {
  isLoggedIn?: boolean
  avatarUrl?: string | null
  channelName?: string | null
}

function AvatarBadge({ avatarUrl, channelName }: Pick<MarketingNavProps, 'avatarUrl' | 'channelName'>) {
  if (avatarUrl) {
    return (
      <div className="relative h-9 w-9 overflow-hidden rounded-full border border-border bg-muted-light">
        <Image
          src={avatarUrl}
          alt={channelName ? `${channelName} avatar` : 'Profile avatar'}
          fill
          sizes="36px"
          className="object-cover"
        />
      </div>
    )
  }

  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-muted-light text-muted">
      <User className="h-4 w-4" />
    </div>
  )
}

export function MarketingNav({ isLoggedIn = false, avatarUrl = null, channelName = null }: MarketingNavProps) {
  const [open, setOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link href="/" className="font-bold text-xl text-foreground">
            RateProof <span className="text-primary">AI</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="text-sm text-muted hover:text-foreground transition-colors">Pricing</a>
            {isLoggedIn ? (
              <div className="flex items-center gap-3">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 bg-primary text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-primary-hover transition-colors"
                >
                  Dashboard
                </Link>
                <AvatarBadge avatarUrl={avatarUrl} channelName={channelName} />
              </div>
            ) : (
              <>
                <Link href="/auth/login" className="text-sm text-muted hover:text-foreground transition-colors">Log In</Link>
                <Link
                  href="/auth/signup"
                  className="inline-flex items-center gap-2 bg-primary text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-primary-hover transition-colors"
                >
                  Get My Rate
                </Link>
              </>
            )}
          </div>

          <button className="md:hidden" onClick={() => setOpen(!open)}>
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-white px-4 py-4 space-y-3">
          <a href="#features" className="block text-sm text-muted" onClick={() => setOpen(false)}>Features</a>
          <a href="#pricing" className="block text-sm text-muted" onClick={() => setOpen(false)}>Pricing</a>
          {isLoggedIn ? (
            <div className="flex items-center justify-between gap-3">
              <Link href="/dashboard" className="block text-sm font-medium text-primary" onClick={() => setOpen(false)}>Dashboard</Link>
              <AvatarBadge avatarUrl={avatarUrl} channelName={channelName} />
            </div>
          ) : (
            <>
              <Link href="/auth/login" className="block text-sm text-muted" onClick={() => setOpen(false)}>Log In</Link>
              <Link href="/auth/signup" className="block text-sm font-medium text-primary" onClick={() => setOpen(false)}>Get My Rate</Link>
            </>
          )}
        </div>
      )}
    </nav>
  )
}

export function AppNav({ hasAnalytics: _hasAnalytics }: { hasAnalytics: boolean }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const links = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/analytics', label: 'Analytics Snapshots' },
    { href: '/rate-card', label: 'Rate Cards' },
    { href: '/settings', label: 'Settings' },
  ]

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link href="/dashboard" className="font-bold text-xl text-foreground">
            RateProof <span className="text-primary">AI</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            {links.map(l => (
              <Link
                key={l.href}
                href={l.href}
                className={`text-sm transition-colors ${pathname.startsWith(l.href) ? 'text-foreground font-medium' : 'text-muted hover:text-foreground'}`}
              >
                {l.label}
              </Link>
            ))}
          </div>

          <button className="md:hidden" onClick={() => setOpen(!open)}>
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-white px-4 py-4 space-y-3">
          {links.map(l => (
            <Link key={l.href} href={l.href} className="block text-sm text-muted" onClick={() => setOpen(false)}>{l.label}</Link>
          ))}
        </div>
      )}
    </nav>
  )
}

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted-light mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted">
            RateProof <span className="text-primary font-medium">AI</span>
          </p>
          <div className="flex items-center gap-6">
            <Link href="#" className="text-xs text-muted hover:text-foreground transition-colors">FAQ</Link>
            <Link href="#" className="text-xs text-muted hover:text-foreground transition-colors">Terms</Link>
            <Link href="#" className="text-xs text-muted hover:text-foreground transition-colors">Privacy</Link>
          </div>
          <p className="text-xs text-muted">&copy; {new Date().getFullYear()} RateProof AI. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
