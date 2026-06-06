import { createClient } from '@/lib/supabase/server'
import SettingsClient from './SettingsClient'
import type { Database } from '@/lib/types/database'

type StoreRow = Database['public']['Tables']['stores']['Row']
type BrandVoiceRow = Database['public']['Tables']['brand_voice_config']['Row']

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: storeData } = await supabase
    .from('stores')
    .select('id, store_domain, google_connection_mode, google_location_name')
    .eq('user_id', user!.id)
    .maybeSingle()

  const store = storeData as StoreRow | null

  const { data: brandVoiceData } = store
    ? await supabase
        .from('brand_voice_config')
        .select('*')
        .eq('store_id', store.id)
        .maybeSingle()
    : { data: null }

  const brandVoice = brandVoiceData as BrandVoiceRow | null

  return <SettingsClient store={store} brandVoice={brandVoice} />
}
