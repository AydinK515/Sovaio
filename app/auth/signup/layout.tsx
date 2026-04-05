import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign Up',
  description: 'Create a free Sovaio account and start getting data-backed YouTube sponsorship rates today.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Sign Up | Sovaio',
    description: 'Create a free Sovaio account and start getting data-backed YouTube sponsorship rates today.',
    images: [{ url: '/sovaiobanner.png', width: 1536, height: 1024, alt: 'Sovaio' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sign Up | Sovaio',
    images: ['/sovaiobanner.png'],
  },
}

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
