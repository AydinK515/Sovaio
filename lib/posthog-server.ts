import { randomUUID } from 'node:crypto'
import { PostHog } from 'posthog-node'
import type { AnalyticsEventProperties, PostHogEventName } from '@/lib/posthog-events'

export type ServerAnalyticsEventProperties = AnalyticsEventProperties

export type AiGenerationCaptureInput = {
  client?: PostHog | null
  distinctId: string
  model: string
  provider?: string
  traceId?: string
  input: unknown
  output?: unknown
  latencyMs?: number
  inputTokens?: number | null
  outputTokens?: number | null
  totalTokens?: number | null
  totalCostUsd?: number | null
  isError?: boolean
  error?: string | null
  properties?: Record<string, unknown>
}

function getPostHogServerConfig() {
  const apiKey =
    process.env.POSTHOG_KEY ||
    process.env.NEXT_PUBLIC_POSTHOG_KEY ||
    null
  const host =
    process.env.POSTHOG_HOST ||
    process.env.NEXT_PUBLIC_POSTHOG_HOST ||
    null

  if (!apiKey || !host) {
    return null
  }

  return { apiKey, host }
}

export function isPostHogServerEnabled() {
  return Boolean(getPostHogServerConfig())
}

export function createPostHogServerClient() {
  const config = getPostHogServerConfig()

  if (!config) {
    return null
  }

  return new PostHog(config.apiKey, {
    host: config.host,
    flushAt: 1,
    flushInterval: 0,
  })
}

function sanitizeProperties(properties?: Record<string, unknown>) {
  if (!properties) {
    return undefined
  }

  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined)
  )
}

export async function captureServerEvent(input: {
  client?: PostHog | null
  distinctId: string
  event: PostHogEventName
  properties?: ServerAnalyticsEventProperties
}) {
  const client = input.client ?? createPostHogServerClient()

  if (!client) {
    return
  }

  client.capture({
    distinctId: input.distinctId,
    event: input.event,
    properties: sanitizeProperties(input.properties),
  })

  if (!input.client) {
    await shutdownPostHog(client)
  }
}

export async function captureAiGeneration(input: AiGenerationCaptureInput) {
  const client = input.client ?? createPostHogServerClient()

  if (!client) {
    return null
  }

  const traceId = input.traceId ?? randomUUID()
  client.capture({
    distinctId: input.distinctId,
    event: '$ai_generation',
    properties: sanitizeProperties({
      $ai_trace_id: traceId,
      $ai_model: input.model,
      $ai_provider: input.provider ?? 'openai',
      $ai_input: input.input,
      $ai_output_choices: input.output,
      $ai_latency: input.latencyMs != null ? input.latencyMs / 1000 : undefined,
      $ai_input_tokens: input.inputTokens ?? undefined,
      $ai_output_tokens: input.outputTokens ?? undefined,
      $ai_total_tokens: input.totalTokens ?? undefined,
      $ai_total_cost_usd: input.totalCostUsd ?? undefined,
      $ai_is_error: input.isError ?? false,
      $ai_error: input.error ?? undefined,
      ...input.properties,
    }),
  })

  if (!input.client) {
    await shutdownPostHog(client)
  }
  return traceId
}

export async function shutdownPostHog(client: PostHog | null | undefined) {
  if (!client) {
    return
  }

  try {
    await client.shutdown()
  } catch (error) {
    console.error('Failed to flush PostHog events', error)
  }
}
