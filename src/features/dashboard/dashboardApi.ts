import { supabase } from '../../lib/supabase'
import { deleteSkillLogsByActionLogId } from '../skills/skillsApi'
import type { ActionLogInput, DailyDashboardPayload } from './types'

export type ActionLogLookupRow = {
  id: string
  output_id: string
  action_date: string
  completed: number
  total: number
  notes: string | null
}

export type SaveActionLogResult = {
  actionLogId: string
  completed: number
}

export async function fetchDailyDashboard(targetDate: string): Promise<DailyDashboardPayload> {
  const { data, error } = await supabase.rpc('get_daily_dashboard', {
    p_target_date: targetDate,
  })

  if (error) {
    throw new Error(error.message)
  }

  return data as DailyDashboardPayload
}

export async function fetchActionLogsForDate(
  outputIds: string[],
  actionDate: string,
): Promise<ActionLogLookupRow[]> {
  if (!outputIds.length) {
    return []
  }

  const { data, error } = await supabase
    .from('action_logs')
    .select('id, output_id, action_date, completed, total, notes')
    .in('output_id', outputIds)
    .eq('action_date', actionDate)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as ActionLogLookupRow[]
}

export async function saveActionLog(input: ActionLogInput): Promise<SaveActionLogResult> {
  const completed = Math.max(0, Number(input.completed) || 0)
  const total = Math.max(0, Number(input.total) || 0)

  const { data: existing, error: lookupError } = await supabase
    .from('action_logs')
    .select('id')
    .eq('output_id', input.outputId)
    .eq('action_date', input.actionDate)
    .maybeSingle()

  if (lookupError) {
    throw new Error(lookupError.message)
  }

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from('action_logs')
      .update({
        completed,
        total,
        notes: input.notes.trim() ? input.notes.trim() : null,
      })
      .eq('id', existing.id)

    if (updateError) {
      throw new Error(updateError.message)
    }

    if (completed === 0) {
      await deleteSkillLogsByActionLogId(existing.id)
    }

    return {
      actionLogId: existing.id,
      completed,
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from('action_logs')
    .insert({
      output_id: input.outputId,
      action_date: input.actionDate,
      completed,
      total,
      notes: input.notes.trim() ? input.notes.trim() : null,
    })
    .select('id')
    .single()

  if (insertError) {
    throw new Error(insertError.message)
  }

  if (!inserted?.id) {
    throw new Error('Action log id was not returned')
  }

  return {
    actionLogId: inserted.id,
    completed,
  }
}
