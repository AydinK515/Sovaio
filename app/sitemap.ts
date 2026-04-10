import type { MetadataRoute } from 'next'
import { getAllPosts } from '@/lib/blog'

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sovaio.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts()

  const blogEntries: MetadataRoute.Sitemap = posts.map(post => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  return [
    {
      url: baseUrl,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/blog`,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    ...blogEntries,
  ]
}
