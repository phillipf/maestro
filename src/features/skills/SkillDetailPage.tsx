import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { fetchOutcomeById } from '../outcomes/outcomesApi'
import { setSkillStage } from './skillsApi'
import {
  fetchSkillActionContext,
  fetchSkillById,
  fetchSkillLogsForSkill,
} from './skillsApi'
import { SimpleLineChart } from './SimpleLineChart'
import type { SkillItemRow, SkillLogRow, SkillStage } from './types'

function formatDateTime(value: string): string {
  const date = new Date(value)
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const year = date.getFullYear()

  return `${year}-${month}-${day}`
}

function stageActions(stage: SkillStage): SkillStage[] {
  if (stage === 'active') {
    return ['review', 'archived']
  }

  if (stage === 'review') {
    return ['active', 'archived']
  }

  return ['active']
}

function stageButtonLabel(stage: SkillStage): string {
  if (stage === 'active') {
    return 'Activate'
  }

  if (stage === 'review') {
    return 'Move to review'
  }

  return 'Archive'
}

export function SkillDetailPage() {
  const { outcomeId, skillId } = useParams<{ outcomeId: string; skillId: string }>()

  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [skill, setSkill] = useState<SkillItemRow | null>(null)
  const [logs, setLogs] = useState<SkillLogRow[]>([])
  const [outcomeTitle, setOutcomeTitle] = useState<string>('')
  const [contextByAction, setContextByAction] = useState<
    Record<string, { actionDate: string; outputId: string; outputDescription: string | null }>
  >({})

  const loadData = useCallback(async () => {
    if (!outcomeId || !skillId) {
      setErrorMessage('Missing route params for skill detail.')
      setLoading(false)
      return
    }

    setLoading(true)
    setErrorMessage(null)

    try {
      const [outcome, skillRow, skillLogs] = await Promise.all([
        fetchOutcomeById(outcomeId),
        fetchSkillById(skillId),
        fetchSkillLogsForSkill(skillId),
      ])

      if (skillRow.outcome_id !== outcomeId) {
        throw new Error('Skill does not belong to this outcome.')
      }

      setOutcomeTitle(outcome.title)
      setSkill(skillRow)
      setLogs(skillLogs)

      const actionIds = skillLogs
        .map((log) => log.action_log_id)
        .filter((value): value is string => value !== null)

      const actionContext = await fetchSkillActionContext(actionIds)
      setContextByAction(actionContext)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load skill detail'
      setErrorMessage(message)
    } finally {
      setLoading(false)
    }
  }, [outcomeId, skillId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const confidencePoints = useMemo(() => {
    return logs
      .slice()
      .sort((a, b) => a.logged_at.localeCompare(b.logged_at))
      .map((log) => ({
        label: formatDateTime(log.logged_at),
        value: log.confidence,
      }))
  }, [logs])

  const targetPoints = useMemo(() => {
    return logs
      .filter((log) => log.target_result !== null)
      .slice()
      .sort((a, b) => a.logged_at.localeCompare(b.logged_at))
      .map((log) => ({
        label: formatDateTime(log.logged_at),
        value: Number(log.target_result),
      }))
  }, [logs])

  async function handleStageChange(stage: SkillStage) {
    if (!skill) {
      return
    }

    setBusyKey(`stage-${stage}`)
    setErrorMessage(null)

    try {
      const updated = await setSkillStage(skill.id, stage)
      setSkill(updated)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update stage'
      setErrorMessage(message)
    } finally {
      setBusyKey(null)
    }
  }

  if (loading) {
    return (
      <section className="stack">
        <header className="stack-sm">
          <p className="eyebrow">Skill Detail</p>
          <h1>Loading...</h1>
        </header>
        <article className="panel">Loading skill detail...</article>
      </section>
    )
  }

  if (!skill || !outcomeId) {
    return (
      <section className="stack">
        <header className="stack-sm">
          <p className="eyebrow">Skill Detail</p>
          <h1>Skill not found</h1>
        </header>
        <article className="panel">
          <Link className="btn btn-secondary" to="/outcomes">
            Back to outcomes
          </Link>
        </article>
      </section>
    )
  }

  return (
    <section className="stack">
      <header className="stack-sm">
        <p className="eyebrow">Skill Detail</p>
        <h1>{skill.name}</h1>
        <p className="muted">
          {outcomeTitle} · stage: {skill.stage}
          {skill.target_label && skill.target_value !== null
            ? ` · target: ${skill.target_label} (${skill.target_value})`
            : ''}
        </p>
      </header>

      {errorMessage ? <p className="status-bad">{errorMessage}</p> : null}

      <article className="panel outcome-detail-header">
        <Link className="btn btn-secondary" to={`/outcomes/${outcomeId}`}>
          Back to outcome
        </Link>

        <div className="actions-row">
          {stageActions(skill.stage).map((stage) => (
            <button
              className="btn btn-secondary"
              disabled={busyKey === `stage-${stage}`}
              key={stage}
              onClick={() => void handleStageChange(stage)}
              type="button"
            >
              {stageButtonLabel(stage)}
            </button>
          ))}
        </div>
      </article>

      <article className="panel stack-sm">
        <h2>Confidence trend</h2>
        <SimpleLineChart points={confidencePoints} title="Confidence over time" />
      </article>

      {skill.target_value !== null ? (
        <article className="panel stack-sm">
          <h2>Target progress</h2>
          <SimpleLineChart
            goalValue={Number(skill.target_value)}
            points={targetPoints}
            title="Target result over time"
          />
        </article>
      ) : null}

      <article className="panel stack-sm">
        <h2>Practice log</h2>

        {logs.length === 0 ? <p className="muted">No practice logs yet.</p> : null}

        {logs.map((log) => {
          const context = log.action_log_id ? contextByAction[log.action_log_id] : null

          return (
            <div className="entry-row" key={log.id}>
              <div className="stack-xs">
                <p>
                  <strong>{formatDateTime(log.logged_at)}</strong> · confidence {log.confidence}
                </p>
                <p className="muted">
                  {log.target_result !== null ? `target result: ${log.target_result}` : 'no target result'}
                </p>
                <p className="hint">
                  {context
                    ? `Logged with output: ${context.outputDescription ?? context.outputId} on ${context.actionDate}`
                    : 'Standalone skill log context unavailable'}
                </p>
              </div>
            </div>
          )
        })}
      </article>
    </section>
  )
}
