import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/analytics', '/deal', '/settings', '/auth', '/api', '/generate', '/rate-card', '/welcome'],
    },
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sovaio.com'}/sitemap.xml`,
  }
}
