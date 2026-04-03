import { isAiEnabledForUser } from '@/lib/ai-access'
import { createClient } from '@/lib/supabase-server'
import { getAnalyticsSnapshotContext } from '@/lib/analytics-context'
import { redirect, notFound } from 'next/navigation'
import type { AnalyticsSnapshot, RateCard, Profile } from '@/lib/types'
import RateCardClient from './client'

type AudienceSnapshot = {
  genderSplit: string
  usUkCaAuAudience: string
  ageGroupBreakdown: Array<{ label: string; value: string; isDominant: boolean }>
}

type PerformanceSnapshotItem = {
  label: string
  value: string
}

function toNumber(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value !== 'string') return 0

  const normalized = value.replace(/[$,%\s]/g, '').replace(/,/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function getAgeGroupSortValue(label: string) {
  const match = label.match(/(\d{1,2})/)
  return match ? Number(match[1]) : -1
}

function normalizeAgeGroupLabel(label: string) {
  const normalized = label.replace(/â€“/g, '-').replace(/–/g, '-').trim()
  const match = normalized.match(/(\d{1,2})/)
  if (!match) return normalized

  const startAge = Number(match[1])
  if (startAge <= 17) return '13-17'
  if (startAge <= 24) return '18-24'
  if (startAge <= 34) return '25-34'
  if (startAge <= 44) return '35-44'
  return '45+'
}

function buildAudienceSnapshot(csvUploads: Array<{ upload_type: string; parsed_data: unknown }> | null): AudienceSnapshot {
  const fallback = {
    genderSplit: 'Not available',
    usUkCaAuAudience: 'Not available',
    ageGroupBreakdown: [] as Array<{ label: string; value: string; isDominant: boolean }>,
  }

  if (!csvUploads || csvUploads.length === 0) {
    return fallback
  }

  const demographicsRows = csvUploads
    .filter(upload => upload.upload_type === 'demographics')
    .flatMap(upload => Array.isArray(upload.parsed_data) ? upload.parsed_data as Record<string, unknown>[] : [])

  const geographyRows = csvUploads
    .filter(upload => upload.upload_type === 'geography')
    .flatMap(upload => Array.isArray(upload.parsed_data) ? upload.parsed_data as Record<string, unknown>[] : [])

  let malePct = 0
  let femalePct = 0
  const ageGroups: Record<string, number> = {}

  for (const row of demographicsRows) {
    const gender = String(row['Viewer gender'] ?? '').trim()
    const age = normalizeAgeGroupLabel(String(row['Viewer age'] ?? '').trim())
    const viewsPct = toNumber(row['Views (%)'] ?? row['views (%)'])

    if (gender === 'Male') malePct += viewsPct
    if (gender === 'Female') femalePct += viewsPct
    if (age && viewsPct > 0) {
      ageGroups[age] = (ageGroups[age] ?? 0) + viewsPct
    }
  }

  const dominantAgeEntry = Object.entries(ageGroups).sort(([, a], [, b]) => b - a)[0]
  const ageGroupBreakdown = Object.entries(ageGroups)
    .sort(([labelA], [labelB]) => getAgeGroupSortValue(labelB) - getAgeGroupSortValue(labelA))
    .map(([label, value]) => ({
      label,
      value: `${value.toFixed(1)}%`,
      isDominant: dominantAgeEntry?.[0] === label,
    }))

  const filteredGeographyRows = geographyRows.filter(
    row => String(row['Geography'] ?? '').trim().toUpperCase() !== 'TOTAL'
  )
  const totalGeoViews = filteredGeographyRows.reduce((sum, row) => sum + toNumber(row['Views']), 0)
  const premiumEnglishViews = filteredGeographyRows
    .filter(row => {
      const geography = String(row['Geography'] ?? '').trim().toUpperCase()
      return geography === 'US' || geography === 'GB' || geography === 'UK' || geography === 'CA' || geography === 'AU'
    })
    .reduce((sum, row) => sum + toNumber(row['Views']), 0)

  return {
    genderSplit:
      malePct > 0 || femalePct > 0
        ? `${Math.round(malePct)}% male / ${Math.round(femalePct)}% female`
        : fallback.genderSplit,
    usUkCaAuAudience: totalGeoViews > 0
      ? `${Math.round((premiumEnglishViews / totalGeoViews) * 100)}%`
      : fallback.usUkCaAuAudience,
    ageGroupBreakdown: ageGroupBreakdown.length > 0
      ? ageGroupBreakdown
      : fallback.ageGroupBreakdown,
  }
}

function buildPerformanceSnapshot(
  csvUploads: Array<{ upload_type: string; parsed_data: unknown }> | null
): PerformanceSnapshotItem[] {
  if (!csvUploads || csvUploads.length === 0) {
    return []
  }

  const contentRows = csvUploads
    .filter(upload => upload.upload_type === 'content')
    .flatMap(upload => Array.isArray(upload.parsed_data) ? upload.parsed_data as Record<string, unknown>[] : [])
    .filter(row => String(row['Video title'] ?? '').trim() !== '')
    .slice(0, 10)

  const audienceGrowthRows = csvUploads
    .filter(upload => upload.upload_type === 'audience_growth')
    .flatMap(upload => Array.isArray(upload.parsed_data) ? upload.parsed_data as Record<string, unknown>[] : [])

  const trafficSourceRows = csvUploads
    .filter(upload => upload.upload_type === 'traffic_sources')
    .flatMap(upload => Array.isArray(upload.parsed_data) ? upload.parsed_data as Record<string, unknown>[] : [])
    .filter(row => String(row['Traffic source'] ?? '').trim().toLowerCase() !== 'total')

  const candidates: Array<PerformanceSnapshotItem & { score: number }> = []

  if (contentRows.length > 0) {
    const views = contentRows.map(row => toNumber(row['Views'] ?? row['views'])).filter(value => value > 0)
    const averageViews = views.length > 0
      ? Math.round(views.reduce((sum, value) => sum + value, 0) / views.length)
      : 0
    const medianViews = views.length === 0
      ? 0
      : (() => {
          const sorted = [...views].sort((a, b) => a - b)
          const mid = Math.floor(sorted.length / 2)
          return sorted.length % 2 === 0
            ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
            : sorted[mid]
        })()

    const headlineViews = Math.max(averageViews, medianViews)
    const headlineViewsLabel = averageViews >= medianViews ? 'Average Views / Video' : 'Median Views / Video'

    if (headlineViews >= 1_000) {
      candidates.push({
        label: headlineViewsLabel,
        value: headlineViews.toLocaleString(),
        score: headlineViews,
      })
    }

    const ctrValues = contentRows
      .map(row => toNumber(row['Impressions click-through rate (%)'] ?? row['impressions click-through rate (%)']))
      .filter(value => value > 0)
    const avgCtr = ctrValues.length > 0
      ? ctrValues.reduce((sum, value) => sum + value, 0) / ctrValues.length
      : 0

    if (avgCtr >= 5) {
      candidates.push({
        label: 'Average CTR',
        value: `${avgCtr.toFixed(1)}%`,
        score: avgCtr * 12_000,
      })
    }

    const topVideoViews = contentRows.reduce((best, row) => {
      const value = toNumber(row['Views'] ?? row['views'])
      return Math.max(best, value)
    }, 0)

    if (topVideoViews >= Math.max(10_000, medianViews * 1.75)) {
      candidates.push({
        label: 'Top Video Views',
        value: topVideoViews.toLocaleString(),
        score: topVideoViews * 0.9,
      })
    }

    const totalViews = contentRows.reduce((sum, row) => sum + toNumber(row['Views'] ?? row['views']), 0)
    const totalSubscribersGained = contentRows.reduce((sum, row) => sum + toNumber(row['Subscribers'] ?? row['subscribers']), 0)
    const subsPerView = totalViews > 0 ? totalSubscribersGained / totalViews : 0

    if (subsPerView >= 0.002) {
      candidates.push({
        label: 'Subscriber Conversion',
        value: `${(subsPerView * 100).toFixed(2)} subs / 100 views`,
        score: subsPerView * 1_000_000,
      })
    }
  }

  if (audienceGrowthRows.length > 0) {
    const lastRow = audienceGrowthRows[audienceGrowthRows.length - 1]

    if (lastRow['28-day regular viewers'] !== undefined) {
      const newViewers = toNumber(lastRow['28-day new viewers'])
      const casualViewers = toNumber(lastRow['28-day casual viewers'])
      const regularViewers = toNumber(lastRow['28-day regular viewers'])
      const totalViewers = newViewers + casualViewers + regularViewers
      const loyaltyPct = totalViewers > 0 ? (regularViewers / totalViewers) * 100 : 0

      if (loyaltyPct >= 15) {
        candidates.push({
          label: 'Regular Viewer Share',
          value: `${Math.round(loyaltyPct)}%`,
          score: loyaltyPct * 7_500,
        })
      }
    } else if (lastRow['Monthly audience'] !== undefined) {
      const monthlyAudience = toNumber(lastRow['Monthly audience'])
      if (monthlyAudience >= 10_000) {
        candidates.push({
          label: 'Monthly Audience',
          value: monthlyAudience.toLocaleString(),
          score: monthlyAudience * 0.6,
        })
      }
    }
  }

  if (trafficSourceRows.length > 0) {
    const totalViews = trafficSourceRows.reduce((sum, row) => sum + toNumber(row['Views']), 0)
    const searchViews = trafficSourceRows
      .filter(row => String(row['Traffic source'] ?? '').trim().toLowerCase().includes('search'))
      .reduce((sum, row) => sum + toNumber(row['Views']), 0)
    const searchPct = totalViews > 0 ? (searchViews / totalViews) * 100 : 0

    if (searchPct >= 20) {
      candidates.push({
        label: 'Search Traffic Share',
        value: `${Math.round(searchPct)}%`,
        score: searchPct * 5_500,
      })
    }
  }

  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ label, value }) => ({ label, value }))
}

