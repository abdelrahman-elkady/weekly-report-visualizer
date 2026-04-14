const REQUIRED_TOP_LEVEL = [
  'generatedAt', 'windowStart', 'windowEnd', 'user', 'targetBranches',
  'weekStart', 'workweekDays', 'totals', 'tickets', 'sessions', 'prs', 'reviewedPrs'
]

const REQUIRED_TOTALS = [
  'sessions', 'prs', 'reviewedPrs', 'categories', 'sessionsByRepo',
  'prsByRepo', 'uncorrelatedSessions', 'minutesByRepo', 'categoryMinutes'
]

/**
 * Validate a parsed report object.
 * Returns { valid: true } or { valid: false, errors: string[] }
 */
export function validateReport(data) {
  const errors = []

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Report must be a JSON object'] }
  }

  // Check top-level required fields
  for (const field of REQUIRED_TOP_LEVEL) {
    if (!(field in data)) {
      errors.push(`Missing required field: "${field}"`)
    }
  }

  // Check array types
  for (const field of ['tickets', 'sessions', 'prs', 'reviewedPrs', 'targetBranches']) {
    if (field in data && !Array.isArray(data[field])) {
      errors.push(`"${field}" must be an array`)
    }
  }

  // Check totals subfields
  if (data.totals) {
    if (typeof data.totals !== 'object') {
      errors.push('"totals" must be an object')
    } else {
      for (const field of REQUIRED_TOTALS) {
        if (!(field in data.totals)) {
          errors.push(`Missing required field: "totals.${field}"`)
        }
      }
    }
  }

  return errors.length > 0
    ? { valid: false, errors }
    : { valid: true }
}
