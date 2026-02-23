import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  fetchActionLogsForDate,
  fetchDailyDashboard,
  saveActionLog,
  type ActionLogLookupRow,
} from './dashboardApi'
import {
  buildSelectedSkillEntries,
  buildSkillDraftsFromExistingLogs,
  createEmptySkillLogDraft,
  createLogDraft,
  frequencyDescription,
  runGraduationPromptFlow,
  scoreLabel,
  toLocalDateInputValue,
  type LogDraft,
  type SkillLogDraft,
} from './dashboardWorkflows'
import type { DashboardOutput, DailyDashboardPayload } from './types'
import {
  checkGraduationEligibility,
  fetchSkillLogsByActionIds,
  fetchSkillsForOutcomes,
  replaceSkillLogsForAction,
  setSkillStage,
  suppressSkillGraduation,
} from '../skills/skillsApi'
import { computePriorityQueue } from '../skills/priority'
import type { SkillItemRow, SkillLogRow, SkillPriority } from '../skills/types'

type ScheduledOutput = {
  outcomeId: string
  outcomeTitle: string
  output: DashboardOutput
}

export function DashboardPage() {
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateInputValue())
  const [dashboard, setDashboard] = useState<DailyDashboardPayload | null>(null)
  const [logDrafts, setLogDrafts] = useState<Record<string, LogDraft>>({})
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [actionLogByOutputId, setActionLogByOutputId] = useState<Record<string, ActionLogLookupRow>>({})

  const [skills, setSkills] = useState<SkillItemRow[]>([])
  const [skillLogs, setSkillLogs] = useState<SkillLogRow[]>([])

  const [expandedSkillOutputId, setExpandedSkillOutputId] = useState<string | null>(null)
  const [skillLogDraftsByOutput, setSkillLogDraftsByOutput] = useState<
    Record<string, Record<string, SkillLogDraft>>
  >({})
  const [showAllSuggestions, setShowAllSuggestions] = useState(false)

  const scheduledOutputs = useMemo(() => {
    if (!dashboard) {
      return [] as ScheduledOutput[]
    }

    return dashboard.outcomes.flatMap((outcome) =>
      outcome.outputs
        .filter((output) => output.scheduled_today)
        .map((output) => ({
          outcomeId: outcome.id,
          outcomeTitle: outcome.title,
          output,
        })),
    )
  }, [dashboard])

  const priorityQueue = useMemo(() => computePriorityQueue(skills, skillLogs), [skills, skillLogs])

  const skillScoreById = useMemo(() => {
    return priorityQueue.reduce<Record<string, number>>((acc, row) => {
      acc[row.skill.id] = row.finalScore
      return acc
    }, {})
  }, [priorityQueue])

  const skillsByOutcome = useMemo(() => {
    return skills.reduce<Record<string, SkillItemRow[]>>((acc, skill) => {
      const list = acc[skill.outcome_id] ?? []
      list.push(skill)
      acc[skill.outcome_id] = list
      return acc
    }, {})
  }, [skills])

  const suggestedByOutcome = useMemo(() => {
    return priorityQueue.reduce<Record<string, SkillPriority[]>>((acc, row) => {
      const list = acc[row.skill.outcome_id] ?? []

      if (list.length < 3) {
        list.push(row)
      }

      acc[row.skill.outcome_id] = list
      return acc
    }, {})
  }, [priorityQueue])

  const topSuggestedGlobal = useMemo(() => priorityQueue.slice(0, 3), [priorityQueue])

  const outcomeTitleById = useMemo(() => {
    if (!dashboard) {
      return {}
    }

    return dashboard.outcomes.reduce<Record<string, string>>((acc, outcome) => {
      acc[outcome.id] = outcome.title
      return acc
    }, {})
  }, [dashboard])

  const completedCount = useMemo(() => {
    return scheduledOutputs.filter(({ output }) => {
      const log = actionLogByOutputId[output.id]

      if (!log) {
        return false
      }

      return log.total > 0 && log.completed >= log.total
    }).length
  }, [actionLogByOutputId, scheduledOutputs])

  const completionRate = useMemo(() => {
    if (!scheduledOutputs.length) {
      return 0
    }

    return Math.round((completedCount / scheduledOutputs.length) * 100)
  }, [completedCount, scheduledOutputs.length])

  const loadDashboard = useCallback(async (date: string) => {
    setLoading(true)
    setErrorMessage(null)

    try {
      const payload = await fetchDailyDashboard(date)
      setDashboard(payload)

      const nextLogDrafts = payload.outcomes.reduce<Record<string, LogDraft>>((acc, outcome) => {
        outcome.outputs.forEach((output) => {
          acc[output.id] = createLogDraft(output)
        })

        return acc
      }, {})

      setLogDrafts(nextLogDrafts)

      const scheduledOutputIds = payload.outcomes.flatMap((outcome) =>
        outcome.outputs.filter((output) => output.scheduled_today).map((output) => output.id),
      )

      const outcomeIds = payload.outcomes.map((outcome) => outcome.id)

      const [actionLogs, skillData] = await Promise.all([
        fetchActionLogsForDate(scheduledOutputIds, date),
        fetchSkillsForOutcomes(outcomeIds),
      ])

      setActionLogByOutputId(
        actionLogs.reduce<Record<string, ActionLogLookupRow>>((acc, row) => {
          acc[row.output_id] = row
          return acc
        }, {}),
      )

      setSkills(skillData.skills)
      setSkillLogs(skillData.logs)
      setShowAllSuggestions(false)

      if (expandedSkillOutputId) {
        const linkedAction = actionLogs.find((row) => row.output_id === expandedSkillOutputId)

        if (!linkedAction || linkedAction.completed <= 0) {
          setExpandedSkillOutputId(null)
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load dashboard'
      setErrorMessage(message)
    } finally {
      setLoading(false)
    }
  }, [expandedSkillOutputId])

  useEffect(() => {
    void loadDashboard(selectedDate)
  }, [loadDashboard, selectedDate])

  function setLogDraftValue<K extends keyof LogDraft>(
    outputId: string,
    key: K,
    value: LogDraft[K],
  ) {
    setLogDrafts((previous) => {
      const base = previous[outputId] ?? {
        completed: 0,
        total: 1,
        notes: '',
      }

      return {
        ...previous,
        [outputId]: {
          ...base,
          [key]: value,
        },
      }
    })
  }

  function setSkillDraftValue<K extends keyof SkillLogDraft>(
    outputId: string,
    skillId: string,
    key: K,
    value: SkillLogDraft[K],
  ) {
    setSkillLogDraftsByOutput((previous) => {
      const outputDraft = previous[outputId] ?? {}
      const skillDraft = outputDraft[skillId] ?? createEmptySkillLogDraft()

      return {
        ...previous,
        [outputId]: {
          ...outputDraft,
          [skillId]: {
            ...skillDraft,
            [key]: value,
          },
        },
      }
    })
  }

  async function persistLog(outputId: string, draft: LogDraft, opKey: string) {
    setBusyKey(opKey)
    setErrorMessage(null)

    try {
      const result = await saveActionLog({
        outputId,
        actionDate: selectedDate,
        completed: draft.completed,
        total: draft.total,
        notes: draft.notes,
      })

      if (result.completed === 0) {
        setExpandedSkillOutputId((current) => (current === outputId ? null : current))
        setSkillLogDraftsByOutput((previous) => {
          const copy = { ...previous }
          delete copy[outputId]
          return copy
        })
      }

      await loadDashboard(selectedDate)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save action log'
      setErrorMessage(message)
    } finally {
      setBusyKey(null)
    }
  }

  async function markDone(output: DashboardOutput) {
    const draft: LogDraft = {
      completed: 1,
      total: output.frequency_type === 'flexible_weekly' ? output.frequency_value : 1,
      notes: logDrafts[output.id]?.notes ?? '',
    }

    setLogDrafts((previous) => ({ ...previous, [output.id]: draft }))
    await persistLog(output.id, draft, `quick-done-${output.id}`)
  }

  async function markMissed(output: DashboardOutput) {
    const draft: LogDraft = {
      completed: 0,
      total: output.frequency_type === 'flexible_weekly' ? output.frequency_value : 1,
      notes: logDrafts[output.id]?.notes ?? '',
    }

    setLogDrafts((previous) => ({ ...previous, [output.id]: draft }))
    await persistLog(output.id, draft, `quick-missed-${output.id}`)
  }

  async function toggleSkillPanel(outputRow: ScheduledOutput) {
    const outputId = outputRow.output.id

    if (expandedSkillOutputId === outputId) {
      setExpandedSkillOutputId(null)
      return
    }

    const actionLog = actionLogByOutputId[outputId]

    if (!actionLog || actionLog.completed <= 0) {
      return
    }

    setBusyKey(`load-skill-panel-${outputId}`)
    setErrorMessage(null)

    try {
      const existingLogs = await fetchSkillLogsByActionIds([actionLog.id])
      const outcomeSkills = skillsByOutcome[outputRow.outcomeId] ?? []
      const drafts = buildSkillDraftsFromExistingLogs(outcomeSkills, existingLogs)

      setSkillLogDraftsByOutput((previous) => ({
        ...previous,
        [outputId]: drafts,
      }))

      setExpandedSkillOutputId(outputId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load skill logs'
      setErrorMessage(message)
    } finally {
      setBusyKey(null)
    }
  }

  async function saveSkillsForOutput(outputRow: ScheduledOutput) {
    const outputId = outputRow.output.id
    const actionLog = actionLogByOutputId[outputId]

    if (!actionLog || actionLog.completed <= 0) {
      setErrorMessage('Save output completion before logging skills.')
      return
    }

    const drafts = skillLogDraftsByOutput[outputId] ?? {}
    const { entries: selectedEntries, errorMessage: validationError } = buildSelectedSkillEntries(drafts)

    if (validationError) {
      setErrorMessage(validationError)
      return
    }

    setBusyKey(`save-skills-${outputId}`)
    setErrorMessage(null)

    try {
      const result = await replaceSkillLogsForAction({
        actionLogId: actionLog.id,
        entries: selectedEntries,
      })

      await runGraduationPromptFlow({
        createdSkillIds: result.createdSkillIds,
        skills,
        isSkillEligible: checkGraduationEligibility,
        moveToReview: (skillId) => setSkillStage(skillId, 'review').then(() => undefined),
        suppressGraduation: suppressSkillGraduation,
        confirmMoveToReview: (message) => window.confirm(message),
      })

      setExpandedSkillOutputId(null)
      await loadDashboard(selectedDate)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save skill logs'
      setErrorMessage(message)
    } finally {
      setBusyKey(null)
    }
  }

  if (loading) {
    return (
      <section className="stack">
        <header className="stack-sm">
          <p className="eyebrow">Daily Dashboard</p>
          <h1>Today</h1>
        </header>
        <article className="panel">Loading dashboard...</article>
      </section>
    )
  }

  return (
    <section className="stack">
      <header className="stack-sm">
        <p className="eyebrow">Daily Dashboard</p>
        <h1>Today</h1>
        <p className="muted">Log output actions, skills worked, and confidence updates.</p>
      </header>

      {errorMessage ? <p className="status-bad">{errorMessage}</p> : null}

      {topSuggestedGlobal.length > 0 ? (
        <article className="panel stack-sm">
          <h2>Suggested focus today</h2>
          <div className="stack-xs">
            {topSuggestedGlobal.map((row) => (
              <Link
                className="suggested-link"
                key={row.skill.id}
                to={`/outcomes/${row.skill.outcome_id}/skills/${row.skill.id}`}
              >
                {row.skill.name} <span className="hint">(priority {Math.round(row.finalScore)})</span>
              </Link>
            ))}
          </div>

          {priorityQueue.length > 3 ? (
            <div className="stack-xs">
              <button
                className="btn btn-secondary"
                onClick={() => setShowAllSuggestions((current) => !current)}
                type="button"
              >
                {showAllSuggestions ? 'Hide full list' : 'Show more'}
              </button>

              {showAllSuggestions ? (
                <div className="stack-xs">
                  {priorityQueue.map((row, index) => (
                    <Link
                      className="suggested-link"
                      key={`ranked-${row.skill.id}`}
                      to={`/outcomes/${row.skill.outcome_id}/skills/${row.skill.id}`}
                    >
                      #{index + 1} {row.skill.name}{' '}
                      <span className="hint">
                        ({outcomeTitleById[row.skill.outcome_id] ?? 'Outcome'} · score{' '}
                        {Math.round(row.finalScore)})
                      </span>
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </article>
      ) : null}

      <article className="panel dashboard-controls">
        <label className="form-row" htmlFor="dashboard-date">
          Log date (current week only)
          <input
            id="dashboard-date"
            max={dashboard?.week_end}
            min={dashboard?.week_start}
            onChange={(event) => setSelectedDate(event.target.value)}
            type="date"
            value={selectedDate}
          />
        </label>
        <p className="hint">
          Week: {dashboard?.week_start} to {dashboard?.week_end}
        </p>
      </article>

      <div className="kpi-grid">
        <article className="kpi-card panel">
          <p className="kpi-label">Scheduled Outputs</p>
          <p className="kpi-value">{scheduledOutputs.length}</p>
        </article>
        <article className="kpi-card panel">
          <p className="kpi-label">Completed Today</p>
          <p className="kpi-value">{completedCount}</p>
        </article>
        <article className="kpi-card panel">
          <p className="kpi-label">Completion Rate</p>
          <p className="kpi-value">{completionRate}%</p>
        </article>
        <article className="kpi-card panel">
          <p className="kpi-label">Missed Yesterday</p>
          <p className="kpi-value">{dashboard?.missed_yesterday_count ?? 0}</p>
        </article>
      </div>

      {scheduledOutputs.length === 0 ? (
        <article className="panel">No outputs scheduled for {selectedDate}.</article>
      ) : (
        <div className="stack">
          {scheduledOutputs.map((row) => {
            const { output, outcomeId, outcomeTitle } = row
            const draft = logDrafts[output.id] ?? createLogDraft(output)
            const saveKey = `save-${output.id}`
            const actionLog = actionLogByOutputId[output.id]
            const hasSkills = (skillsByOutcome[outcomeId] ?? []).length > 0
            const showSkillPrompt = Boolean(actionLog && actionLog.completed > 0 && hasSkills)
            const isSaving =
              busyKey === saveKey ||
              busyKey === `quick-done-${output.id}` ||
              busyKey === `quick-missed-${output.id}`
            const isSkillPanelBusy =
              busyKey === `save-skills-${output.id}` ||
              busyKey === `load-skill-panel-${output.id}`

            const drafts = skillLogDraftsByOutput[output.id] ?? {}
            const outcomeSkills = (skillsByOutcome[outcomeId] ?? [])
              .slice()
              .sort((left, right) => {
                const leftScore = skillScoreById[left.id] ?? -1
                const rightScore = skillScoreById[right.id] ?? -1
                return rightScore - leftScore
              })
            const suggested = suggestedByOutcome[outcomeId] ?? []
            const suggestedIds = new Set(suggested.map((item) => item.skill.id))
            const additionalSkills = outcomeSkills.filter((skill) => !suggestedIds.has(skill.id))

            return (
              <article className="panel output-row" key={output.id}>
                <div className="stack-xs">
                  <p className="eyebrow">
                    <Link className="suggested-link" to={`/outcomes/${outcomeId}`}>
                      {outcomeTitle}
                    </Link>
                  </p>
                  <h3>{output.description}</h3>
                  <p className="muted">
                    {frequencyDescription(output)} · Week progress: {output.weekly_progress.completed}/
                    {output.weekly_progress.target} ({output.weekly_progress.rate}%)
                  </p>
                </div>

                <div className="actions-row">
                  <button
                    className="btn"
                    disabled={isSaving}
                    onClick={() => void markDone(output)}
                    type="button"
                  >
                    Mark done
                  </button>
                  <button
                    className="btn btn-secondary"
                    disabled={isSaving}
                    onClick={() => void markMissed(output)}
                    type="button"
                  >
                    Mark missed
                  </button>
                </div>

                <div className="action-form-grid">
                  <label className="form-row" htmlFor={`completed-${output.id}`}>
                    Completed
                    <input
                      id={`completed-${output.id}`}
                      min={0}
                      onChange={(event) =>
                        setLogDraftValue(output.id, 'completed', Number(event.target.value))
                      }
                      type="number"
                      value={draft.completed}
                    />
                  </label>

                  <label className="form-row" htmlFor={`total-${output.id}`}>
                    Total
                    <input
                      id={`total-${output.id}`}
                      min={0}
                      onChange={(event) => setLogDraftValue(output.id, 'total', Number(event.target.value))}
                      type="number"
                      value={draft.total}
                    />
                  </label>
                </div>

                <label className="form-row" htmlFor={`notes-${output.id}`}>
                  Notes (optional)
                  <textarea
                    id={`notes-${output.id}`}
                    maxLength={500}
                    onChange={(event) => setLogDraftValue(output.id, 'notes', event.target.value)}
                    rows={2}
                    value={draft.notes}
                  />
                </label>

                <button
                  className="btn"
                  disabled={isSaving}
                  onClick={() => void persistLog(output.id, draft, saveKey)}
                  type="button"
                >
                  {isSaving ? 'Saving...' : 'Save log'}
                </button>

                {showSkillPrompt ? (
                  <div className="skill-log-shell stack-sm">
                    <button
                      className="btn btn-secondary"
                      disabled={isSkillPanelBusy}
                      onClick={() => void toggleSkillPanel(row)}
                      type="button"
                    >
                      {expandedSkillOutputId === output.id ? 'Hide skills worked' : 'Log skills worked'}
                    </button>

                    {expandedSkillOutputId === output.id ? (
                      <div className="skill-log-panel stack-sm">
                        {suggested.length > 0 ? (
                          <div className="stack-xs">
                            <p className="muted">Suggested today</p>
                            {suggested.map((item) => {
                              const skill = item.skill
                              const draftRow = drafts[skill.id] ?? createEmptySkillLogDraft()

                              return (
                                <div className="skill-row" key={`${output.id}-${skill.id}`}>
                                  <label className="toggle-row" htmlFor={`skill-${output.id}-${skill.id}`}>
                                    <input
                                      checked={draftRow.selected}
                                      id={`skill-${output.id}-${skill.id}`}
                                      onChange={(event) =>
                                        setSkillDraftValue(
                                          output.id,
                                          skill.id,
                                          'selected',
                                          event.target.checked,
                                        )
                                      }
                                      type="checkbox"
                                    />
                                    {skill.name} <span className="hint">(priority {scoreLabel(item.finalScore)})</span>
                                  </label>

                                  {draftRow.selected ? (
                                    <div className="skill-mini-form">
                                      <label className="form-row" htmlFor={`confidence-${output.id}-${skill.id}`}>
                                        Confidence (1-5)
                                        <input
                                          id={`confidence-${output.id}-${skill.id}`}
                                          max={5}
                                          min={1}
                                          onChange={(event) =>
                                            setSkillDraftValue(
                                              output.id,
                                              skill.id,
                                              'confidence',
                                              Number(event.target.value),
                                            )
                                          }
                                          type="number"
                                          value={draftRow.confidence}
                                        />
                                      </label>

                                      {skill.target_label && skill.target_value !== null ? (
                                        <label className="form-row" htmlFor={`target-result-${output.id}-${skill.id}`}>
                                          {skill.target_label}
                                          <input
                                            id={`target-result-${output.id}-${skill.id}`}
                                            onChange={(event) =>
                                              setSkillDraftValue(
                                                output.id,
                                                skill.id,
                                                'targetResult',
                                                event.target.value,
                                              )
                                            }
                                            step="any"
                                            type="number"
                                            value={draftRow.targetResult}
                                          />
                                        </label>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              )
                            })}
                          </div>
                        ) : null}

                        {additionalSkills.length > 0 ? (
                          <div className="stack-xs">
                            <p className="muted">All skills</p>
                            {additionalSkills.map((skill) => {
                              const draftRow = drafts[skill.id] ?? createEmptySkillLogDraft()

                              return (
                                <div className="skill-row" key={`${output.id}-all-${skill.id}`}>
                                  <label className="toggle-row" htmlFor={`skill-all-${output.id}-${skill.id}`}>
                                    <input
                                      checked={draftRow.selected}
                                      id={`skill-all-${output.id}-${skill.id}`}
                                      onChange={(event) =>
                                        setSkillDraftValue(
                                          output.id,
                                          skill.id,
                                          'selected',
                                          event.target.checked,
                                        )
                                      }
                                      type="checkbox"
                                    />
                                    {skill.name} <span className="hint">(priority {scoreLabel(skillScoreById[skill.id])})</span>
                                  </label>

                                  {draftRow.selected ? (
                                    <div className="skill-mini-form">
                                      <label className="form-row" htmlFor={`confidence-all-${output.id}-${skill.id}`}>
                                        Confidence (1-5)
                                        <input
                                          id={`confidence-all-${output.id}-${skill.id}`}
                                          max={5}
                                          min={1}
                                          onChange={(event) =>
                                            setSkillDraftValue(
                                              output.id,
                                              skill.id,
                                              'confidence',
                                              Number(event.target.value),
                                            )
                                          }
                                          type="number"
                                          value={draftRow.confidence}
                                        />
                                      </label>

                                      {skill.target_label && skill.target_value !== null ? (
                                        <label className="form-row" htmlFor={`target-all-${output.id}-${skill.id}`}>
                                          {skill.target_label}
                                          <input
                                            id={`target-all-${output.id}-${skill.id}`}
                                            onChange={(event) =>
                                              setSkillDraftValue(
                                                output.id,
                                                skill.id,
                                                'targetResult',
                                                event.target.value,
                                              )
                                            }
                                            step="any"
                                            type="number"
                                            value={draftRow.targetResult}
                                          />
                                        </label>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              )
                            })}
                          </div>
                        ) : null}

                        <div className="actions-row">
                          <button
                            className="btn"
                            disabled={isSkillPanelBusy}
                            onClick={() => void saveSkillsForOutput(row)}
                            type="button"
                          >
                            {busyKey === `save-skills-${output.id}` ? 'Saving...' : 'Save skills'}
                          </button>
                          <button
                            className="btn btn-secondary"
                            disabled={isSkillPanelBusy}
                            onClick={() => setExpandedSkillOutputId(null)}
                            type="button"
                          >
                            Skip - just log output
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
