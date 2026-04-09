export function buildCsvSummary(csvData: Record<string, Record<string, unknown>[]>): string {
  const parts: string[] = []

  // --- Content performance ---
  if (csvData.content && csvData.content.length > 0) {
    const rows = csvData.content.filter(row => String(row['Video title'] ?? '').trim() !== '')

    const totalViews = rows.reduce((sum, row) => sum + toNumber(row['Views'] ?? row['views']), 0)
    const totalWatchHours = rows.reduce(
      (sum, row) => sum + toNumber(row['Watch time (hours)'] ?? row['watch time (hours)']),
      0,
    )
    const totalSubscribersGained = rows.reduce(
      (sum, row) => sum + toNumber(row['Subscribers'] ?? row['subscribers']),
      0,
    )
    const totalImpressions = rows.reduce(
      (sum, row) => sum + toNumber(row['Impressions'] ?? row['impressions']),
      0,
    )
    const ctrValues = rows
      .map(row =>
        toNumber(
          row['Impressions click-through rate (%)'] ??
            row['impressions click-through rate (%)'],
        ),
      )
      .filter(value => value > 0)

    const viewCounts = rows.map(row => toNumber(row['Views'] ?? row['views']))
    const viewDurationSeconds = rows
      .map(row => durationToSeconds(row['Average view duration'] ?? row['average view duration']))
      .filter(value => value > 0)
    const avgViews = rows.length > 0 ? Math.round(totalViews / rows.length) : 0
    const medianViews = medianOfSorted(viewCounts)
    const outlierSkew = rows.length >= 3 && avgViews > medianViews * 2
    const avgWatchHoursPerVideo = rows.length > 0 ? (totalWatchHours / rows.length).toFixed(1) : '0'
    const avgViewDuration =
      viewDurationSeconds.length > 0
        ? formatDuration(
            Math.round(
              viewDurationSeconds.reduce((sum, value) => sum + value, 0) /
                viewDurationSeconds.length,
            ),
          )
        : null
    const avgCtr =
      ctrValues.length > 0
        ? (ctrValues.reduce((sum, value) => sum + value, 0) / ctrValues.length).toFixed(1)
        : null
    const avgImpressions =
      totalImpressions > 0 && rows.length > 0 ? Math.round(totalImpressions / rows.length) : null
    // Subscriber gain per view: proxy for audience engagement quality.
    const subsPerView = totalViews > 0 ? totalSubscribersGained / totalViews : null

    const topVideo = rows.reduce<Record<string, unknown> | null>((best, row) => {
      if (!best) return row
      return toNumber(row['Views'] ?? row['views']) >
        toNumber(best['Views'] ?? best['views'])
        ? row
        : best
    }, null)

    const contentPerformanceLine =
      `Content performance (${rows.length} videos): median ${medianViews.toLocaleString()} views/video` +
      (outlierSkew
        ? ` (avg ${avgViews.toLocaleString()} - skewed high by outlier, use median for rate calc)`
        : `, avg ${avgViews.toLocaleString()}`) +
      `, avg ${avgWatchHoursPerVideo}h watch time/video` +
      (avgViewDuration ? `, avg view duration ${avgViewDuration}` : '') +
      `, ${Math.round(totalWatchHours).toLocaleString()} total watch hours, ${totalSubscribersGained.toLocaleString()} subscribers gained` +
      (avgCtr ? `, avg CTR ${avgCtr}%` : '') +
      (avgImpressions ? `, avg ${avgImpressions.toLocaleString()} impressions/video` : '') +
      (subsPerView !== null ? `, ${subsPerView.toFixed(4)} subs gained per view` : '') +
      '.'

    parts.push(contentPerformanceLine)

    if (topVideo) {
      const topViews = toNumber(topVideo['Views'] ?? topVideo['views'])
      const topWatchHours = toNumber(
        topVideo['Watch time (hours)'] ?? topVideo['watch time (hours)'],
      )
      const topCtr = toNumber(
        topVideo['Impressions click-through rate (%)'] ??
          topVideo['impressions click-through rate (%)'],
      )
      parts.push(
        `Top video: "${String(topVideo['Video title'])}" - ${topViews.toLocaleString()} views, ${topWatchHours.toFixed(1)}h watch time${topCtr > 0 ? `, ${topCtr}% CTR` : ''}.`,
      )
    }
  }

  // --- Audience size & growth ---
  if (csvData.audience_growth && csvData.audience_growth.length > 0) {
    const rows = csvData.audience_growth
    const firstRow = rows[0]
    const lastRow = rows[rows.length - 1]

    if (lastRow['28-day new viewers'] !== undefined) {
      const newViewers = toNumber(lastRow['28-day new viewers'])
      const casualViewers = toNumber(lastRow['28-day casual viewers'])
      const regularViewers = toNumber(lastRow['28-day regular viewers'])
      const total = newViewers + casualViewers + regularViewers
      const returnRate = total > 0 ? ((1 - newViewers / total) * 100).toFixed(0) : '0'
      const loyaltyRate = total > 0 ? ((regularViewers / total) * 100).toFixed(0) : '0'
      parts.push(
        `Audience loyalty (28-day rolling): ${newViewers.toLocaleString()} new viewers, ${casualViewers.toLocaleString()} casual, ${regularViewers.toLocaleString()} regular - ${returnRate}% returning, ${loyaltyRate}% loyal/regular viewers.`,
      )
    } else if (lastRow['Monthly audience'] !== undefined) {
      const latestAudience = toNumber(lastRow['Monthly audience'])
      const earliestAudience = toNumber(firstRow['Monthly audience'])
      const growth = latestAudience - earliestAudience
      parts.push(
        `Monthly unique audience: ${latestAudience.toLocaleString()} viewers${growth !== 0 ? ` (${growth >= 0 ? '+' : ''}${growth.toLocaleString()} over the period)` : ''}.`,
      )
    } else if (lastRow['Subscribers'] !== undefined) {
      const latest = toNumber(lastRow['Subscribers'])
      const earliest = toNumber(firstRow['Subscribers'])
      const net = latest - earliest
      const periodDays = rows.length
      const dailyRate = periodDays > 0 ? (net / periodDays).toFixed(1) : '0'
      parts.push(
        `Subscriber trajectory: ${latest.toLocaleString()} subscribers, net ${net >= 0 ? '+' : ''}${net.toLocaleString()} over ${periodDays} days (~${dailyRate}/day).`,
      )
    }
  }

  // --- Demographics (age + gender stored as separate types; legacy 'demographics' key also handled) ---
  {
    const ageRows = csvData.age ?? []
    const genderRows = csvData.gender ?? []
    const legacyRows = csvData.demographics ?? []

    const ageGroups: Record<string, number> = {}
    let malePct = 0
    let femalePct = 0

    for (const row of [...ageRows, ...legacyRows]) {
      const age = String(row['Viewer age'] ?? '').trim()
      const viewsPct = toNumber(row['Views (%)'] ?? row['views (%)'])
      if (age) ageGroups[age] = viewsPct
    }

    for (const row of [...genderRows, ...legacyRows]) {
      const gender = String(row['Viewer gender'] ?? '').trim()
      const viewsPct = toNumber(row['Views (%)'] ?? row['views (%)'])
      if (gender === 'Male') malePct = viewsPct
      if (gender === 'Female') femalePct = viewsPct
    }

    const hasAge = Object.keys(ageGroups).length > 0
    const hasGender = malePct > 0 || femalePct > 0

    if (hasAge || hasGender) {
      const coreAudience1834 =
        (ageGroups['18-24 years'] ?? 0) +
        (ageGroups['18–24 years'] ?? 0) +
        (ageGroups['25-34 years'] ?? 0) +
        (ageGroups['25–34 years'] ?? 0)

      const topAgeGroups = Object.entries(ageGroups)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([age, pct]) => `${age}: ${pct.toFixed(1)}%`)
        .join(', ')

      const genderSplit = hasGender
        ? ` (${malePct.toFixed(0)}% male / ${femalePct.toFixed(0)}% female)`
        : ''

      const agePart = hasAge ? `top age groups - ${topAgeGroups}` : ''
      const core1834Part = coreAudience1834 > 0 ? `; 18-34 combined: ${coreAudience1834.toFixed(0)}%` : ''

      parts.push(`Demographics:${agePart ? ` ${agePart}` : ''}${genderSplit}${core1834Part}.`)
    }
  }

  // --- Geography ---
  if (csvData.geography && csvData.geography.length > 0) {
    const rows = csvData.geography.filter(
      row => String(row['Geography'] ?? '').trim().toUpperCase() !== 'TOTAL',
    )
    const totalViews = rows.reduce((sum, row) => sum + toNumber(row['Views']), 0)

    const tier1Codes = new Set(['US', 'GB', 'CA', 'AU', 'NZ'])
    const tier1Views = rows
      .filter(row => tier1Codes.has(String(row['Geography'] ?? '').trim().toUpperCase()))
      .reduce((sum, row) => sum + toNumber(row['Views']), 0)
    const tier1Pct = totalViews > 0 ? ((tier1Views / totalViews) * 100).toFixed(0) : '0'

    const topCountries = rows
      .sort((a, b) => toNumber(b['Views']) - toNumber(a['Views']))
      .slice(0, 5)
      .map(row => {
        const geo = String(row['Geography'] ?? '')
        const views = toNumber(row['Views'])
        const pct = totalViews > 0 ? ` (${((views / totalViews) * 100).toFixed(0)}%)` : ''
        return `${geo}${pct}`
      })
      .join(', ')

    parts.push(
      `Geography: top countries - ${topCountries}; ${tier1Pct}% from US/UK/CA/AU/NZ (premium CPM markets).`,
    )
  }

  // --- Traffic sources ---
  if (csvData.traffic_sources && csvData.traffic_sources.length > 0) {
    const rows = csvData.traffic_sources.filter(
      row => String(row['Traffic source'] ?? '').trim().toLowerCase() !== 'total',
    )
    const totalViews = rows.reduce((sum, row) => sum + toNumber(row['Views']), 0)

    const topSources = rows
      .sort((a, b) => toNumber(b['Views']) - toNumber(a['Views']))
      .slice(0, 4)
      .map(row => {
        const source = String(row['Traffic source'] ?? '')
        const views = toNumber(row['Views'])
        const pct = totalViews > 0 ? ` ${((views / totalViews) * 100).toFixed(0)}%` : ''
        const ctr = toNumber(row['Impressions click-through rate (%)'])
        return `${source}${pct}${ctr > 0 ? ` (${ctr}% CTR)` : ''}`
      })
      .join(', ')

    const searchViews = rows
      .filter(row => String(row['Traffic source'] ?? '').toLowerCase().includes('search'))
      .reduce((sum, row) => sum + toNumber(row['Views']), 0)
    const searchPct = totalViews > 0 ? ((searchViews / totalViews) * 100).toFixed(0) : '0'

    parts.push(
      `Traffic sources: ${topSources}. Search traffic: ${searchPct}% (higher = stronger SEO/intent-driven audience).`,
    )
  }

  // --- Retention (legacy support) ---
  if (csvData.retention && csvData.retention.length > 0) {
    const sample = csvData.retention.slice(0, 3).map(summarizeRow).join('; ')
    parts.push(`Retention data: ${sample}`)
  }

  return parts.length > 0 ? `YouTube Analytics data:\n${parts.join('\n')}` : ''
}

export function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value !== 'string') return 0

  const normalized = value.replace(/[$,%\s]/g, '').replace(/,/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function durationToSeconds(value: unknown): number {
  if (typeof value !== 'string') return 0

  const trimmed = value.trim()
  if (!trimmed) return 0

  const parts = trimmed.split(':').map(part => Number(part))
  if (parts.some(part => !Number.isFinite(part))) return 0

  if (parts.length === 2) {
    const [minutes, seconds] = parts
    return minutes * 60 + seconds
  }

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts
    return hours * 3600 + minutes * 60 + seconds
  }

  return 0
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function medianOfSorted(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

function summarizeRow(row: Record<string, unknown>) {
  return Object.entries(row)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(', ')
}
