import { cache } from 'react'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import remarkHtml from 'remark-html'
import readingTime from 'reading-time'

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog')

export type PostMeta = {
  slug: string
  title: string
  description: string
  date: string // ISO: "2025-01-15"
  author: string
  tags: string[]
  coverImage?: string
  readingTime: string // e.g. "4 min read"
}

export type Post = PostMeta & {
  contentHtml: string
}

export const getAllPosts = cache((): PostMeta[] => {
  const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'))

  return files
    .map(filename => {
      const slug = filename.replace(/\.md$/, '')
      const raw = fs.readFileSync(path.join(BLOG_DIR, filename), 'utf-8')
      const { data, content } = matter(raw)
      const stats = readingTime(content)

      return {
        slug,
        title: data.title as string,
        description: data.description as string,
        date: data.date as string,
        author: data.author as string,
        tags: (data.tags as string[]) ?? [],
        coverImage: data.coverImage as string | undefined,
        readingTime: stats.text,
      }
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
})

export const getPostBySlug = cache(async (slug: string): Promise<Post | null> => {
  const filepath = path.join(BLOG_DIR, `${slug}.md`)

  if (!fs.existsSync(filepath)) return null

  const raw = fs.readFileSync(filepath, 'utf-8')
  const { data, content } = matter(raw)
  const stats = readingTime(content)

  const processed = await remark().use(remarkGfm).use(remarkHtml).process(content)
  const contentHtml = processed.toString()

  return {
    slug,
    title: data.title as string,
    description: data.description as string,
    date: data.date as string,
    author: data.author as string,
    tags: (data.tags as string[]) ?? [],
    coverImage: data.coverImage as string | undefined,
    readingTime: stats.text,
    contentHtml,
  }
})
