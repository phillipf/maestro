import { supabase } from '../../lib/supabase'
import type { SkillItemRow, SkillLogRow, SkillSummary } from './types'
import { computeWeeklySkillSummaryFromData } from './weeklySummary'
import { addDays } from './skillsApiShared'

async function computeWeeklySkillSummaryByOutcome(params: {
  outcomeIds: string[]
  weekStart: string
  weekEnd: string
}): Promise<Record<string, SkillSummary>> {
  if (!params.outcomeIds.length) {
    return {}
  }

  const { data: skillItems, error: skillItemsError } = await supabase
    .from('skill_items')
    .select('*')
    .in('outcome_id', params.outcomeIds)

  if (skillItemsError) {
    throw new Error(skillItemsError.message)
  }

  const skills = (skillItems ?? []) as SkillItemRow[]
  const skillIds = skills.map((skill) => skill.id)

  if (!skillIds.length) {
    return params.outcomeIds.reduce<Record<string, SkillSummary>>((acc, outcomeId) => {
      acc[outcomeId] = {
        skillsWorkedCount: 0,
        averageConfidenceDelta: null,
      }
      return acc
    }, {})
  }

  const inclusiveEnd = addDays(params.weekEnd, 1)

  const { data: allLogs, error: logsError } = await supabase
    .from('skill_logs')
    .select('*')
    .in('skill_item_id', skillIds)
    .lt('logged_at', `${inclusiveEnd}T00:00:00.000Z`)
    .order('logged_at', { ascending: false })

  if (logsError) {
    throw new Error(logsError.message)
  }

  return computeWeeklySkillSummaryFromData({
    outcomeIds: params.outcomeIds,
    weekStart: params.weekStart,
    weekEnd: params.weekEnd,
    skills,
    logs: (allLogs ?? []) as SkillLogRow[],
  })
}

export { computeWeeklySkillSummaryByOutcome }
