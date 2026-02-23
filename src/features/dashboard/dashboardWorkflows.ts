import type { DashboardOutput } from './types'
import type { SkillItemRow, SkillLogRow } from '../skills/types'
import { formatLocalDate } from '../../lib/date'

export type LogDraft = {
  completed: number
  total: number
  notes: string
}

export type SkillLogDraft = {
  selected: boolean
  confidence: number
  targetResult: string
}

export type SkillLogEntry = {
  skillItemId: string
  confidence: number
  targetResult: number | null
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function toLocalDateInputValue(date: Date = new Date()): string {
  return formatLocalDate(date)
}

export function createLogDraft(output: DashboardOutput): LogDraft {
  return {
    completed: output.today_log?.completed ?? 0,
    total:
      output.today_log?.total ??
      (output.frequency_type === 'flexible_weekly' ? output.frequency_value : 1),
    notes: output.today_log?.notes ?? '',
  }
}

export function frequencyDescription(output: DashboardOutput): string {
  if (output.frequency_type === 'daily') {
    return 'Daily'
  }

  if (output.frequency_type === 'flexible_weekly') {
    return `${output.frequency_value}x/week (flexible)`
  }

  const days = (output.schedule_weekdays ?? []).map((day) => WEEKDAY_LABELS[day]).join(', ')

  return `Fixed weekly (${days || 'no days'})`
}

export function scoreLabel(score: number | undefined): string {
  if (score === undefined) {
    return 'n/a'
  }

  return Math.round(score).toString()
}

export function createEmptySkillLogDraft(): SkillLogDraft {
  return {
    selected: false,
    confidence: 3,
    targetResult: '',
  }
}

export function buildSkillDraftsFromExistingLogs(
  outcomeSkills: SkillItemRow[],
  existingLogs: SkillLogRow[],
): Record<string, SkillLogDraft> {
  const existingBySkill = existingLogs.reduce<Record<string, SkillLogRow>>((acc, log) => {
    acc[log.skill_item_id] = log
    return acc
  }, {})

  return outcomeSkills.reduce<Record<string, SkillLogDraft>>((acc, skill) => {
    const existing = existingBySkill[skill.id]

    acc[skill.id] = {
      selected: Boolean(existing),
      confidence: existing?.confidence ?? 3,
      targetResult: existing?.target_result === null || existing?.target_result === undefined
        ? ''
        : String(existing.target_result),
    }

    return acc
  }, {})
}

export function buildSelectedSkillEntries(
  drafts: Record<string, SkillLogDraft>,
): { entries: SkillLogEntry[]; errorMessage: string | null } {
  const entries = Object.entries(drafts)
    .filter(([, draft]) => draft.selected)
    .map(([skillId, draft]) => ({
      skillItemId: skillId,
      confidence: draft.confidence,
      targetResult: draft.targetResult.trim() ? Number(draft.targetResult) : null,
    }))

  if (entries.some((entry) => Number.isNaN(entry.targetResult))) {
    return {
      entries: [],
      errorMessage: 'Target result must be numeric for selected skills.',
    }
  }

  if (entries.some((entry) => entry.confidence < 1 || entry.confidence > 5)) {
    return {
      entries: [],
      errorMessage: 'Confidence must be between 1 and 5.',
    }
  }

  return {
    entries,
    errorMessage: null,
  }
}

type GraduationFlowParams = {
  createdSkillIds: string[]
  skills: SkillItemRow[]
  isSkillEligible: (skillId: string) => Promise<boolean>
  moveToReview: (skillId: string) => Promise<void>
  suppressGraduation: (skillId: string) => Promise<void>
  confirmMoveToReview: (message: string) => boolean
}

export async function runGraduationPromptFlow(params: GraduationFlowParams): Promise<void> {
  for (const skillId of params.createdSkillIds) {
    const eligible = await params.isSkillEligible(skillId)

    if (!eligible) {
      continue
    }

    const skillName = params.skills.find((item) => item.id === skillId)?.name ?? 'This skill'
    const moveToReview = params.confirmMoveToReview(
      `${skillName} qualifies for review (3 recent confidence logs of 4+). Move it to Review now?`,
    )

    if (moveToReview) {
      await params.moveToReview(skillId)
    } else {
      await params.suppressGraduation(skillId)
    }
  }
}
