import { supabase } from '../../lib/supabase'
import { isSkillEligibleForGraduation } from './priority'
import type { SkillItemRow, SkillLogRow } from './types'
import { requireData } from './skillsApiShared'

type SkillActionContext = Record<
  string,
  {
    actionDate: string
    outputId: string
    outputDescription: string | null
  }
>

async function fetchSkillsForOutcome(
  outcomeId: string,
): Promise<{ skills: SkillItemRow[]; logs: SkillLogRow[] }> {
  const { data: skills, error: skillsError } = await supabase
    .from('skill_items')
    .select('*')
    .eq('outcome_id', outcomeId)
    .order('created_at', { ascending: true })

  if (skillsError) {
    throw new Error(skillsError.message)
  }

  const skillIds = (skills ?? []).map((item) => item.id)

  if (!skillIds.length) {
    return {
      skills: [],
      logs: [],
    }
  }

  const { data: logs, error: logsError } = await supabase
    .from('skill_logs')
    .select('*')
    .in('skill_item_id', skillIds)
    .order('logged_at', { ascending: false })

  if (logsError) {
    throw new Error(logsError.message)
  }

  return {
    skills: (skills ?? []) as SkillItemRow[],
    logs: (logs ?? []) as SkillLogRow[],
  }
}

async function fetchSkillsForOutcomes(
  outcomeIds: string[],
): Promise<{ skills: SkillItemRow[]; logs: SkillLogRow[] }> {
  if (!outcomeIds.length) {
    return {
      skills: [],
      logs: [],
    }
  }

  const { data: skills, error: skillsError } = await supabase
    .from('skill_items')
    .select('*')
    .in('outcome_id', outcomeIds)
    .in('stage', ['active', 'review'])
    .order('created_at', { ascending: true })

  if (skillsError) {
    throw new Error(skillsError.message)
  }

  const skillIds = (skills ?? []).map((item) => item.id)

  if (!skillIds.length) {
    return {
      skills: (skills ?? []) as SkillItemRow[],
      logs: [],
    }
  }

  const { data: logs, error: logsError } = await supabase
    .from('skill_logs')
    .select('*')
    .in('skill_item_id', skillIds)
    .order('logged_at', { ascending: false })

  if (logsError) {
    throw new Error(logsError.message)
  }

  return {
    skills: (skills ?? []) as SkillItemRow[],
    logs: (logs ?? []) as SkillLogRow[],
  }
}

async function fetchSkillById(skillId: string): Promise<SkillItemRow> {
  const { data, error } = await supabase
    .from('skill_items')
    .select('*')
    .eq('id', skillId)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return requireData(data as SkillItemRow | null, 'Skill item not found')
}

async function fetchSkillLogsForSkill(skillId: string): Promise<SkillLogRow[]> {
  const { data, error } = await supabase
    .from('skill_logs')
    .select('*')
    .eq('skill_item_id', skillId)
    .order('logged_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as SkillLogRow[]
}

async function fetchSkillLogsByActionIds(
  actionLogIds: string[],
): Promise<SkillLogRow[]> {
  if (!actionLogIds.length) {
    return []
  }

  const { data, error } = await supabase
    .from('skill_logs')
    .select('*')
    .in('action_log_id', actionLogIds)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as SkillLogRow[]
}

async function fetchSkillActionContext(actionLogIds: string[]): Promise<SkillActionContext> {
  if (!actionLogIds.length) {
    return {}
  }

  const { data: actionLogs, error: actionLogsError } = await supabase
    .from('action_logs')
    .select('id, action_date, output_id')
    .in('id', actionLogIds)

  if (actionLogsError) {
    throw new Error(actionLogsError.message)
  }

  const outputIds = [...new Set((actionLogs ?? []).map((item) => item.output_id))]
  const outputsById: Record<string, string> = {}

  if (outputIds.length) {
    const { data: outputs, error: outputsError } = await supabase
      .from('outputs')
      .select('id, description')
      .in('id', outputIds)

    if (outputsError) {
      throw new Error(outputsError.message)
    }

    ;(outputs ?? []).forEach((output) => {
      outputsById[output.id] = output.description
    })
  }

  return (actionLogs ?? []).reduce<SkillActionContext>((acc, log) => {
    acc[log.id] = {
      actionDate: log.action_date,
      outputId: log.output_id,
      outputDescription: outputsById[log.output_id] ?? null,
    }

    return acc
  }, {})
}

async function checkGraduationEligibility(skillId: string): Promise<boolean> {
  const skill = await fetchSkillById(skillId)

  if (skill.stage !== 'active') {
    return false
  }

  const { data, error } = await supabase
    .from('skill_logs')
    .select('*')
    .eq('skill_item_id', skillId)
    .order('logged_at', { ascending: false })
    .limit(3)

  if (error) {
    throw new Error(error.message)
  }

  const logs = (data ?? []) as SkillLogRow[]
  return isSkillEligibleForGraduation(skill, logs)
}

export {
  fetchSkillsForOutcome,
  fetchSkillsForOutcomes,
  fetchSkillById,
  fetchSkillLogsForSkill,
  fetchSkillLogsByActionIds,
  fetchSkillActionContext,
  checkGraduationEligibility,
}
