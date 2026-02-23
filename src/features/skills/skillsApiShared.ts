type SkillDraftInput = {
  outcomeId: string
  name: string
  initialConfidence: number
  targetLabel?: string
  targetValue?: number
}

type SkillUpdateInput = {
  name: string
  targetLabel?: string
  targetValue?: number
  initialConfidence: number
}

type SkillLogDraftInput = {
  skillItemId: string
  confidence: number
  targetResult: number | null
}

type SkillLogSaveResult = {
  createdSkillIds: string[]
}

function requireData<T>(value: T | null, message: string): T {
  if (value === null) {
    throw new Error(message)
  }

  return value
}

function toSkillMutationError(error: {
  code?: string
  message: string
  details?: string | null
}): Error {
  const details = error.details ?? ''
  const duplicateLiveName =
    error.code === '23505' &&
    (error.message.includes('skill_items_outcome_name_live_unique_idx') ||
      details.includes('skill_items_outcome_name_live_unique_idx'))

  if (duplicateLiveName) {
    return new Error('A live skill with this name already exists for this outcome.')
  }

  return new Error(error.message)
}

function normalizeTargetLabel(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizeTargetValue(value: number | undefined): number | null {
  if (value === undefined || Number.isNaN(value)) {
    return null
  }

  return value
}

const addDays = addLocalDays

export type {
  SkillDraftInput,
  SkillUpdateInput,
  SkillLogDraftInput,
  SkillLogSaveResult,
}
export {
  requireData,
  toSkillMutationError,
  normalizeTargetLabel,
  normalizeTargetValue,
  addDays,
}
import { addLocalDays } from '../../lib/date'
