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

export interface OnboardingState {
  user_id: string
  started_at: string
  completed_at: string | null
  dismissed_at: string | null
  last_seen_at: string | null
  updated_at: string | null
  welcome_completed: boolean
  welcome_path: 'price_my_channel' | 'negotiate_a_brand_deal' | 'just_exploring' | null
  has_export_ready: boolean | null
  snapshot_created: boolean
  snapshot_created_at: string | null
  rate_card_created: boolean
  rate_card_created_at: string | null
  deal_created: boolean
  deal_created_at: string | null
  first_negotiation_message: boolean
  first_negotiation_message_at: string | null
  first_channel_advisor_message: boolean
  first_channel_advisor_message_at: string | null
  checklist_dismissed: boolean
  route_hints_dismissed: boolean
  dismissed_hints: Record<string, string>
  checklist_state: Partial<Record<'upload_analytics' | 'generate_rate_card' | 'start_deal' | 'ask_channel_ai', {
    dismissed?: boolean
    opened_at?: string | null
  }>>
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
  deal_type_custom: string | null
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
  { key: 'content' as const, label: 'Content Breakdown', required: true, confidence: 40, description: 'Per-video views, watch time, and revenue — the primary input everything is priced off', studioPath: 'Analytics > Content' },
  { key: 'geography' as const, label: 'Audience Geography', required: true, confidence: 35, description: 'Where your viewers are — US/UK/CA audience can 2–3× your rate vs developing markets', studioPath: 'Analytics > Audience > Geography' },
  { key: 'age' as const, label: 'Audience Age', required: false, confidence: 15, description: 'Age distribution — 18–34 with disposable income commands meaningfully higher rates', studioPath: 'Analytics > Audience > Age and gender' },
  { key: 'gender' as const, label: 'Audience Gender', required: false, confidence: 10, description: 'Gender split — useful demographic context for brand matching', studioPath: 'Analytics > Audience > Age and gender' },
] as const
