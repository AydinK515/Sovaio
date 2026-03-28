export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  channel_name: string | null
  avatar_path: string | null
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
  upload_type: 'content' | 'audience_growth' | 'demographics' | 'geography' | 'traffic_sources' | 'retention'
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
  subject: string | null
  suggested_script: string | null
  created_at: string
}

export interface DealChat {
  id: string
  deal_id: string
  user_id: string
  title: string
  openai_conversation_id: string | null
  openai_last_response_id: string | null
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
  { key: 'content' as const, label: 'Top Content', required: true, confidence: 35, description: 'Views, watch time, CTR, and subscribers gained per video', studioPath: 'Analytics > Content' },
  { key: 'audience_growth' as const, label: 'Audience Size & Growth', required: true, confidence: 25, description: 'Monthly audience, subscriber trajectory, and viewer loyalty (new vs regular)', studioPath: 'Analytics > Audience > Audience size and growth' },
  { key: 'demographics' as const, label: 'Audience Demographics', required: false, confidence: 20, description: 'Age and gender breakdown — signals audience purchasing power', studioPath: 'Analytics > Audience > Age and gender' },
  { key: 'geography' as const, label: 'Top Geographies', required: false, confidence: 10, description: 'Where your viewers are located — US/UK/CA = premium CPMs', studioPath: 'Analytics > Audience > Geography' },
  { key: 'traffic_sources' as const, label: 'Traffic Sources', required: false, confidence: 10, description: 'How viewers find your content — organic search signals intent', studioPath: 'Analytics > Reach > Traffic source' },
] as const
