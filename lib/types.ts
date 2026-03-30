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

export interface AnalyticsSnapshot {
  id: string
  user_id: string
  name: string
  csv_upload_ids: string[]
  report_confidence: number
  subscriber_count: number | null
  report_types: string[]
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
  name: string | null
  analytics_snapshot_id: string | null
  niche: string | null
  subscriber_count: number | null
  has_sponsorships: boolean
  offers_dedicated_videos: boolean
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
  analytics_snapshot_id: string | null
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
  reasoning_summary?: string | null
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

export interface ChannelAiChat {
  id: string
  user_id: string
  rate_card_id: string | null
  analytics_snapshot_id: string | null
  title: string
  openai_conversation_id: string | null
  openai_last_response_id: string | null
  created_at: string
  updated_at: string
}

export interface ChannelAiMessage {
  id: string
  chat_id: string
  user_id: string
  role: 'creator' | 'ai'
  content: string
  reasoning_summary?: string | null
  created_at: string
}

export const NICHES = [
  'Personal Finance & Investing',
  'Business & Entrepreneurship',
  'Tech & Software',
  'Gaming',
  'Health & Fitness',
  'Beauty & Fashion',
  'Education & Tutorials',
  'Food & Cooking',
  'Travel',
  'Automotive',
  'DIY & Home Improvement',
  'Parenting & Family',
  'Lifestyle & Vlogging',
  'Entertainment & Comedy',
  'News & Politics',
  'Sports & Outdoors',
  'Science & Nature',
  'Music & Arts',
  'Other',
] as const

export const CSV_TYPES = [
  { key: 'content' as const, label: 'Top Content', required: true, confidence: 35, description: 'Average views per video — the primary input everything is priced off', studioPath: 'Analytics > Content' },
  { key: 'geography' as const, label: 'Top Geographies', required: true, confidence: 30, description: 'Where your viewers are — US/UK/CA audience can 2–3× your rate vs developing markets', studioPath: 'Analytics > Audience > Geography' },
  { key: 'demographics' as const, label: 'Audience Demographics', required: false, confidence: 20, description: 'Age and gender breakdown — 18–34 male with disposable income commands meaningfully higher rates', studioPath: 'Analytics > Audience > Age and gender' },
  { key: 'audience_growth' as const, label: 'Audience Size & Growth', required: false, confidence: 10, description: 'Subscriber trajectory and viewer loyalty — useful context but weakest rate signal', studioPath: 'Analytics > Audience > Audience size and growth' },
  { key: 'traffic_sources' as const, label: 'Traffic Sources', required: false, confidence: 5, description: 'How viewers find your content — organic search signals intent but brands rarely price off this', studioPath: 'Analytics > Reach > Traffic source' },
] as const
