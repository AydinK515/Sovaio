export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  subscriber_count: number | null
  niche: string | null
  has_sponsorships: boolean
  subscription_tier: 'free' | 'pro'
  generations_used: number
  created_at: string
  updated_at: string
}

export interface CsvUpload {
  id: string
  user_id: string
  upload_type: 'content' | 'demographics' | 'geography' | 'traffic_sources' | 'retention'
  parsed_data: Record<string, unknown>
  row_count: number
  created_at: string
}

export interface RateCard {
  id: string
  user_id: string
  niche: string | null
  subscriber_count: number | null
  has_sponsorships: boolean
  dedicated_video_low: number
  dedicated_video_high: number
  integration_60s_low: number
  integration_60s_high: number
  integration_30s_low: number
  integration_30s_high: number
  explanation: string | null
  improvement_tips: { title: string; description: string }[] | null
  pitch_email: string | null
  report_confidence: number
  csv_upload_ids: string[]
  created_at: string
}

export interface Deal {
  id: string
  user_id: string
  rate_card_id: string | null
  brand_name: string
  brand_logo_url: string | null
  status: 'negotiating' | 'closed_won' | 'closed_lost' | 'stalled'
  deal_type: 'dedicated_video' | 'integration_60s' | 'integration_30s'
  creator_ask: number | null
  brand_last_offer: number | null
  final_price: number | null
  timeline: string | null
  target_ctr: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface DealMessage {
  id: string
  deal_id: string
  chat_id: string
  user_id: string
  role: 'creator' | 'brand' | 'ai'
  content: string
  suggested_script: string | null
  created_at: string
}

export interface DealChat {
  id: string
  deal_id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
}

export const NICHES = [
  'Tech & Gaming',
  'Finance & Business',
  'Beauty & Fashion',
  'Health & Fitness',
  'Food & Cooking',
  'Travel & Lifestyle',
  'Education & How-To',
  'Entertainment & Comedy',
  'Music & Arts',
  'News & Politics',
  'Sports',
  'Science & Nature',
  'Parenting & Family',
  'DIY & Crafts',
  'Automotive',
  'Other',
] as const

export const CSV_TYPES = [
  { key: 'content' as const, label: 'Top Content', required: true, description: 'Shows your reach and top performing videos', studioPath: 'Analytics > Content' },
  { key: 'demographics' as const, label: 'Audience Demographics', required: false, description: 'Age and gender breakdown of your audience', studioPath: 'Analytics > Audience > Demographics' },
  { key: 'geography' as const, label: 'Geography', required: false, description: 'Where your viewers are located', studioPath: 'Analytics > Audience > Geography' },
  { key: 'traffic_sources' as const, label: 'Traffic Sources', required: false, description: 'How viewers find your content', studioPath: 'Analytics > Reach > Traffic source' },
  { key: 'retention' as const, label: 'Retention', required: false, description: 'How long viewers watch your videos', studioPath: 'Analytics > Engagement > Audience retention' },
] as const
