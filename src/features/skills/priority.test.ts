import { describe, expect, it } from 'vitest'

import {
  computePriorityQueue,
  computeSkillPriority,
  daysBetweenLocalDates,
  isSkillEligibleForGraduation,
} from './priority'
import type { SkillItemRow, SkillLogRow, SkillStage } from './types'

function buildSkill(overrides: Partial<SkillItemRow> = {}): SkillItemRow {
  return {
    id: 'skill-1',
    user_id: 'user-1',
    outcome_id: 'outcome-1',
    name: 'Skill',
    stage: 'active',
    target_label: null,
    target_value: null,
    initial_confidence: 1,
    graduation_suppressed_at: null,
    created_at: '2026-02-01T00:00:00.000Z',
    updated_at: '2026-02-01T00:00:00.000Z',
    ...overrides,
  }
}

function buildLog(
  skillItemId: string,
  confidence: number,
  loggedAt: string,
  overrides: Partial<SkillLogRow> = {},
): SkillLogRow {
  return {
    id: `log-${skillItemId}-${loggedAt}`,
    user_id: 'user-1',
    skill_item_id: skillItemId,
    action_log_id: null,
    confidence,
    target_result: null,
    logged_at: loggedAt,
    created_at: loggedAt,
    updated_at: loggedAt,
    ...overrides,
  }
}

describe('daysBetweenLocalDates', () => {
  it('uses local day boundaries with integer day difference', () => {
    const from = new Date(2026, 1, 20, 23, 55, 0)
    const to = new Date(2026, 1, 21, 0, 5, 0)

    expect(daysBetweenLocalDates(from, to)).toBe(1)
  })
})

describe('computeSkillPriority', () => {
  it('applies cold-start fallback with no logs', () => {
    const skill = buildSkill({
      initial_confidence: 1,
      created_at: '2026-02-20T00:00:00.000Z',
    })
    const now = new Date('2026-02-21T12:00:00.000Z')

    const priority = computeSkillPriority(skill, [], now)

    expect(priority.latestConfidence).toBe(1)
    expect(priority.confidencePressure).toBe(100)
    expect(priority.recencyPressure).toBe(100)
    expect(priority.targetPressure).toBe(50)
    expect(priority.finalScore).toBe(92.5)
  })

  it('uses max target pressure when target exists but no target_result logs', () => {
    const skill = buildSkill({
      target_label: 'BPM',
      target_value: 120,
      created_at: '2026-02-21T00:00:00.000Z',
    })
    const now = new Date('2026-02-21T12:00:00.000Z')

    const priority = computeSkillPriority(skill, [], now)

    expect(priority.targetPressure).toBe(100)
  })

  it('applies review-stage score penalty', () => {
    const now = new Date('2026-02-23T00:00:00.000Z')
    const baseSkill = buildSkill({
      id: 'skill-active',
      stage: 'active',
      created_at: '2026-02-20T00:00:00.000Z',
    })
    const reviewSkill = buildSkill({
      ...baseSkill,
      id: 'skill-review',
      stage: 'review',
    })

    const active = computeSkillPriority(baseSkill, [], now)
    const review = computeSkillPriority(reviewSkill, [], now)
    const expected = Math.round(active.finalScore * 0.35 * 100) / 100

    expect(review.finalScore).toBe(expected)
  })
})

describe('computePriorityQueue', () => {
  it('sorts by descending score and excludes archived skills', () => {
    const now = new Date('2026-02-23T12:00:00.000Z')
    const high = buildSkill({
      id: 'high',
      name: 'High',
      created_at: '2026-02-18T00:00:00.000Z',
      initial_confidence: 1,
    })
    const low = buildSkill({
      id: 'low',
      name: 'Low',
      created_at: '2026-02-22T00:00:00.000Z',
      initial_confidence: 5,
    })
    const archived = buildSkill({
      id: 'archived',
      name: 'Archived',
      stage: 'archived',
    })

    const queue = computePriorityQueue([high, low, archived], [], now)

    expect(queue.map((entry) => entry.skill.id)).toEqual(['high', 'low'])
  })
})

describe('isSkillEligibleForGraduation', () => {
  function logsFor(skillId: string, confidences: number[]): SkillLogRow[] {
    return confidences.map((confidence, index) =>
      buildLog(
        skillId,
        confidence,
        `2026-02-${`${23 - index}`.padStart(2, '0')}T12:00:00.000Z`,
      ),
    )
  }

  it('returns true for active skill when latest 3 logs are >= 4 within 30 days', () => {
    const skill = buildSkill({ id: 'skill-pass' })
    const logs = logsFor(skill.id, [5, 4, 4])

    expect(isSkillEligibleForGraduation(skill, logs, new Date('2026-02-23T12:00:00.000Z'))).toBe(true)
  })

  it('returns false when suppression timestamp is at or after newest qualifying log', () => {
    const skill = buildSkill({
      id: 'skill-suppressed',
      graduation_suppressed_at: '2026-02-23T12:00:00.000Z',
    })
    const logs = logsFor(skill.id, [5, 4, 4])

    expect(isSkillEligibleForGraduation(skill, logs, new Date('2026-02-23T12:00:00.000Z'))).toBe(false)
  })

  it('returns false when any of latest 3 logs is below confidence 4', () => {
    const skill = buildSkill({ id: 'skill-low-confidence' })
    const logs = logsFor(skill.id, [5, 3, 4])

    expect(isSkillEligibleForGraduation(skill, logs, new Date('2026-02-23T12:00:00.000Z'))).toBe(false)
  })

  it('returns false when one of latest 3 logs is older than 30 days', () => {
    const skill = buildSkill({ id: 'skill-old-log' })
    const logs = [
      buildLog(skill.id, 5, '2026-02-23T12:00:00.000Z'),
      buildLog(skill.id, 5, '2026-02-20T12:00:00.000Z'),
      buildLog(skill.id, 4, '2026-01-20T12:00:00.000Z'),
    ]

    expect(isSkillEligibleForGraduation(skill, logs, new Date('2026-02-23T12:00:00.000Z'))).toBe(false)
  })

  it('returns false for non-active stages', () => {
    const skill = buildSkill({ id: 'skill-review', stage: 'review' as SkillStage })
    const logs = logsFor(skill.id, [5, 5, 5])

    expect(isSkillEligibleForGraduation(skill, logs, new Date('2026-02-23T12:00:00.000Z'))).toBe(false)
  })
})
