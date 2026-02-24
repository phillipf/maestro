type TelemetryValue = string | number | boolean | null

export type UITelemetryPayload = Record<string, TelemetryValue>

type EmptyPayload = Record<string, never>

type OutcomesCreateOpenPayload =
  | { entity: 'outcome' }
  | { entity: 'output'; outcomeId: string }

type OutcomesCreateSuccessPayload =
  | { entity: 'outcome' }
  | { entity: 'output'; outcomeId: string }

type OutcomesEditOpenPayload =
  | { entity: 'outcome'; outcomeId: string }
  | { entity: 'output'; outputId: string; outcomeId: string }

type OutcomesActionsOpenPayload =
  | { entity: 'outcome'; outcomeId: string }
  | { entity: 'output'; outputId: string; outcomeId: string }

type OutcomesActionsSelectPayload =
  | { entity: 'outcome'; action: string; outcomeId: string }
  | { entity: 'output'; action: string; outputId: string; outcomeId: string }

type OutcomeDetailEditOpenPayload =
  | { entity: 'outcome'; outcomeId: string }
  | { entity: 'skill'; outcomeId: string; skillId: string }

type OutcomeDetailSkillPayload = {
  entity: 'skill'
  outcomeId: string
  skillId: string
}

type MetricsCreateSuccessPayload =
  | { entity: 'metric'; metricId: string; outcomeId: string }
  | { entity: 'metric_entry'; metricId: string }

type MetricsEditOpenPayload =
  | { entity: 'metric'; metricId: string; outcomeId: string }
  | { entity: 'metric_entry'; entryId: string; metricId: string }

type MetricsActionsOpenPayload =
  | { entity: 'metric'; metricId: string; outcomeId: string }
  | { entity: 'metric_entry'; entryId: string; metricId: string }

type MetricsActionsSelectPayload =
  | { entity: 'metric'; action: string; metricId: string; outcomeId: string }
  | { entity: 'metric_entry'; action: string; entryId: string }

type DashboardSkillOpenPayload = {
  entity: 'skill'
  outcomeId: string
  skillId: string
  source: 'top_suggested' | 'full_suggested'
}

type DashboardOutputPayload = {
  outputId: string
  outcomeId: string
}

type DashboardLogQuickPayload = DashboardOutputPayload & {
  action: 'mark_done' | 'mark_missed'
}

type DashboardActionSelectPayload = DashboardOutputPayload & {
  action: 'hide_note' | 'add_note' | 'hide_skills_panel' | 'open_skills_panel'
}

type PanelTogglePayload = {
  panel: 'reminders' | 'data_controls' | 'ui_telemetry'
  nextState: 'open' | 'closed'
}

type SettingsActionsMenuTogglePayload = {
  panel: 'reminders' | 'ui_telemetry'
  nextState: 'open' | 'closed'
}

type WeeklyPanelTogglePayload = {
  nextState: 'open' | 'closed'
}

export type UIEventPayloadByName = {
  'outcomes.create.open': OutcomesCreateOpenPayload
  'outcomes.create.success': OutcomesCreateSuccessPayload
  'outcomes.edit.open': OutcomesEditOpenPayload
  'outcomes.actions.open': OutcomesActionsOpenPayload
  'outcomes.actions.select': OutcomesActionsSelectPayload
  'outcomes.entity.open': { entity: 'outcome'; outcomeId: string }
  'outcomes.filter.open': EmptyPayload
  'outcomes.filter.apply': { value: string }
  'outcomeDetail.create.open': { entity: 'skill'; outcomeId: string }
  'outcomeDetail.create.success': { entity: 'skill'; outcomeId: string }
  'outcomeDetail.edit.open': OutcomeDetailEditOpenPayload
  'outcomeDetail.actions.open': OutcomeDetailSkillPayload
  'outcomeDetail.actions.select': OutcomeDetailSkillPayload & { action: string }
  'outcomeDetail.entity.open': OutcomeDetailSkillPayload
  'skillDetail.actions.open': { entity: 'skill'; outcomeId: string; skillId: string }
  'skillDetail.actions.select': { entity: 'skill'; action: string; outcomeId: string; skillId: string }
  'metrics.create.open': { entity: 'metric' }
  'metrics.create.success': MetricsCreateSuccessPayload
  'metrics.edit.open': MetricsEditOpenPayload
  'metrics.actions.open': MetricsActionsOpenPayload
  'metrics.actions.select': MetricsActionsSelectPayload
  'dashboard.entity.open': DashboardSkillOpenPayload
  'dashboard.log.quick': DashboardLogQuickPayload
  'dashboard.log.save': DashboardOutputPayload
  'dashboard.actions.open': DashboardOutputPayload
  'dashboard.actions.select': DashboardActionSelectPayload
  'dashboard.skills.save': DashboardOutputPayload
  'dashboard.skills.skip': DashboardOutputPayload
  settings_panel_toggle: PanelTogglePayload
  settings_actions_menu_toggle: SettingsActionsMenuTogglePayload
  settings_reminders_action_select: { action: 'request_permission' | 'send_test_notification' }
  settings_telemetry_action_select: { action: 'refresh_summary' | 'clear_telemetry' }
  weekly_review_outcome_open: { outcomeId: string }
  weekly_review_shortfall_panel_toggle: { outputId: string } & WeeklyPanelTogglePayload
  weekly_review_reflection_panel_toggle: { outcomeId: string } & WeeklyPanelTogglePayload
}

export type UIEventName = keyof UIEventPayloadByName

type TrackUIEventArgs<T extends UIEventName> =
  keyof UIEventPayloadByName[T] extends never
    ? [payload?: UIEventPayloadByName[T]]
    : [payload: UIEventPayloadByName[T]]

export type UITelemetryEvent = {
  name: string
  timestamp: string
  payload: UITelemetryPayload
}

const STORAGE_KEY = 'maestro.uiTelemetry.v1'
const MAX_EVENTS = 500

function isValidEvent(value: unknown): value is UITelemetryEvent {
  if (!value || typeof value !== 'object') {
    return false
  }

  const maybeEvent = value as Partial<UITelemetryEvent>
  return (
    typeof maybeEvent.name === 'string' &&
    typeof maybeEvent.timestamp === 'string' &&
    typeof maybeEvent.payload === 'object' &&
    maybeEvent.payload !== null
  )
}

function readEvents(): UITelemetryEvent[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as unknown

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(isValidEvent)
  } catch {
    return []
  }
}

function writeEvents(events: UITelemetryEvent[]) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  } catch {
    // Ignore storage errors to keep telemetry non-blocking.
  }
}

export function trackUIEvent<T extends UIEventName>(name: T, ...args: TrackUIEventArgs<T>) {
  if (typeof window === 'undefined') {
    return
  }

  const payload = (args[0] ?? {}) as UITelemetryPayload
  const nextEvent: UITelemetryEvent = {
    name,
    payload,
    timestamp: new Date().toISOString(),
  }

  const events = readEvents()
  const nextEvents = [...events, nextEvent].slice(-MAX_EVENTS)
  writeEvents(nextEvents)

  if (import.meta.env.DEV) {
    // Keep a visible trail during local tuning without adding network dependencies.
    console.debug('[ui-telemetry]', nextEvent)
  }
}

export function readUIEventCounts(): Record<string, number> {
  return readEvents().reduce<Record<string, number>>((acc, event) => {
    acc[event.name] = (acc[event.name] ?? 0) + 1
    return acc
  }, {})
}

export function clearUIEvents() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore storage errors to keep telemetry non-blocking.
  }
}
