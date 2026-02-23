export type SkillStage = 'active' | 'review' | 'archived'

export interface SkillItemRow {
  id: string
  user_id: string
  outcome_id: string
  name: string
  stage: SkillStage
  target_label: string | null
  target_value: number | null
  initial_confidence: number
  graduation_suppressed_at: string | null
  created_at: string
  updated_at: string
}

export interface SkillLogRow {
  id: string
  user_id: string
  skill_item_id: string
  action_log_id: string | null
  confidence: number
  target_result: number | null
  logged_at: string
  created_at: string
  updated_at: string
}

export interface SkillPriority {
  skill: SkillItemRow
  latestConfidence: number
  confidencePressure: number
  recencyPressure: number
  targetPressure: number
  priorityScore: number
  finalScore: number
  daysSinceLast: number
  targetInterval: number
}

export interface SkillSummary {
  skillsWorkedCount: number
  averageConfidenceDelta: number | null
}
