import Link from 'next/link'
import type { Metadata } from 'next'
import { getAllPosts } from '@/lib/blog'
import { MarketingNav, Footer } from '@/components/navbar'

export const metadata: Metadata = {
  title: 'Blog | Sovaio',
  description: 'Guides and resources for YouTube creators on sponsorship pricing, brand deals, and negotiation.',
  alternates: { canonical: 'https://sovaio.com/blog' },
  openGraph: {
    title: 'Blog | Sovaio',
    description: 'Guides and resources for YouTube creators on sponsorship pricing, brand deals, and negotiation.',
    type: 'website',
    url: 'https://sovaio.com/blog',
  },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function BlogIndexPage() {
  const posts = getAllPosts()

  return (
    <>
      <MarketingNav />

      <main className="min-h-screen bg-background">
        {/* Hero */}
        <section className="border-b border-border py-20 md:py-28">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <p className="text-xs font-bold tracking-widest uppercase text-primary mb-4">
              Creator Resources
            </p>
            <h1 className="text-5xl sm:text-6xl font-black tracking-tighter leading-[0.95] text-foreground">
              The Blog
            </h1>
            <p className="mt-5 text-lg text-muted max-w-xl">
              Practical guides on pricing, negotiation, and building a sustainable sponsorship business on YouTube.
            </p>
          </div>
        </section>

        {/* Post list */}
        <section className="py-16 md:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            {posts.length === 0 ? (
              <p className="text-muted">No posts yet. Check back soon.</p>
            ) : (
              <ul className="divide-y divide-border">
                {posts.map(post => (
                  <li key={post.slug} className="py-10 first:pt-0 last:pb-0 group">
                    <article>
                      {/* Tags */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {post.tags.map(tag => (
                          <span
                            key={tag}
                            className="inline-block rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* Title */}
                      <Link href={`/blog/${post.slug}`} className="block">
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground transition-colors duration-200 group-hover:text-primary [text-decoration:none]">
                          {post.title}
                        </h2>
                      </Link>

                      {/* Description */}
                      <p className="mt-2.5 text-base text-muted leading-relaxed line-clamp-2">
                        {post.description}
                      </p>

                      {/* Meta */}
                      <div className="mt-4 flex items-center gap-3 text-sm text-muted">
                        <span>{formatDate(post.date)}</span>
                        <span className="w-1 h-1 rounded-full bg-border-dark" />
                        <span>{post.readingTime}</span>
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
