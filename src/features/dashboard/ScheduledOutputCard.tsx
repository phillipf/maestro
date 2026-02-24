import { useCallback, useState } from 'react'
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
import { EllipsisIcon } from '../../app/ui/ActionIcons'
import { useActionsMenu } from '../../app/ui/useActionsMenu'
import { trackUIEvent } from '../../lib/uiTelemetry'

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
  const [showNotesField, setShowNotesField] = useState(() => draft.notes.trim().length > 0)
  const [showActionsMenu, setShowActionsMenu] = useState(false)

  const closeActionsMenu = useCallback(() => {
    setShowActionsMenu(false)
  }, [])

  useActionsMenu({
    isOpen: showActionsMenu,
    menuSelector: '.scheduled-output-actions',
    onClose: closeActionsMenu,
  })

  const adjustDraftNumber = (key: 'completed' | 'total', delta: number) => {
    const nextValue = Math.max(0, draft[key] + delta)
    onSetLogDraftValue(output.id, key, nextValue)
  }
  const notesVisible = showNotesField

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
          onClick={() => {
            trackUIEvent('dashboard.log.quick', {
              action: 'mark_done',
              outputId: output.id,
              outcomeId,
            })
            void onMarkDone(output)
          }}
          type="button"
        >
          Mark done
        </button>
        <button
          className="btn btn-secondary"
          disabled={isSaving}
          onClick={() => {
            trackUIEvent('dashboard.log.quick', {
              action: 'mark_missed',
              outputId: output.id,
              outcomeId,
            })
            void onMarkMissed(output)
          }}
          type="button"
        >
          Mark missed
        </button>

        <div className="menu-shell scheduled-output-actions">
          <button
            aria-expanded={showActionsMenu}
            aria-haspopup="menu"
            className="btn btn-secondary icon-btn icon-btn-wide"
            onClick={() =>
              setShowActionsMenu((current) => {
                const next = !current

                if (next) {
                  trackUIEvent('dashboard.actions.open', {
                    outputId: output.id,
                    outcomeId,
                  })
                }

                return next
              })
            }
            type="button"
          >
            <EllipsisIcon />
            <span>Actions</span>
          </button>
          {showActionsMenu ? (
            <div className="menu-popover" role="menu">
              <button
                className="menu-item-btn"
                onClick={() => {
                  setShowActionsMenu(false)
                  setShowNotesField((current) => !current)
                  trackUIEvent('dashboard.actions.select', {
                    action: notesVisible ? 'hide_note' : 'add_note',
                    outputId: output.id,
                    outcomeId,
                  })
                }}
                role="menuitem"
                type="button"
              >
                {notesVisible ? 'Hide note' : 'Add note'}
              </button>
              {showSkillPrompt ? (
                <button
                  className="menu-item-btn"
                  disabled={isSkillPanelBusy}
                  onClick={() => {
                    setShowActionsMenu(false)
                    trackUIEvent('dashboard.actions.select', {
                      action: expandedSkillOutputId === output.id ? 'hide_skills_panel' : 'open_skills_panel',
                      outputId: output.id,
                      outcomeId,
                    })
                    void onToggleSkillPanel(row)
                  }}
                  role="menuitem"
                  type="button"
                >
                  {expandedSkillOutputId === output.id ? 'Hide skills worked' : 'Log skills worked'}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="action-form-grid">
        <label className="form-row numeric-log-field" htmlFor={`completed-${output.id}`}>
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

        <label className="form-row numeric-log-field" htmlFor={`total-${output.id}`}>
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

      {notesVisible ? (
        <label className="form-row" htmlFor={`notes-${output.id}`} id={`notes-panel-${output.id}`}>
          Notes (optional)
          <textarea
            id={`notes-${output.id}`}
            maxLength={500}
            onChange={(event) => onSetLogDraftValue(output.id, 'notes', event.target.value)}
            rows={2}
            value={draft.notes}
          />
        </label>
      ) : null}

      <button
        className="btn"
        disabled={isSaving}
        onClick={() => {
          trackUIEvent('dashboard.log.save', {
            outputId: output.id,
            outcomeId,
          })
          void onPersistLog(output.id, draft, saveKey)
        }}
        type="button"
      >
        {isSaving ? 'Saving...' : 'Save log'}
      </button>

      {showSkillPrompt && expandedSkillOutputId === output.id ? (
        <div className="skill-log-shell stack-sm">
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
                          <label
                            className="form-row form-row-compact"
                            htmlFor={`confidence-${output.id}-${skill.id}`}
                          >
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
                            <label
                              className="form-row form-row-compact"
                              htmlFor={`target-result-${output.id}-${skill.id}`}
                            >
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
                          <label
                            className="form-row form-row-compact"
                            htmlFor={`confidence-all-${output.id}-${skill.id}`}
                          >
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
                            <label
                              className="form-row form-row-compact"
                              htmlFor={`target-all-${output.id}-${skill.id}`}
                            >
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
                onClick={() => {
                  trackUIEvent('dashboard.skills.save', {
                    outputId: output.id,
                    outcomeId,
                  })
                  void onSaveSkillsForOutput(row)
                }}
                type="button"
              >
                {busyKey === `save-skills-${output.id}` ? 'Saving...' : 'Save skills'}
              </button>
              <button
                className="btn btn-secondary"
                disabled={isSkillPanelBusy}
                onClick={() => {
                  trackUIEvent('dashboard.skills.skip', {
                    outputId: output.id,
                    outcomeId,
                  })
                  onCloseSkillPanel()
                }}
                type="button"
              >
                Skip - just log output
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  )
}

export type { ScheduledOutput }
