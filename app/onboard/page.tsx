import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function OnboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { count } = await supabase
    .from('stores')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  redirect(count && count > 0 ? '/dashboard' : '/setup')
}
