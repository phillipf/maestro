import type { SkillItemRow, SkillLogRow, SkillSummary } from './types'

type WeeklySummaryInput = {
  outcomeIds: string[]
  weekStart: string
  weekEnd: string
  skills: SkillItemRow[]
  logs: SkillLogRow[]
}

function parseDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

function formatDateLocal(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(value: string, days: number): string {
  const date = parseDate(value)
  date.setDate(date.getDate() + days)
  return formatDateLocal(date)
}

export function computeWeeklySkillSummaryFromData(
  input: WeeklySummaryInput,
): Record<string, SkillSummary> {
  if (!input.outcomeIds.length) {
    return {}
  }

  const result: Record<string, SkillSummary> = input.outcomeIds.reduce((acc, outcomeId) => {
    acc[outcomeId] = {
      skillsWorkedCount: 0,
      averageConfidenceDelta: null,
    }
    return acc
  }, {} as Record<string, SkillSummary>)

  if (!input.skills.length) {
    return result
  }

  const skillIds = new Set(input.skills.map((skill) => skill.id))
  const weekStartTs = `${input.weekStart}T00:00:00.000Z`
  const endExclusiveTs = `${addDays(input.weekEnd, 1)}T00:00:00.000Z`

  const relevantLogs = input.logs.filter(
    (log) => skillIds.has(log.skill_item_id) && log.logged_at < endExclusiveTs,
  )

  const logsBySkill = relevantLogs.reduce<Map<string, SkillLogRow[]>>((acc, log) => {
    const existing = acc.get(log.skill_item_id) ?? []
    existing.push(log)
    acc.set(log.skill_item_id, existing)
    return acc
  }, new Map())

  logsBySkill.forEach((skillLogs) => {
    skillLogs.sort((a, b) => b.logged_at.localeCompare(a.logged_at))
  })

  const skillsByOutcome = input.skills.reduce<Record<string, SkillItemRow[]>>((acc, skill) => {
    const existing = acc[skill.outcome_id] ?? []
    existing.push(skill)
    acc[skill.outcome_id] = existing
    return acc
  }, {})

  Object.entries(skillsByOutcome).forEach(([outcomeId, outcomeSkills]) => {
    const deltas: number[] = []

    outcomeSkills.forEach((skill) => {
      const skillLogs = logsBySkill.get(skill.id) ?? []
      const thisWeekLogs = skillLogs.filter((log) => log.logged_at >= weekStartTs)

      if (!thisWeekLogs.length) {
        return
      }

      const lastThisWeek = thisWeekLogs[0]
      const previous = skillLogs.find((log) => log.logged_at < weekStartTs)
      const baseline = previous ? previous.confidence : skill.initial_confidence
      deltas.push(lastThisWeek.confidence - baseline)
    })

    if (!deltas.length) {
      return
    }

    const total = deltas.reduce((sum, value) => sum + value, 0)

    result[outcomeId] = {
      skillsWorkedCount: deltas.length,
      averageConfidenceDelta: Math.round((total / deltas.length) * 10) / 10,
    }
  })

  return result
}
