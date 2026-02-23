import { Link } from 'react-router-dom'

import type { ActionLogLookupRow } from './dashboardApi'
import {
  createEmptySkillLogDraft,
  frequencyDescription,
  scoreLabel,
  type LogDraft,
  type SkillLogDraft,
} from './dashboardWorkflows'
import type { DashboardOutput } from './types'
import type { SkillItemRow, SkillPriority } from '../skills/types'

type ScheduledOutput = {
  outcomeId: string
  outcomeTitle: string
  output: DashboardOutput
}

type ScheduledOutputCardProps = {
  row: ScheduledOutput
  draft: LogDraft
  saveKey: string
  actionLog: ActionLogLookupRow | undefined
  hasSkills: boolean
  isSaving: boolean
  isSkillPanelBusy: boolean
  expandedSkillOutputId: string | null
  drafts: Record<string, SkillLogDraft>
  suggested: SkillPriority[]
  additionalSkills: SkillItemRow[]
  skillScoreById: Record<string, number>
  busyKey: string | null
  onMarkDone: (output: DashboardOutput) => void | Promise<void>
  onMarkMissed: (output: DashboardOutput) => void | Promise<void>
  onSetLogDraftValue: <K extends keyof LogDraft>(
    outputId: string,
    key: K,
    value: LogDraft[K],
  ) => void
  onPersistLog: (outputId: string, draft: LogDraft, opKey: string) => void | Promise<void>
  onToggleSkillPanel: (row: ScheduledOutput) => void | Promise<void>
  onSetSkillDraftValue: <K extends keyof SkillLogDraft>(
    outputId: string,
    skillId: string,
    key: K,
    value: SkillLogDraft[K],
  ) => void
  onSaveSkillsForOutput: (row: ScheduledOutput) => void | Promise<void>
  onCloseSkillPanel: () => void
}

export function ScheduledOutputCard({
  row,
  draft,
  saveKey,
  actionLog,
  hasSkills,
  isSaving,
  isSkillPanelBusy,
  expandedSkillOutputId,
  drafts,
  suggested,
  additionalSkills,
  skillScoreById,
  busyKey,
  onMarkDone,
  onMarkMissed,
  onSetLogDraftValue,
  onPersistLog,
  onToggleSkillPanel,
  onSetSkillDraftValue,
  onSaveSkillsForOutput,
  onCloseSkillPanel,
}: ScheduledOutputCardProps) {
  const { output, outcomeId, outcomeTitle } = row
  const showSkillPrompt = Boolean(actionLog && actionLog.completed > 0 && hasSkills)
  const adjustDraftNumber = (key: 'completed' | 'total', delta: number) => {
    const nextValue = Math.max(0, draft[key] + delta)
    onSetLogDraftValue(output.id, key, nextValue)
  }

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
          onClick={() => void onMarkDone(output)}
          type="button"
        >
          Mark done
        </button>
        <button
          className="btn btn-secondary"
          disabled={isSaving}
          onClick={() => void onMarkMissed(output)}
          type="button"
        >
          Mark missed
        </button>
      </div>

      <div className="action-form-grid">
        <label className="form-row" htmlFor={`completed-${output.id}`}>
          Completed
          <div className="number-input-shell">
            <input
              id={`completed-${output.id}`}
              min={0}
              onChange={(event) =>
                onSetLogDraftValue(output.id, 'completed', Number(event.target.value))
              }
              step={1}
              type="number"
              value={draft.completed}
            />
            <div aria-label="Adjust completed value" className="number-stepper" role="group">
              <button
                aria-label={`Increase completed for ${output.description}`}
                className="number-step-btn"
                onClick={() => adjustDraftNumber('completed', 1)}
                type="button"
              >
                +
              </button>
              <button
                aria-label={`Decrease completed for ${output.description}`}
                className="number-step-btn"
                disabled={draft.completed <= 0}
                onClick={() => adjustDraftNumber('completed', -1)}
                type="button"
              >
                -
              </button>
            </div>
          </div>
        </label>

        <label className="form-row" htmlFor={`total-${output.id}`}>
          Total
          <div className="number-input-shell">
            <input
              id={`total-${output.id}`}
              min={0}
              onChange={(event) => onSetLogDraftValue(output.id, 'total', Number(event.target.value))}
              step={1}
              type="number"
              value={draft.total}
            />
            <div aria-label="Adjust total value" className="number-stepper" role="group">
              <button
                aria-label={`Increase total for ${output.description}`}
                className="number-step-btn"
                onClick={() => adjustDraftNumber('total', 1)}
                type="button"
              >
                +
              </button>
              <button
                aria-label={`Decrease total for ${output.description}`}
                className="number-step-btn"
                disabled={draft.total <= 0}
                onClick={() => adjustDraftNumber('total', -1)}
                type="button"
              >
                -
              </button>
            </div>
          </div>
        </label>
      </div>

      <label className="form-row" htmlFor={`notes-${output.id}`}>
        Notes (optional)
        <textarea
          id={`notes-${output.id}`}
          maxLength={500}
          onChange={(event) => onSetLogDraftValue(output.id, 'notes', event.target.value)}
          rows={2}
          value={draft.notes}
        />
      </label>

      <button
        className="btn"
        disabled={isSaving}
        onClick={() => void onPersistLog(output.id, draft, saveKey)}
        type="button"
      >
        {isSaving ? 'Saving...' : 'Save log'}
      </button>

      {showSkillPrompt ? (
        <div className="skill-log-shell stack-sm">
          <button
            className="btn btn-secondary"
            disabled={isSkillPanelBusy}
            onClick={() => void onToggleSkillPanel(row)}
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
                              onSetSkillDraftValue(
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
                                  onSetSkillDraftValue(
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
                                    onSetSkillDraftValue(
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
                              onSetSkillDraftValue(
                                output.id,
                                skill.id,
                                'selected',
                                event.target.checked,
                              )
                            }
                            type="checkbox"
                          />
                          {skill.name}{' '}
                          <span className="hint">(priority {scoreLabel(skillScoreById[skill.id])})</span>
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
                                  onSetSkillDraftValue(
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
                                    onSetSkillDraftValue(
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
                  onClick={() => void onSaveSkillsForOutput(row)}
                  type="button"
                >
                  {busyKey === `save-skills-${output.id}` ? 'Saving...' : 'Save skills'}
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={isSkillPanelBusy}
                  onClick={onCloseSkillPanel}
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
}

export type { ScheduledOutput }
