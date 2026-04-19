const REQUIRED_TOP_LEVEL = [
  'generatedAt', 'windowStart', 'windowEnd', 'user', 'targetBranches',
  'weekStart', 'workweekDays', 'totals', 'tickets', 'sessions', 'prs', 'reviewedPrs'
]

const REQUIRED_TOTALS = [
  'sessions', 'prs', 'reviewedPrs', 'categories', 'sessionsByRepo',
  'prsByRepo', 'uncorrelatedSessions', 'minutesByRepo', 'categoryMinutes',
  'activeMinutesByRepo', 'activeCategoryMinutes',
  'idleMinutesByRepo', 'idleCategoryMinutes',
]

const REQUIRED_SESSION = [
  'sessionId', 'filePath', 'cwd', 'repo', 'repoShort', 'gitBranch',
  'firstPrompt', 'firstPromptShort', 'createdAt', 'lastActivityAt', 'modifiedAt',
  'durationMin', 'activeDurationMin',
  'idleSec', 'userPauseCount', 'longestUserPauseSec',
  'gaps', 'segments',
  'needsActiveReview', 'activeReviewReason',
  'userMsgCount', 'assistantMsgCount', 'toolCounts',
  'filesTouched', 'filesTouchedRelative', 'filesTouchedCount',
  'bashCmdSample', 'userMessages', 'assistantTexts',
  'jiraIds', 'category',
  'needsReview', 'reviewReason',
  'correlatedPRs',
]

const REQUIRED_DAYBUCKET = ['minutes', 'activeMinutes', 'idleMinutes', 'sessions', 'categories']
const REQUIRED_GAP = ['startedAt', 'endedAt', 'sec', 'kind', 'creditedSec']
const REQUIRED_SEGMENT = ['startedAt', 'endedAt', 'sec', 'messageCount']

const OLD_SCHEMA_MESSAGE =
  'This report was generated with an older schema (pre-v1.2.0). ' +
  'Please regenerate it with the latest progress-report-skill — the active-duration math has changed ' +
  'and mixing old/new reports produces inconsistent numbers.'

function looksLikeOldSchema(data) {
  const t = data.totals
  if (t && typeof t === 'object' && !('activeMinutesByRepo' in t)) return true
  if (Array.isArray(data.sessions)) {
    for (const s of data.sessions) {
      if (!s || typeof s !== 'object') continue
      if (!('gaps' in s) || !('segments' in s)) return true
    }
  }
  return false
}

/**
 * Validate a parsed report object.
 * Returns { valid: true } or { valid: false, errors: string[] }
 */
export function validateReport(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Report must be a JSON object'] }
  }

  // Check top-level required fields
  const topErrors = []
  for (const field of REQUIRED_TOP_LEVEL) {
    if (!(field in data)) topErrors.push(`Missing required field: "${field}"`)
  }
  for (const field of ['tickets', 'sessions', 'prs', 'reviewedPrs', 'targetBranches']) {
    if (field in data && !Array.isArray(data[field])) {
      topErrors.push(`"${field}" must be an array`)
    }
  }
  if (topErrors.length) return { valid: false, errors: topErrors }

  // Old-schema short-circuit: the top level parses, but v1.2-required structures are missing.
  if (looksLikeOldSchema(data)) {
    return { valid: false, errors: [OLD_SCHEMA_MESSAGE] }
  }

  const errors = []

  // Totals
  if (typeof data.totals !== 'object' || data.totals === null) {
    errors.push('"totals" must be an object')
  } else {
    for (const field of REQUIRED_TOTALS) {
      if (!(field in data.totals)) {
        errors.push(`Missing required field: "totals.${field}"`)
      }
    }
    if (data.totals.minutesByDay && typeof data.totals.minutesByDay === 'object') {
      for (const [dateKey, bucket] of Object.entries(data.totals.minutesByDay)) {
        if (!bucket || typeof bucket !== 'object') {
          errors.push(`"totals.minutesByDay[${dateKey}]" must be an object`)
          continue
        }
        for (const field of REQUIRED_DAYBUCKET) {
          if (!(field in bucket)) {
            errors.push(`Missing required field: "totals.minutesByDay[${dateKey}].${field}"`)
          }
        }
      }
    }
  }

  // Sessions
  if (Array.isArray(data.sessions)) {
    data.sessions.forEach((session, i) => {
      if (!session || typeof session !== 'object') {
        errors.push(`"sessions[${i}]" must be an object`)
        return
      }
      for (const field of REQUIRED_SESSION) {
        if (!(field in session)) {
          errors.push(`Missing required field: "sessions[${i}].${field}"`)
        }
      }
      if (Array.isArray(session.gaps)) {
        session.gaps.forEach((gap, gi) => {
          if (!gap || typeof gap !== 'object') {
            errors.push(`"sessions[${i}].gaps[${gi}]" must be an object`)
            return
          }
          for (const field of REQUIRED_GAP) {
            if (!(field in gap)) {
              errors.push(`Missing required field: "sessions[${i}].gaps[${gi}].${field}"`)
            }
          }
        })
      } else if ('gaps' in session) {
        errors.push(`"sessions[${i}].gaps" must be an array`)
      }
      if (Array.isArray(session.segments)) {
        session.segments.forEach((seg, si) => {
          if (!seg || typeof seg !== 'object') {
            errors.push(`"sessions[${i}].segments[${si}]" must be an object`)
            return
          }
          for (const field of REQUIRED_SEGMENT) {
            if (!(field in seg)) {
              errors.push(`Missing required field: "sessions[${i}].segments[${si}].${field}"`)
            }
          }
        })
      } else if ('segments' in session) {
        errors.push(`"sessions[${i}].segments" must be an array`)
      }
    })
  }

  return errors.length > 0
    ? { valid: false, errors }
    : { valid: true }
}