export default async function RateCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: rateCard }, { data: profile }, { data: snapshots }] = await Promise.all([
    supabase.from('rate_cards').select('*').eq('id', id).eq('user_id', user.id).single(),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('analytics_snapshots').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
  ])

  if (!rateCard) notFound()

  const analyticsContext = await getAnalyticsSnapshotContext({
    supabase,
    snapshotId: (rateCard as RateCard).analytics_snapshot_id,
    userId: user.id,
  })
  const snapshotItems = (snapshots || []) as AnalyticsSnapshot[]
  const csvUploads = Object.entries(analyticsContext?.csvData || {}).flatMap(([uploadType, rows]) => ({
    upload_type: uploadType,
    parsed_data: rows,
  }))

  const audienceSnapshot = buildAudienceSnapshot(csvUploads ?? null)
  const performanceSnapshot = buildPerformanceSnapshot(csvUploads ?? null)
  const aiEnabled = await isAiEnabledForUser(supabase, user.id)

  return (
    <RateCardClient
      aiEnabled={aiEnabled}
      rateCard={rateCard as RateCard}
      profile={(profile as Profile) ?? null}
      availableSnapshots={snapshotItems}
      snapshotName={analyticsContext?.snapshot.name ?? null}
      audienceSnapshot={audienceSnapshot}
      performanceSnapshot={performanceSnapshot}
    />
  )
}
