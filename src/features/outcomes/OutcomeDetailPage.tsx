import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  fetchOutcomeById,
  fetchOutputsByOutcome,
  updateOutcome,
} from './outcomesApi'
import type { OutcomeRow, OutputRow, OutcomeStatus } from './types'
import {
  createSkillItem,
  fetchSkillsForOutcome,
  setSkillStage,
  updateSkillItem,
} from '../skills/skillsApi'
import { computePriorityQueue, groupSkillLogsBySkill } from '../skills/priority'
import type { SkillItemRow, SkillLogRow, SkillStage } from '../skills/types'
import { EllipsisIcon, PencilIcon } from '../../app/ui/ActionIcons'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type SkillDraft = {
  name: string
  targetLabel: string
  targetValue: string
  initialConfidence: number
}

function frequencyLabel(output: OutputRow): string {
  if (output.frequency_type === 'daily') {
    return 'Daily'
  }

  if (output.frequency_type === 'flexible_weekly') {
    return `${output.frequency_value}x/week (flexible)`
  }

  const days = (output.schedule_weekdays ?? []).map((day) => WEEKDAY_LABELS[day]).join(', ')
  return `Fixed weekly (${days || 'no days'})`
}

function statusPillLabel(status: OutcomeStatus): string {
  return status
}

