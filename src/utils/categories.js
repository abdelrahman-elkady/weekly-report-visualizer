const CATEGORY_MAP = {
  implementation: { icon: 'code', label: 'Implementation', color: 'primary' },
  refactor:       { icon: 'build', label: 'Refactor', color: 'primary' },
  debugging:      { icon: 'bug_report', label: 'Debugging', color: 'error' },
  exploration:    { icon: 'explore', label: 'Exploration', color: 'secondary' },
  planning:       { icon: 'architecture', label: 'Planning', color: 'tertiary' },
  docs:           { icon: 'description', label: 'Docs', color: 'primary' },
  review:         { icon: 'rate_review', label: 'Review', color: 'secondary' },
  devops:         { icon: 'settings', label: 'DevOps', color: 'tertiary' },
  testing:        { icon: 'science', label: 'Testing', color: 'secondary' },
  meta:           { icon: 'tune', label: 'Meta', color: 'on-surface-variant' },
  ask:            { icon: 'chat', label: 'Ask', color: 'primary' },
  other:          { icon: 'more_horiz', label: 'Other', color: 'on-surface-variant' },
}

/** Color cycle for bars — cycles through these for category/repo charts */
const BAR_COLORS = [
  'var(--color-primary)',
  'var(--color-secondary)',
  'var(--color-tertiary)',
  'var(--color-primary-fixed-dim)',
  'var(--color-secondary-fixed-dim)',
  'var(--color-tertiary-fixed-dim)',
  'var(--color-outline)',
]

export function getCategoryInfo(category) {
  return CATEGORY_MAP[category] || CATEGORY_MAP.other
}

export function getBarColor(index) {
  return BAR_COLORS[index % BAR_COLORS.length]
}

export function getAllCategories() {
  return Object.keys(CATEGORY_MAP)
}
