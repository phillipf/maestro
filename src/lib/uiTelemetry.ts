type TelemetryValue = string | number | boolean | null

export type UITelemetryPayload = Record<string, TelemetryValue>

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

export function trackUIEvent(name: string, payload: UITelemetryPayload = {}) {
  if (typeof window === 'undefined') {
    return
  }

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
