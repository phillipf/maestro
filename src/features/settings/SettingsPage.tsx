import { useEffect, useMemo, useState } from 'react'

import { EllipsisIcon } from '../../app/ui/ActionIcons'
import { clearUIEvents, readUIEventCounts, trackUIEvent } from '../../lib/uiTelemetry'
import { useAuth } from '../auth/useAuth'
import {
  fetchOrCreateUserSettings,
  purgeAllAppData,
  updateUserSettings,
  type UserSettingsRow,
} from './settingsApi'
import { startReminderScheduler } from './reminderScheduler'

type SettingsDraft = {
  startOfWeek: 0 | 1
  remindersEnabled: boolean
  dailyReminderTime: string
  weeklyReviewReminderTime: string
}

function toDraft(settings: UserSettingsRow): SettingsDraft {
  return {
    startOfWeek: settings.start_of_week,
    remindersEnabled: settings.reminders_enabled,
    dailyReminderTime: settings.daily_reminder_time ?? '',
    weeklyReviewReminderTime: settings.weekly_review_reminder_time ?? '',
  }
}

export function SettingsPage() {
  const { user } = useAuth()
  const initialPermission =
    typeof Notification === 'undefined' ? 'default' : Notification.permission

  const [settings, setSettings] = useState<UserSettingsRow | null>(null)
  const [draft, setDraft] = useState<SettingsDraft | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [notificationPermission, setNotificationPermission] = useState(initialPermission)
  const [showRemindersPanel, setShowRemindersPanel] = useState(false)
  const [showDataControlsPanel, setShowDataControlsPanel] = useState(false)
  const [showTelemetryPanel, setShowTelemetryPanel] = useState(false)
  const [openActionsPanel, setOpenActionsPanel] = useState<'reminders' | 'telemetry' | null>(null)
  const [telemetryVersion, setTelemetryVersion] = useState(0)
  const [telemetrySummary, setTelemetrySummary] = useState<Array<[string, number]>>([])

  useEffect(() => {
    let cleanup: (() => void) | null = null

    if (settings) {
      cleanup = startReminderScheduler(settings)
    }

    return () => {
      cleanup?.()
    }
  }, [settings])

  useEffect(() => {
    async function loadSettings() {
      setLoading(true)
      setErrorMessage(null)

      try {
        const row = await fetchOrCreateUserSettings()
        setSettings(row)
        setDraft(toDraft(row))
        setShowRemindersPanel(row.reminders_enabled)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load settings'
        setErrorMessage(message)
      } finally {
        setLoading(false)
      }
    }

    void loadSettings()
  }, [])

  const reminderCapabilityText = useMemo(() => {
    if (notificationPermission === 'granted') {
      return 'Browser notification permission granted.'
    }

    if (notificationPermission === 'denied') {
      return 'Browser notification permission denied. Enable it in browser settings to receive reminders.'
    }

    return 'Browser notification permission not granted yet.'
  }, [notificationPermission])

  useEffect(() => {
    if (!showTelemetryPanel) {
      return
    }

    const counts = readUIEventCounts()
    setTelemetrySummary(Object.entries(counts).sort((left, right) => right[1] - left[1]))
  }, [showTelemetryPanel, telemetryVersion])

  useEffect(() => {
    if (!openActionsPanel) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Element && event.target.closest('.menu-shell')) {
        return
      }

      setOpenActionsPanel(null)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenActionsPanel(null)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [openActionsPanel])

  async function handleSaveSettings() {
    if (!settings || !draft) {
      return
    }

    setBusyKey('save-settings')
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const updated = await updateUserSettings({
        id: settings.id,
        start_of_week: draft.startOfWeek,
        reminders_enabled: draft.remindersEnabled,
        daily_reminder_time: draft.dailyReminderTime || null,
        weekly_review_reminder_time: draft.weeklyReviewReminderTime || null,
      })

      setSettings(updated)
      setDraft(toDraft(updated))
      setSuccessMessage('Settings saved.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save settings'
      setErrorMessage(message)
    } finally {
      setBusyKey(null)
    }
  }

  async function handleRequestPermission() {
    if (typeof Notification === 'undefined') {
      setErrorMessage('Notifications are not supported in this browser.')
      return
    }

    const permission = await Notification.requestPermission()
    setNotificationPermission(permission)
  }

  function handleTestNotification() {
    if (typeof Notification === 'undefined') {
      setErrorMessage('Notifications are not supported in this browser.')
      return
    }

    if (Notification.permission !== 'granted') {
      setErrorMessage('Grant notification permission first.')
      return
    }

    new Notification('Maestro', {
      body: 'Test reminder delivered. Browser reminders are best-effort in v1.',
    })
  }

  async function handlePurgeData() {
    const confirmed = window.confirm(
      'Delete all app data? This removes outcomes, outputs, logs, metrics, reflections, and settings.',
    )

    if (!confirmed) {
      return
    }

    setBusyKey('purge-data')
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      await purgeAllAppData()
      setSuccessMessage('All app data deleted. Reloading empty workspace...')
      window.setTimeout(() => {
        window.location.assign('/')
      }, 600)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to purge app data'
      setErrorMessage(message)
    } finally {
      setBusyKey(null)
    }
  }

  if (loading || !settings || !draft) {
    return (
      <section className="stack">
        <header className="stack-sm">
          <p className="eyebrow">Settings</p>
          <h1>Preferences & Data</h1>
        </header>
        <article className="panel">Loading settings...</article>
      </section>
    )
  }

  return (
    <section className="stack">
      <header className="stack-sm">
        <p className="eyebrow">Settings</p>
        <h1>Preferences & Data</h1>
        <p className="muted">Signed in as {user?.email ?? 'unknown user'}.</p>
      </header>

      {errorMessage ? <p className="status-bad">{errorMessage}</p> : null}
      {successMessage ? <p className="status-good">{successMessage}</p> : null}

      <article className="panel stack-sm">
        <h2>Weekly behavior</h2>

        <label className="form-row form-row-medium" htmlFor="start-of-week">
          Start of week
          <select
            id="start-of-week"
            onChange={(event) =>
              setDraft((previous) =>
                previous
                  ? {
                      ...previous,
                      startOfWeek: Number(event.target.value) as 0 | 1,
                    }
                  : previous,
              )
            }
            value={draft.startOfWeek}
          >
            <option value={1}>Monday</option>
            <option value={0}>Sunday</option>
          </select>
        </label>
      </article>

      <article className="panel stack-sm">
        <div className="section-head">
          <h2>Reminders (best-effort in v1)</h2>
          <button
            aria-controls="settings-reminders-panel"
            aria-expanded={showRemindersPanel}
            className="btn btn-secondary"
            onClick={() =>
              setShowRemindersPanel((current) => {
                const nextState = !current
                if (!nextState && openActionsPanel === 'reminders') {
                  setOpenActionsPanel(null)
                }
                trackUIEvent('settings_panel_toggle', {
                  panel: 'reminders',
                  nextState: nextState ? 'open' : 'closed',
                })
                return nextState
              })
            }
            type="button"
          >
            {showRemindersPanel ? 'Close' : 'Configure reminders'}
          </button>
        </div>

        {showRemindersPanel ? (
          <div className="stack-sm form-disclosure" id="settings-reminders-panel">
            <label className="toggle-row" htmlFor="reminders-enabled">
              <input
                checked={draft.remindersEnabled}
                id="reminders-enabled"
                onChange={(event) =>
                  setDraft((previous) =>
                    previous
                      ? {
                          ...previous,
                          remindersEnabled: event.target.checked,
                        }
                      : previous,
                  )
                }
                type="checkbox"
              />
              Enable browser reminders
            </label>

            <label className="form-row form-row-compact" htmlFor="daily-reminder-time">
              Daily reminder time
              <input
                id="daily-reminder-time"
                onChange={(event) =>
                  setDraft((previous) =>
                    previous
                      ? {
                          ...previous,
                          dailyReminderTime: event.target.value,
                        }
                      : previous,
                  )
                }
                type="time"
                value={draft.dailyReminderTime}
              />
            </label>

            <label className="form-row form-row-compact" htmlFor="weekly-reminder-time">
              Weekly review reminder time
              <input
                id="weekly-reminder-time"
                onChange={(event) =>
                  setDraft((previous) =>
                    previous
                      ? {
                          ...previous,
                          weeklyReviewReminderTime: event.target.value,
                        }
                      : previous,
                  )
                }
                type="time"
                value={draft.weeklyReviewReminderTime}
              />
            </label>

            <p className="hint">{reminderCapabilityText}</p>

            <div className="menu-shell">
              <button
                aria-expanded={openActionsPanel === 'reminders'}
                aria-haspopup="menu"
                className="btn btn-secondary icon-btn icon-btn-wide"
                onClick={() => {
                  setOpenActionsPanel((current) => {
                    const nextState = current === 'reminders' ? null : 'reminders'
                    trackUIEvent('settings_actions_menu_toggle', {
                      panel: 'reminders',
                      nextState: nextState === 'reminders' ? 'open' : 'closed',
                    })
                    return nextState
                  })
                }}
                type="button"
              >
                <EllipsisIcon />
                <span>Actions</span>
              </button>

              {openActionsPanel === 'reminders' ? (
                <div className="menu-popover" role="menu">
                  <button
                    className="menu-item-btn"
                    onClick={() => {
                      setOpenActionsPanel(null)
                      trackUIEvent('settings_reminders_action_select', {
                        action: 'request_permission',
                      })
                      void handleRequestPermission()
                    }}
                    role="menuitem"
                    type="button"
                  >
                    Request permission
                  </button>
                  <button
                    className="menu-item-btn"
                    onClick={() => {
                      setOpenActionsPanel(null)
                      trackUIEvent('settings_reminders_action_select', {
                        action: 'send_test_notification',
                      })
                      handleTestNotification()
                    }}
                    role="menuitem"
                    type="button"
                  >
                    Send test notification
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </article>

      <article className="panel stack-sm">
        <div className="section-head">
          <h2>Data controls</h2>
          <button
            aria-controls="settings-data-controls"
            aria-expanded={showDataControlsPanel}
            className="btn btn-secondary"
            onClick={() =>
              setShowDataControlsPanel((current) => {
                const nextState = !current
                trackUIEvent('settings_panel_toggle', {
                  panel: 'data_controls',
                  nextState: nextState ? 'open' : 'closed',
                })
                return nextState
              })
            }
            type="button"
          >
            {showDataControlsPanel ? 'Close' : 'Open danger zone'}
          </button>
        </div>

        {showDataControlsPanel ? (
          <div className="stack-sm form-disclosure" id="settings-data-controls">
            <p className="muted">
              v1 supports deleting all app data. Auth account deletion is deferred to v1.1.
            </p>

            <button
              className="btn btn-secondary"
              disabled={busyKey === 'purge-data'}
              onClick={() => void handlePurgeData()}
              type="button"
            >
              {busyKey === 'purge-data' ? 'Deleting...' : 'Delete all app data'}
            </button>
          </div>
        ) : null}
      </article>

      <article className="panel stack-sm">
        <div className="section-head">
          <h2>UI telemetry (local)</h2>
          <button
            aria-controls="settings-telemetry-panel"
            aria-expanded={showTelemetryPanel}
            className="btn btn-secondary"
            onClick={() =>
              setShowTelemetryPanel((current) => {
                const nextState = !current
                if (!nextState && openActionsPanel === 'telemetry') {
                  setOpenActionsPanel(null)
                }
                trackUIEvent('settings_panel_toggle', {
                  panel: 'ui_telemetry',
                  nextState: nextState ? 'open' : 'closed',
                })
                return nextState
              })
            }
            type="button"
          >
            {showTelemetryPanel ? 'Close' : 'Open telemetry'}
          </button>
        </div>

        {showTelemetryPanel ? (
          <div className="stack-sm form-disclosure" id="settings-telemetry-panel">
            <p className="muted">
              Event counts are stored locally in this browser for UX tuning. No network telemetry is sent.
            </p>

            <div className="menu-shell">
              <button
                aria-expanded={openActionsPanel === 'telemetry'}
                aria-haspopup="menu"
                className="btn btn-secondary icon-btn icon-btn-wide"
                onClick={() => {
                  setOpenActionsPanel((current) => {
                    const nextState = current === 'telemetry' ? null : 'telemetry'
                    trackUIEvent('settings_actions_menu_toggle', {
                      panel: 'ui_telemetry',
                      nextState: nextState === 'telemetry' ? 'open' : 'closed',
                    })
                    return nextState
                  })
                }}
                type="button"
              >
                <EllipsisIcon />
                <span>Actions</span>
              </button>

              {openActionsPanel === 'telemetry' ? (
                <div className="menu-popover" role="menu">
                  <button
                    className="menu-item-btn"
                    onClick={() => {
                      setOpenActionsPanel(null)
                      trackUIEvent('settings_telemetry_action_select', {
                        action: 'refresh_summary',
                      })
                      setTelemetryVersion((value) => value + 1)
                    }}
                    role="menuitem"
                    type="button"
                  >
                    Refresh summary
                  </button>
                  <button
                    className="menu-item-btn"
                    onClick={() => {
                      setOpenActionsPanel(null)
                      trackUIEvent('settings_telemetry_action_select', {
                        action: 'clear_telemetry',
                      })
                      clearUIEvents()
                      setTelemetryVersion((value) => value + 1)
                    }}
                    role="menuitem"
                    type="button"
                  >
                    Clear telemetry
                  </button>
                </div>
              ) : null}
            </div>

            {telemetrySummary.length === 0 ? (
              <p className="muted">No UI telemetry events captured yet.</p>
            ) : (
              <div className="stack-xs">
                {telemetrySummary.map(([name, count]) => (
                  <p key={name}>
                    <strong>{name}</strong>: {count}
                  </p>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </article>

      <button
        className="btn"
        disabled={busyKey === 'save-settings'}
        onClick={() => void handleSaveSettings()}
        type="button"
      >
        {busyKey === 'save-settings' ? 'Saving...' : 'Save settings'}
      </button>
    </section>
  )
}
