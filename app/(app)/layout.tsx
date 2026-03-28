import { AppNav, Footer } from '@/components/navbar'
import { createClient } from '@/lib/supabase-server'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  await supabase.auth.getUser()

  return (
    <>
      <AppNav />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <Footer />
    </>
  )
}