function skillStageActions(stage: SkillStage): SkillStage[] {
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

export function OutcomeDetailPage() {
  const { outcomeId } = useParams<{ outcomeId: string }>()

  const [outcome, setOutcome] = useState<OutcomeRow | null>(null)
  const [outputs, setOutputs] = useState<OutputRow[]>([])
  const [skills, setSkills] = useState<SkillItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showAddSkillForm, setShowAddSkillForm] = useState(false)
  const [openSkillActionsId, setOpenSkillActionsId] = useState<string | null>(null)

  const [skillDraft, setSkillDraft] = useState<SkillDraft>({
    name: '',
    targetLabel: '',
    targetValue: '',
    initialConfidence: 1,
  })

  const loadData = useCallback(async () => {
    if (!outcomeId) {
      setErrorMessage('Missing outcome id')
      setLoading(false)
      return
    }

    setLoading(true)
    setErrorMessage(null)

    try {
      const [outcomeRow, outputRows, skillData] = await Promise.all([
        fetchOutcomeById(outcomeId),
        fetchOutputsByOutcome(outcomeId),
        fetchSkillsForOutcome(outcomeId),
      ])

      setOutcome(outcomeRow)
      setOutputs(outputRows)
      setSkills(skillData.skills)
      setSkillLogs(skillData.logs)
      setOpenSkillActionsId(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load outcome detail'
      setErrorMessage(message)
    } finally {
      setLoading(false)
    }
  }, [outcomeId])

  const [skillLogs, setSkillLogs] = useState<SkillLogRow[]>([])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (!openSkillActionsId) {
      return
    }

    function handleDocumentClick(event: MouseEvent) {
      if (!(event.target instanceof Element)) {
        return
      }

      if (event.target.closest('.menu-shell')) {
        return
      }

      setOpenSkillActionsId(null)
    }

    window.addEventListener('click', handleDocumentClick)
    return () => window.removeEventListener('click', handleDocumentClick)
  }, [openSkillActionsId])

  useEffect(() => {
    if (!showAddSkillForm) {
      return
    }

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setShowAddSkillForm(false)
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [showAddSkillForm])

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenSkillActionsId(null)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [])

  const priorityQueue = useMemo(
    () => computePriorityQueue(skills, skillLogs),
    [skills, skillLogs],
  )

  const priorityMap = useMemo(() => {
    return priorityQueue.reduce<Record<string, number>>((acc, row) => {
      acc[row.skill.id] = row.finalScore
      return acc
    }, {})
  }, [priorityQueue])

  const latestConfidenceMap = useMemo(() => {
    const grouped = groupSkillLogsBySkill(skillLogs)

    return skills.reduce<Record<string, number>>((acc, skill) => {
      const latest = grouped.get(skill.id)?.[0]
      acc[skill.id] = latest ? latest.confidence : skill.initial_confidence
      return acc
    }, {})
  }, [skillLogs, skills])

  async function handleOutcomeEdit() {
    if (!outcome) {
      return
    }

    const title = window.prompt('Outcome title', outcome.title)

    if (title === null) {
      return
    }

    const category = window.prompt('Category', outcome.category ?? '')

    if (category === null) {
      return
    }

    setBusyKey('edit-outcome')
    setErrorMessage(null)

    try {
      const updated = await updateOutcome(outcome.id, {
        title,
        category,
      })
      setOutcome(updated)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update outcome'
      setErrorMessage(message)
    } finally {
      setBusyKey(null)
    }
  }

  async function handleCreateSkill() {
    if (!outcomeId) {
      return
    }

    if (!skillDraft.name.trim()) {
      setErrorMessage('Skill name is required.')
      return
    }

    const targetLabel = skillDraft.targetLabel.trim()
    const targetValueNumber = skillDraft.targetValue ? Number(skillDraft.targetValue) : undefined

    if (targetLabel && (targetValueNumber === undefined || Number.isNaN(targetValueNumber))) {
      setErrorMessage('Target value must be numeric when target label is set.')
      return
    }

    setBusyKey('create-skill')
    setErrorMessage(null)

    try {
      await createSkillItem({
        outcomeId,
        name: skillDraft.name,
        initialConfidence: skillDraft.initialConfidence,
        targetLabel: targetLabel || undefined,
        targetValue: targetValueNumber,
      })

      setSkillDraft({
        name: '',
        targetLabel: '',
        targetValue: '',
        initialConfidence: 1,
      })
      setShowAddSkillForm(false)

      await loadData()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create skill'
      setErrorMessage(message)
    } finally {
      setBusyKey(null)
    }
  }

  async function handleEditSkill(skill: SkillItemRow) {
    setOpenSkillActionsId(null)
    const nextName = window.prompt('Skill name', skill.name)

    if (nextName === null) {
      return
    }

    const nextTargetLabel = window.prompt('Target label (leave blank for none)', skill.target_label ?? '')

    if (nextTargetLabel === null) {
      return
    }

    const nextTargetValueInput = window.prompt(
      'Target value (leave blank for none)',
      skill.target_value === null ? '' : String(skill.target_value),
    )

    if (nextTargetValueInput === null) {
      return
    }

    const nextConfidenceInput = window.prompt(
      'Initial confidence (1-5)',
      String(skill.initial_confidence),
    )

    if (nextConfidenceInput === null) {
      return
    }

    const nextConfidence = Number(nextConfidenceInput)

    if (Number.isNaN(nextConfidence) || nextConfidence < 1 || nextConfidence > 5) {
      setErrorMessage('Initial confidence must be between 1 and 5.')
      return
    }

    const targetLabel = nextTargetLabel.trim() || undefined
    const targetValue = nextTargetValueInput.trim() ? Number(nextTargetValueInput) : undefined

    if (targetLabel && (targetValue === undefined || Number.isNaN(targetValue))) {
      setErrorMessage('Target value must be numeric when target label is set.')
      return
    }

    setBusyKey(`edit-skill-${skill.id}`)
    setErrorMessage(null)

    try {
      await updateSkillItem(skill.id, {
        name: nextName,
        targetLabel,
        targetValue,
        initialConfidence: nextConfidence,
      })
      await loadData()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update skill'
      setErrorMessage(message)
    } finally {
      setBusyKey(null)
    }
  }

  async function handleSkillStage(skill: SkillItemRow, stage: SkillStage) {
    setOpenSkillActionsId(null)
    setBusyKey(`skill-stage-${skill.id}`)
    setErrorMessage(null)

    try {
      await setSkillStage(skill.id, stage)
      await loadData()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update skill stage'
      setErrorMessage(message)
    } finally {
      setBusyKey(null)
    }
  }

  if (loading) {
    return (
      <section className="stack">
        <header className="stack-sm">
          <p className="eyebrow">Outcome Detail</p>
          <h1>Loading...</h1>
        </header>
        <article className="panel">Loading outcome detail...</article>
      </section>
    )
  }

  if (!outcome) {
    return (
      <section className="stack">
        <header className="stack-sm">
          <p className="eyebrow">Outcome Detail</p>
          <h1>Outcome not found</h1>
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
        <p className="eyebrow">Outcome Detail</p>
        <h1>{outcome.title}</h1>
        <p className="muted">{outcome.category || 'No category'} · {statusPillLabel(outcome.status)}</p>
      </header>

      {errorMessage ? <p className="status-bad">{errorMessage}</p> : null}

      <article className="panel outcome-detail-header">
        <Link className="btn btn-secondary" to="/outcomes">
          Back to outcomes
        </Link>
        <div className="actions-row">
          <button className="btn" onClick={() => setShowAddSkillForm(true)} type="button">
            + Add skill
          </button>
          <button
            aria-label={`Edit ${outcome.title}`}
            className="btn btn-secondary icon-btn"
            disabled={busyKey === 'edit-outcome'}
            onClick={() => void handleOutcomeEdit()}
            title={`Edit ${outcome.title}`}
            type="button"
          >
            <PencilIcon />
          </button>
        </div>
      </article>

      <article className="panel stack-sm">
        <h2>Outputs</h2>
        {outputs.length === 0 ? <p className="muted">No outputs yet.</p> : null}
        {outputs.map((output) => (
          <div className="output-row" key={output.id}>
            <p>
              <strong>{output.description}</strong>
            </p>
            <p className="muted">
              {frequencyLabel(output)} · {output.status}
            </p>
          </div>
        ))}
      </article>

      <article className="panel stack-sm">
        <h2>Skills</h2>

        {skills.length === 0 ? <p className="muted">No skills yet.</p> : null}

        {skills
          .slice()
          .sort((a, b) => {
            const left = priorityMap[a.id] ?? -1
            const right = priorityMap[b.id] ?? -1
            return right - left
          })
          .map((skill) => (
            <div className="output-row" key={skill.id}>
              <div className="stack-xs">
                <p>
                  <strong>
                    <Link className="entity-title-link" to={`/outcomes/${outcome.id}/skills/${skill.id}`}>
                      {skill.name}
                    </Link>
                  </strong>
                </p>
                <p className="muted">
                  stage: {skill.stage} · latest confidence: {latestConfidenceMap[skill.id]}
                  {skill.target_label && skill.target_value !== null
                    ? ` · target: ${skill.target_label} (${skill.target_value})`
                    : ''}
                </p>
                <p className="hint">
                  priority score: {priorityMap[skill.id] !== undefined ? priorityMap[skill.id] : 'n/a'}
                </p>
              </div>

              <div className="actions-row">
                <button
                  aria-label={`Edit ${skill.name}`}
                  className="btn btn-secondary icon-btn"
                  disabled={busyKey === `edit-skill-${skill.id}`}
                  onClick={() => void handleEditSkill(skill)}
                  title={`Edit ${skill.name}`}
                  type="button"
                >
                  <PencilIcon />
                </button>
                <div className="menu-shell">
                  <button
                    aria-expanded={openSkillActionsId === skill.id}
                    aria-haspopup="menu"
                    className="btn btn-secondary icon-btn icon-btn-wide"
                    onClick={() =>
                      setOpenSkillActionsId((current) => (current === skill.id ? null : skill.id))
                    }
                    type="button"
                  >
                    <EllipsisIcon />
                    <span>Actions</span>
                  </button>
                  {openSkillActionsId === skill.id ? (
                    <div className="menu-popover" role="menu">
                      {skillStageActions(skill.stage).map((stage) => (
                        <button
                          className="menu-item-btn"
                          disabled={busyKey === `skill-stage-${skill.id}`}
                          key={`${skill.id}-${stage}`}
                          onClick={() => void handleSkillStage(skill, stage)}
                          role="menuitem"
                          type="button"
                        >
                          {stageButtonLabel(stage)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
      </article>

      {showAddSkillForm ? (
        <div
          className="modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowAddSkillForm(false)
            }
          }}
          role="presentation"
        >
          <div aria-modal="true" className="modal-card panel stack-sm" role="dialog">
            <div className="section-head">
              <h2>Add skill</h2>
              <button
                aria-label="Close add skill form"
                className="btn btn-secondary icon-btn"
                onClick={() => setShowAddSkillForm(false)}
                type="button"
              >
                x
              </button>
            </div>

            <div className="field-grid">
              <label className="form-row" htmlFor="skill-name">
                Name
                <input
                  id="skill-name"
                  onChange={(event) =>
                    setSkillDraft((previous) => ({
                      ...previous,
                      name: event.target.value,
                    }))
                  }
                  value={skillDraft.name}
                />
              </label>

              <label className="form-row" htmlFor="skill-target-label">
                Target label (optional)
                <input
                  id="skill-target-label"
                  onChange={(event) =>
                    setSkillDraft((previous) => ({
                      ...previous,
                      targetLabel: event.target.value,
                    }))
                  }
                  value={skillDraft.targetLabel}
                />
              </label>

              <label className="form-row form-row-compact" htmlFor="skill-target-value">
                Target value (optional)
                <input
                  id="skill-target-value"
                  onChange={(event) =>
                    setSkillDraft((previous) => ({
                      ...previous,
                      targetValue: event.target.value,
                    }))
                  }
                  step="any"
                  type="number"
                  value={skillDraft.targetValue}
                />
              </label>

              <label className="form-row form-row-compact" htmlFor="skill-initial-confidence">
                Initial confidence
                <input
                  id="skill-initial-confidence"
                  max={5}
                  min={1}
                  onChange={(event) =>
                    setSkillDraft((previous) => ({
                      ...previous,
                      initialConfidence: Number(event.target.value),
                    }))
                  }
                  type="number"
                  value={skillDraft.initialConfidence}
                />
              </label>
            </div>

            <div className="actions-row">
              <button
                className="btn"
                disabled={busyKey === 'create-skill'}
                onClick={() => void handleCreateSkill()}
                type="button"
              >
                {busyKey === 'create-skill' ? 'Creating...' : 'Create skill'}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowAddSkillForm(false)} type="button">
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
