import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AnalyticsUploadForm from '@/components/analytics-upload-form'

export default async function NewAnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  return <AnalyticsUploadForm />
}
