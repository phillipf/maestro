import { daysBetweenLocalDates } from '../../lib/date'
import type { SkillItemRow, SkillLogRow, SkillPriority } from './types'

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100
}

export function groupSkillLogsBySkill(skillLogs: SkillLogRow[]): Map<string, SkillLogRow[]> {
  const grouped = new Map<string, SkillLogRow[]>()

  skillLogs.forEach((log) => {
    const list = grouped.get(log.skill_item_id) ?? []
    list.push(log)
    grouped.set(log.skill_item_id, list)
  })

  grouped.forEach((logs) => {
    logs.sort((a, b) => b.logged_at.localeCompare(a.logged_at))
  })

  return grouped
}

function latestTargetResult(logs: SkillLogRow[]): number | null {
  const log = logs.find((item) => item.target_result !== null)
  return log ? Number(log.target_result) : null
}

export function computeSkillPriority(skill: SkillItemRow, logs: SkillLogRow[], now: Date = new Date()): SkillPriority {
  const latestLog = logs[0] ?? null
  const latestConfidence = latestLog ? latestLog.confidence : skill.initial_confidence

  const confidencePressure = (1 - (latestConfidence - 1) / 4) * 100

  const referenceDate = latestLog ? latestLog.logged_at : skill.created_at
  const daysSinceLast = daysBetweenLocalDates(referenceDate, now)
  const targetInterval = Math.pow(2, latestConfidence - 1)
  const recencyPressure = Math.min((daysSinceLast / targetInterval) * 100, 100)

  let targetPressure = 50

  if (skill.target_value !== null) {
    const latestValue = latestTargetResult(logs)

    if (latestValue === null) {
      targetPressure = 100
    } else {
      const ratio = Math.min(Math.max(latestValue / Number(skill.target_value), 0), 1)
      targetPressure = (1 - ratio) * 100
    }
  }

  const priorityScore =
    confidencePressure * 0.45 +
    recencyPressure * 0.4 +
    targetPressure * 0.15

  const finalScore = skill.stage === 'review' ? priorityScore * 0.35 : priorityScore

  return {
    skill,
    latestConfidence,
    confidencePressure: roundToTwo(confidencePressure),
    recencyPressure: roundToTwo(recencyPressure),
    targetPressure: roundToTwo(targetPressure),
    priorityScore: roundToTwo(priorityScore),
    finalScore: roundToTwo(finalScore),
    daysSinceLast,
    targetInterval,
  }
}

export function computePriorityQueue(
  skills: SkillItemRow[],
  skillLogs: SkillLogRow[],
  now: Date = new Date(),
): SkillPriority[] {
  const grouped = groupSkillLogsBySkill(skillLogs)

  return skills
    .filter((skill) => skill.stage === 'active' || skill.stage === 'review')
    .map((skill) => computeSkillPriority(skill, grouped.get(skill.id) ?? [], now))
    .sort((left, right) => right.finalScore - left.finalScore)
}

export function isSkillEligibleForGraduation(
  skill: SkillItemRow,
  logsDescending: SkillLogRow[],
  now: Date = new Date(),
): boolean {
  if (skill.stage !== 'active') {
    return false
  }

  const latestThree = logsDescending.slice(0, 3)

  if (latestThree.length < 3) {
    return false
  }

  const newestLog = latestThree[0]

  if (skill.graduation_suppressed_at) {
    const suppressedAt = new Date(skill.graduation_suppressed_at)

    if (new Date(newestLog.logged_at) <= suppressedAt) {
      return false
    }
  }

  if (latestThree.some((log) => log.confidence < 4)) {
    return false
  }

  return latestThree.every((log) => daysBetweenLocalDates(log.logged_at, now) <= 30)
}

export { daysBetweenLocalDates } from '../../lib/date'
