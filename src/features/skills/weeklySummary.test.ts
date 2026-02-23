import { describe, expect, it } from 'vitest'

import type { SkillItemRow, SkillLogRow } from './types'
import { computeWeeklySkillSummaryFromData } from './weeklySummary'

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

function buildLog(overrides: Partial<SkillLogRow> & Pick<SkillLogRow, 'id' | 'skill_item_id' | 'confidence' | 'logged_at'>): SkillLogRow {
  return {
    user_id: 'user-1',
    action_log_id: null,
    target_result: null,
    created_at: overrides.logged_at,
    updated_at: overrides.logged_at,
    ...overrides,
  }
}

describe('computeWeeklySkillSummaryFromData', () => {
  it('computes per-outcome skills worked and average confidence delta', () => {
    const weekStart = '2026-02-16'
    const weekEnd = '2026-02-22'

    const skillA = buildSkill({
      id: 'skill-a',
      outcome_id: 'outcome-1',
      initial_confidence: 2,
    })
    const skillB = buildSkill({
      id: 'skill-b',
      outcome_id: 'outcome-1',
      initial_confidence: 1,
    })
    const skillC = buildSkill({
      id: 'skill-c',
      outcome_id: 'outcome-2',
      initial_confidence: 3,
    })

    const logs: SkillLogRow[] = [
      buildLog({
        id: 'log-a-this-week-latest',
        skill_item_id: 'skill-a',
        confidence: 4,
        logged_at: '2026-02-20T10:00:00.000Z',
      }),
      buildLog({
        id: 'log-a-this-week-earlier',
        skill_item_id: 'skill-a',
        confidence: 3,
        logged_at: '2026-02-18T10:00:00.000Z',
      }),
      buildLog({
        id: 'log-a-before-week',
        skill_item_id: 'skill-a',
        confidence: 2,
        logged_at: '2026-02-10T10:00:00.000Z',
      }),
      buildLog({
        id: 'log-b-this-week',
        skill_item_id: 'skill-b',
        confidence: 2,
        logged_at: '2026-02-21T10:00:00.000Z',
      }),
      buildLog({
        id: 'log-c-before-week',
        skill_item_id: 'skill-c',
        confidence: 4,
        logged_at: '2026-02-12T10:00:00.000Z',
      }),
    ]

    const summary = computeWeeklySkillSummaryFromData({
      outcomeIds: ['outcome-1', 'outcome-2'],
      weekStart,
      weekEnd,
      skills: [skillA, skillB, skillC],
      logs,
    })

    expect(summary['outcome-1']).toEqual({
      skillsWorkedCount: 2,
      averageConfidenceDelta: 1.5,
    })

    expect(summary['outcome-2']).toEqual({
      skillsWorkedCount: 0,
      averageConfidenceDelta: null,
    })
  })

  it('ignores logs after the week end boundary', () => {
    const skill = buildSkill({
      id: 'skill-x',
      outcome_id: 'outcome-1',
      initial_confidence: 1,
    })

    const summary = computeWeeklySkillSummaryFromData({
      outcomeIds: ['outcome-1'],
      weekStart: '2026-02-16',
      weekEnd: '2026-02-22',
      skills: [skill],
      logs: [
        buildLog({
          id: 'log-after-week',
          skill_item_id: 'skill-x',
          confidence: 5,
          logged_at: '2026-02-23T00:00:00.000Z',
        }),
      ],
    })

    expect(summary['outcome-1']).toEqual({
      skillsWorkedCount: 0,
      averageConfidenceDelta: null,
    })
  })

  it('returns empty object when no outcomes are provided', () => {
    const summary = computeWeeklySkillSummaryFromData({
      outcomeIds: [],
      weekStart: '2026-02-16',
      weekEnd: '2026-02-22',
      skills: [],
      logs: [],
    })

    expect(summary).toEqual({})
  })
})
