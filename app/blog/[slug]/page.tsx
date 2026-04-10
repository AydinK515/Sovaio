import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getAllPosts, getPostBySlug } from '@/lib/blog'
import { MarketingNav, Footer } from '@/components/navbar'
import { ArrowLeft, ArrowRight } from 'lucide-react'

type Props = { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  return getAllPosts().map(p => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = await getPostBySlug(slug)
  if (!post) return {}

  return {
    title: post.title,
    description: post.description,
    keywords: post.tags.join(', '),
    authors: [{ name: post.author }],
    alternates: { canonical: `https://sovaio.com/blog/${slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
      images: post.coverImage ? [post.coverImage] : [],
      url: `https://sovaio.com/blog/${slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: post.coverImage ? [post.coverImage] : [],
    },
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = await getPostBySlug(slug)

  if (!post) notFound()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    author: { '@type': 'Person', name: post.author },
    datePublished: post.date,
    dateModified: post.date,
    url: `https://sovaio.com/blog/${slug}`,
    publisher: { '@type': 'Organization', name: 'Sovaio' },
  }

  return (
    <>
      <MarketingNav />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          {/* Back link */}
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors duration-150 mb-10"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Blog
          </Link>

          {/* Post header */}
          <header className="mb-10">
            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-5">
              {post.tags.map(tag => (
                <span
                  key={tag}
                  className="inline-block rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted"
                >
                  {tag}
                </span>
              ))}
            </div>

            <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-[1.05] text-foreground">
              {post.title}
            </h1>

            <p className="mt-4 text-lg text-muted leading-relaxed">
              {post.description}
            </p>

            {/* Meta row */}
            <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <span>{post.author}</span>
              <span className="w-1 h-1 rounded-full bg-border-dark" />
              <span>{formatDate(post.date)}</span>
              <span className="w-1 h-1 rounded-full bg-border-dark" />
              <span>{post.readingTime}</span>
            </div>

            <hr className="mt-8 border-border" />
          </header>

          {/* Content */}
          <div
            className="prose prose-lg max-w-none
              prose-headings:font-black prose-headings:tracking-tight prose-headings:text-foreground
              prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
              prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
              prose-p:text-foreground/85 prose-p:leading-relaxed
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
              prose-strong:text-foreground prose-strong:font-bold
              prose-li:text-foreground/85
              prose-ul:my-4 prose-ol:my-4
              prose-code:text-primary prose-code:bg-primary-light prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
              prose-pre:bg-secondary prose-pre:text-muted-light prose-pre:rounded-2xl
              prose-blockquote:border-l-primary prose-blockquote:text-muted prose-blockquote:not-italic
              prose-hr:border-border"
            dangerouslySetInnerHTML={{ __html: post.contentHtml }}
          />

          {/* CTA */}
          <div className="mt-16 rounded-[28px] border border-border bg-muted-light p-8 text-center">
            <p className="text-xs font-bold tracking-widest uppercase text-primary mb-3">
              Sovaio
            </p>
            <h2 className="text-2xl font-black tracking-tight text-foreground mb-2">
              Know what your channel is worth.
            </h2>
            <p className="text-muted text-base mb-6 max-w-sm mx-auto">
              Connect your YouTube analytics and get a data-backed rate card in minutes — no guesswork.
            </p>
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white hover:bg-primary-hover transition-colors duration-150"
            >
              Get your rate card
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </>
  )
}
