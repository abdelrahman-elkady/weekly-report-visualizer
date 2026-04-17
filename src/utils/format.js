/** < 60m: "42m" | 1-24h: "3h 22m" | > 24h: "2d 16h" */
export function formatDuration(minutes) {
  if (minutes == null || minutes < 0) return '0m'
  const totalMin = Math.round(minutes)
  if (totalMin < 60) return `${totalMin}m`
  const hours = Math.floor(totalMin / 60)
  const mins = totalMin % 60
  if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`
}

const IDLE_RATIO_THRESHOLD = 0.4
const MIN_DURATION_FOR_IDLE_CHECK = 10

export function isHighIdleRatio(durationMin, activeDurationMin) {
  if (durationMin == null || activeDurationMin == null) return false
  if (durationMin <= MIN_DURATION_FOR_IDLE_CHECK) return false
  return (activeDurationMin / durationMin) < IDLE_RATIO_THRESHOLD
}

export function formatIdleRatio(durationMin, activeDurationMin) {
  if (!durationMin) return '0%'
  return Math.round(((activeDurationMin ?? 0) / durationMin) * 100) + '%'
}

export function formatDate(isoString) {
  if (!isoString) return 'N/A'
  const d = new Date(isoString)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateShort(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatUtcDateShort(key) {
  if (!key) return ''
  return new Date(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function formatUtcWeekdayShort(key) {
  if (!key) return ''
  return new Date(key).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
}

export function utcDateKey(iso) {
  return iso ? new Date(iso).toISOString().slice(0, 10) : ''
}

export function formatNumber(n) {
  if (n == null) return '0'
  return n.toLocaleString('en-US')
}

export function truncateId(id) {
  if (!id) return ''
  return id.substring(0, 8)
}

export function truncateText(text, maxLen = 60) {
  if (!text) return ''
  if (text.length <= maxLen) return text
  return text.substring(0, maxLen) + '...'
}

export function minutesToHours(minutes) {
  return Math.round((minutes / 60) * 10) / 10
}

/** YYYY-MM-DD key for date grouping */
export function formatDateKey(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** DD/MM/YYYY label for date separators */
export function formatDayLabel(isoString) {
  if (!isoString) return ''
  return new Date(isoString).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatDateRange(start, end) {
  if (!start || !end) return ''
  const s = new Date(start)
  const e = new Date(end)
  const sStr = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const eStr = e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${sStr} - ${eStr}`
}
