import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Log In',
  description: 'Log in to your Sovaio account to access your sponsorship rate cards and AI deal guidance.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Log In | Sovaio',
    description: 'Log in to your Sovaio account.',
    images: [{ url: '/sovaiobanner.png', width: 1536, height: 1024, alt: 'Sovaio' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Log In | Sovaio',
    images: ['/sovaiobanner.png'],
  },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
