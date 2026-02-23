import { supabase } from '../../lib/supabase'
import type { SkillItemRow, SkillLogRow, SkillStage } from './types'
import {
  normalizeTargetLabel,
  normalizeTargetValue,
  requireData,
  toSkillMutationError,
  type SkillDraftInput,
  type SkillLogDraftInput,
  type SkillLogSaveResult,
  type SkillUpdateInput,
} from './skillsApiShared'

async function createSkillItem(input: SkillDraftInput): Promise<SkillItemRow> {
  const targetLabel = normalizeTargetLabel(input.targetLabel)
  const targetValue = normalizeTargetValue(input.targetValue)

  const { data, error } = await supabase
    .from('skill_items')
    .insert({
      outcome_id: input.outcomeId,
      name: input.name.trim(),
      initial_confidence: input.initialConfidence,
      target_label: targetLabel,
      target_value: targetValue,
    })
    .select('*')
    .single()

  if (error) {
    throw toSkillMutationError(error)
  }

  return requireData(data as SkillItemRow | null, 'Skill item was not returned')
}

async function updateSkillItem(
  skillId: string,
  input: SkillUpdateInput,
): Promise<SkillItemRow> {
  const targetLabel = normalizeTargetLabel(input.targetLabel)
  const targetValue = normalizeTargetValue(input.targetValue)

  const { data, error } = await supabase
    .from('skill_items')
    .update({
      name: input.name.trim(),
      target_label: targetLabel,
      target_value: targetValue,
      initial_confidence: input.initialConfidence,
    })
    .eq('id', skillId)
    .select('*')
    .single()

  if (error) {
    throw toSkillMutationError(error)
  }

  return requireData(data as SkillItemRow | null, 'Updated skill item was not returned')
}

async function setSkillStage(skillId: string, stage: SkillStage): Promise<SkillItemRow> {
  const updates: Partial<SkillItemRow> = {
    stage,
  }

  if (stage === 'review') {
    updates.graduation_suppressed_at = null
  }

  const { data, error } = await supabase
    .from('skill_items')
    .update(updates)
    .eq('id', skillId)
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return requireData(data as SkillItemRow | null, 'Updated skill stage was not returned')
}

async function suppressSkillGraduation(skillId: string): Promise<void> {
  const { error } = await supabase
    .from('skill_items')
    .update({ graduation_suppressed_at: new Date().toISOString() })
    .eq('id', skillId)

  if (error) {
    throw new Error(error.message)
  }
}

async function replaceSkillLogsForAction(params: {
  actionLogId: string
  entries: SkillLogDraftInput[]
}): Promise<SkillLogSaveResult> {
  const skillIds = params.entries.map((entry) => entry.skillItemId)

  const { data: existingRows, error: existingError } = await supabase
    .from('skill_logs')
    .select('*')
    .eq('action_log_id', params.actionLogId)

  if (existingError) {
    throw new Error(existingError.message)
  }

  const existingMap = new Map(
    ((existingRows ?? []) as SkillLogRow[]).map((row) => [row.skill_item_id, row]),
  )

  const createdSkillIds: string[] = []

  for (const entry of params.entries) {
    const existing = existingMap.get(entry.skillItemId)

    if (existing) {
      const { error: updateError } = await supabase
        .from('skill_logs')
        .update({
          confidence: entry.confidence,
          target_result: entry.targetResult,
        })
        .eq('id', existing.id)

      if (updateError) {
        throw new Error(updateError.message)
      }
      continue
    }

    const { error: insertError } = await supabase.from('skill_logs').insert({
      skill_item_id: entry.skillItemId,
      action_log_id: params.actionLogId,
      confidence: entry.confidence,
      target_result: entry.targetResult,
      logged_at: new Date().toISOString(),
    })

    if (insertError) {
      throw new Error(insertError.message)
    }

    createdSkillIds.push(entry.skillItemId)
  }

  const skillIdsToKeep = new Set(skillIds)
  const staleIds = ((existingRows ?? []) as SkillLogRow[])
    .filter((row) => !skillIdsToKeep.has(row.skill_item_id))
    .map((row) => row.id)

  if (staleIds.length) {
    const { error: deleteError } = await supabase
      .from('skill_logs')
      .delete()
      .in('id', staleIds)

    if (deleteError) {
      throw new Error(deleteError.message)
    }
  }

  return {
    createdSkillIds,
  }
}

async function deleteSkillLogsByActionLogId(actionLogId: string): Promise<void> {
  const { error } = await supabase
    .from('skill_logs')
    .delete()
    .eq('action_log_id', actionLogId)

  if (error) {
    throw new Error(error.message)
  }
}

export {
  createSkillItem,
  updateSkillItem,
  setSkillStage,
  suppressSkillGraduation,
  replaceSkillLogsForAction,
  deleteSkillLogsByActionLogId,
}
