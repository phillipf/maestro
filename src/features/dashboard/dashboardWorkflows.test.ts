import { describe, expect, it, vi } from 'vitest'

import type { DashboardOutput } from './types'
import {
  buildSelectedSkillEntries,
  buildSkillDraftsFromExistingLogs,
  createEmptySkillLogDraft,
  createLogDraft,
  frequencyDescription,
  runGraduationPromptFlow,
  scoreLabel,
} from './dashboardWorkflows'
import type { SkillItemRow, SkillLogRow } from '../skills/types'

function buildOutput(overrides: Partial<DashboardOutput> = {}): DashboardOutput {
  return {
    id: 'output-1',
    description: 'Practice guitar',
    frequency_type: 'daily',
    frequency_value: 1,
    schedule_weekdays: null,
    is_starter: false,
    scheduled_today: true,
    today_log: null,
    weekly_progress: {
      completed: 0,
      target: 1,
      rate: 0,
      target_met: false,
    },
    ...overrides,
  }
}

function buildSkill(overrides: Partial<SkillItemRow> = {}): SkillItemRow {
  return {
    id: 'skill-1',
    user_id: 'user-1',
    outcome_id: 'outcome-1',
    name: 'Barre chords',
    stage: 'active',
    target_label: null,
    target_value: null,
    initial_confidence: 1,
    graduation_suppressed_at: null,
    created_at: '2026-02-20T00:00:00.000Z',
    updated_at: '2026-02-20T00:00:00.000Z',
    ...overrides,
  }
}

function buildSkillLog(overrides: Partial<SkillLogRow> = {}): SkillLogRow {
  return {
    id: 'log-1',
    user_id: 'user-1',
    skill_item_id: 'skill-1',
    action_log_id: 'action-1',
    confidence: 4,
    target_result: null,
    logged_at: '2026-02-22T00:00:00.000Z',
    created_at: '2026-02-22T00:00:00.000Z',
    updated_at: '2026-02-22T00:00:00.000Z',
    ...overrides,
  }
}

describe('dashboardWorkflows basics', () => {
  it('creates output draft defaults', () => {
    const output = buildOutput({
      frequency_type: 'flexible_weekly',
      frequency_value: 3,
    })

    expect(createLogDraft(output)).toEqual({
      completed: 0,
      total: 3,
      notes: '',
    })
  })

  it('formats frequency labels', () => {
    expect(frequencyDescription(buildOutput({ frequency_type: 'daily' }))).toBe('Daily')
    expect(frequencyDescription(buildOutput({ frequency_type: 'flexible_weekly', frequency_value: 4 }))).toBe(
      '4x/week (flexible)',
    )
    expect(
      frequencyDescription(
        buildOutput({
          frequency_type: 'fixed_weekly',
          schedule_weekdays: [1, 3, 5],
        }),
      ),
    ).toBe('Fixed weekly (Mon, Wed, Fri)')
  })

  it('labels score with rounded integer or n/a', () => {
    expect(scoreLabel(undefined)).toBe('n/a')
    expect(scoreLabel(74.9)).toBe('75')
  })
})

describe('buildSkillDraftsFromExistingLogs', () => {
  it('creates default drafts and overlays existing log values', () => {
    const drafts = buildSkillDraftsFromExistingLogs(
      [
        buildSkill({ id: 'skill-1' }),
        buildSkill({ id: 'skill-2', name: 'Fingerpicking' }),
      ],
      [
        buildSkillLog({
          id: 'log-existing',
          skill_item_id: 'skill-2',
          confidence: 5,
          target_result: 120,
        }),
      ],
    )

    expect(drafts['skill-1']).toEqual(createEmptySkillLogDraft())
    expect(drafts['skill-2']).toEqual({
      selected: true,
      confidence: 5,
      targetResult: '120',
    })
  })
})

describe('buildSelectedSkillEntries', () => {
  it('returns selected skill entries on valid input', () => {
    const result = buildSelectedSkillEntries({
      'skill-1': {
        selected: true,
        confidence: 4,
        targetResult: '95',
      },
      'skill-2': {
        selected: false,
        confidence: 2,
        targetResult: '',
      },
    })

    expect(result).toEqual({
      entries: [
        {
          skillItemId: 'skill-1',
          confidence: 4,
          targetResult: 95,
        },
      ],
      errorMessage: null,
    })
  })

  it('rejects non-numeric target results', () => {
    const result = buildSelectedSkillEntries({
      'skill-1': {
        selected: true,
        confidence: 4,
        targetResult: 'x',
      },
    })

    expect(result.errorMessage).toBe('Target result must be numeric for selected skills.')
  })

  it('rejects confidence outside 1..5', () => {
    const result = buildSelectedSkillEntries({
      'skill-1': {
        selected: true,
        confidence: 6,
        targetResult: '',
      },
    })

    expect(result.errorMessage).toBe('Confidence must be between 1 and 5.')
  })
})

describe('runGraduationPromptFlow', () => {
  it('moves eligible skill to review when confirmed and suppresses when declined', async () => {
    const isSkillEligible = vi.fn(async (skillId: string) => skillId !== 'skill-ineligible')
    const moveToReview = vi.fn(async () => undefined)
    const suppressGraduation = vi.fn(async () => undefined)
    const confirmMoveToReview = vi.fn((message: string) => !message.includes('Fingerpicking'))

    await runGraduationPromptFlow({
      createdSkillIds: ['skill-barre', 'skill-finger', 'skill-ineligible'],
      skills: [
        buildSkill({ id: 'skill-barre', name: 'Barre chords' }),
        buildSkill({ id: 'skill-finger', name: 'Fingerpicking' }),
      ],
      isSkillEligible,
      moveToReview,
      suppressGraduation,
      confirmMoveToReview,
    })

    expect(moveToReview).toHaveBeenCalledWith('skill-barre')
    expect(suppressGraduation).toHaveBeenCalledWith('skill-finger')
    expect(moveToReview).not.toHaveBeenCalledWith('skill-ineligible')
    expect(suppressGraduation).not.toHaveBeenCalledWith('skill-ineligible')
  })
})
