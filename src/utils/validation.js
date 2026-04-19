import { IDLE_KINDS } from './format.js'

const REQUIRED_TOP_LEVEL = [
  'generatedAt', 'windowStart', 'windowEnd', 'user', 'targetBranches',
  'weekStart', 'workweekDays', 'totals', 'tickets', 'sessions', 'prs', 'reviewedPrs'
]

const REQUIRED_TOTALS = [
  'sessions', 'prs', 'reviewedPrs', 'categories', 'sessionsByRepo',
  'prsByRepo', 'uncorrelatedSessions', 'minutesByRepo', 'categoryMinutes',
  'activeMinutesByRepo', 'activeCategoryMinutes',
  'idleMinutesByRepo', 'idleCategoryMinutes'
]

const REQUIRED_SESSION = [
  'sessionId', 'filePath', 'cwd', 'repo', 'repoShort', 'gitBranch',
  'firstPrompt', 'firstPromptShort', 'createdAt', 'lastActivityAt',
  'modifiedAt', 'durationMin', 'activeDurationMin',
  'idleSec', 'idleBreakdownSec', 'userPauseCount', 'longestUserPauseSec',
  'gaps', 'segments', 'needsActiveReview', 'activeReviewReason',
  'userMsgCount', 'assistantMsgCount', 'toolCounts',
  'filesTouched', 'filesTouchedRelative', 'filesTouchedCount',
  'bashCmdSample', 'userMessages', 'assistantTexts', 'jiraIds',
  'category', 'needsReview', 'reviewReason', 'correlatedPRs'
]

const REQUIRED_DAYBUCKET = ['minutes', 'activeMinutes', 'idleMinutes', 'sessions', 'categories']

const V2_ERROR_HINT =
  'This visualizer requires a v2.0.0 schema report. Re-run the progress-report-skill (`generate.py`) to produce a compatible report.'

/**
 * Validate a parsed report object against the v2.0.0 schema.
 * Returns { valid: true } or { valid: false, errors: string[] }.
 * When invalid, the last element of errors is always V2_ERROR_HINT.
 */
export function validateReport(data) {
  const errors = []

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Report must be a JSON object'] }
  }

  for (const field of REQUIRED_TOP_LEVEL) {
    if (!(field in data)) {
      errors.push(`Missing required field: "${field}"`)
    }
  }

  for (const field of ['tickets', 'sessions', 'prs', 'reviewedPrs', 'targetBranches']) {
    if (field in data && !Array.isArray(data[field])) {
      errors.push(`"${field}" must be an array`)
    }
  }

  if (data.totals) {
    if (typeof data.totals !== 'object') {
      errors.push('"totals" must be an object')
    } else {
      for (const field of REQUIRED_TOTALS) {
        if (!(field in data.totals)) {
          errors.push(`Missing required field: "totals.${field}"`)
        }
      }
      if (data.totals.minutesByDay && typeof data.totals.minutesByDay === 'object') {
        const sampleKey = Object.keys(data.totals.minutesByDay)[0]
        if (sampleKey) {
          const bucket = data.totals.minutesByDay[sampleKey]
          for (const field of REQUIRED_DAYBUCKET) {
            if (bucket && !(field in bucket)) {
              errors.push(`Missing required field: "totals.minutesByDay[${sampleKey}].${field}"`)
            }
          }
        }
      }
    }
  }

  if (Array.isArray(data.sessions) && data.sessions.length > 0) {
    const sample = data.sessions[0]
    for (const field of REQUIRED_SESSION) {
      if (!(field in sample)) {
        errors.push(`Missing required field: "sessions[0].${field}"`)
      }
    }
    if (sample && sample.idleBreakdownSec && typeof sample.idleBreakdownSec === 'object') {
      for (const k of IDLE_KINDS) {
        if (!(k in sample.idleBreakdownSec)) {
          errors.push(`Missing required field: "sessions[0].idleBreakdownSec.${k}"`)
        }
      }
    } else if (sample && 'idleBreakdownSec' in sample) {
      errors.push('"sessions[0].idleBreakdownSec" must be an object')
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors: [...errors, V2_ERROR_HINT] }
  }
  return { valid: true }
}
