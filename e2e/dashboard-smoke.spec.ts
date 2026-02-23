import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    type Row = Record<string, unknown>
    type Filter =
      | { type: 'eq'; field: string; value: unknown }
      | { type: 'in'; field: string; values: unknown[] }
      | { type: 'lt'; field: string; value: unknown }
      | { type: 'gte'; field: string; value: unknown }
      | { type: 'lte'; field: string; value: unknown }

    const USER_ID = 'user-1'
    const USER_EMAIL = 'test@example.com'

    function nowIso(): string {
      return new Date().toISOString()
    }

    function formatDate(date: Date): string {
      const year = date.getFullYear()
      const month = `${date.getMonth() + 1}`.padStart(2, '0')
      const day = `${date.getDate()}`.padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    function parseDate(value: string): Date {
      const [year, month, day] = value.split('-').map(Number)
      return new Date(year, (month ?? 1) - 1, day ?? 1)
    }

    function addDays(value: string, days: number): string {
      const date = parseDate(value)
      date.setDate(date.getDate() + days)
      return formatDate(date)
    }

    function weekStartFor(anchorDate: string, startOfWeek: 0 | 1): string {
      const date = parseDate(anchorDate)
      const day = date.getDay()
      const offset = (day - startOfWeek + 7) % 7
      date.setDate(date.getDate() - offset)
      return formatDate(date)
    }

    function clone<T>(value: T): T {
      return JSON.parse(JSON.stringify(value)) as T
    }

    const today = formatDate(new Date())

    const state = {
      outcomes: [
        {
          id: 'outcome-1',
          title: 'Learn guitar',
          category: 'Music',
        },
      ],
      outputs: [
        {
          id: 'output-1',
          outcome_id: 'outcome-1',
          description: 'Practice guitar',
          frequency_type: 'daily',
          frequency_value: 1,
          schedule_weekdays: null,
          is_starter: false,
          status: 'active',
          sort_order: 1,
          created_at: nowIso(),
          updated_at: nowIso(),
        },
      ],
      action_logs: [] as Array<{
        id: string
        output_id: string
        action_date: string
        completed: number
        total: number
        notes: string | null
        created_at: string
        updated_at: string
      }>,
      skill_items: [
        {
          id: 'skill-1',
          user_id: USER_ID,
          outcome_id: 'outcome-1',
          name: 'Barre chords',
          stage: 'active',
          target_label: null,
          target_value: null,
          initial_confidence: 1,
          graduation_suppressed_at: null,
          created_at: nowIso(),
          updated_at: nowIso(),
        },
      ],
      skill_logs: [] as Array<{
        id: string
        user_id: string
        skill_item_id: string
        action_log_id: string | null
        confidence: number
        target_result: number | null
        logged_at: string
        created_at: string
        updated_at: string
      }>,
    }

    let idCounter = 1

    function nextId(prefix: string): string {
      const value = `${prefix}-${idCounter}`
      idCounter += 1
      return value
    }

    function tableRows(table: string): Row[] {
      if (table === 'action_logs') {
        return state.action_logs
      }
      if (table === 'skill_items') {
        return state.skill_items
      }
      if (table === 'skill_logs') {
        return state.skill_logs
      }
      if (table === 'outputs') {
        return state.outputs
      }
      if (table === 'outcomes') {
        return state.outcomes
      }

      throw new Error(`Unsupported table in mock: ${table}`)
    }

    function applyFilters(rows: Row[], filters: Filter[]): Row[] {
      return rows.filter((row) =>
        filters.every((filter) => {
          const value = row[filter.field]

          if (filter.type === 'eq') {
            return value === filter.value
          }
          if (filter.type === 'in') {
            return filter.values.includes(value)
          }
          if (filter.type === 'lt') {
            return String(value) < String(filter.value)
          }
          if (filter.type === 'gte') {
            return String(value) >= String(filter.value)
          }

          return String(value) <= String(filter.value)
        }),
      )
    }

    function applySelect(row: Row, selectFields: string): Row {
      const trimmed = selectFields.trim()

      if (!trimmed || trimmed === '*') {
        return row
      }

      const fields = trimmed
        .split(',')
        .map((field) => field.trim())
        .filter(Boolean)

      return fields.reduce<Row>((acc, field) => {
        acc[field] = row[field]
        return acc
      }, {})
    }

    class QueryBuilder {
      private table: string
      private mode: 'select' | 'insert' | 'update' | 'delete' = 'select'
      private selected = '*'
      private payload: Row | Row[] | null = null
      private filters: Filter[] = []
      private orderBy: { field: string; ascending: boolean } | null = null
      private limitCount: number | null = null

      constructor(table: string) {
        this.table = table
      }

      select(fields = '*') {
        this.selected = fields
        return this
      }

      eq(field: string, value: unknown) {
        this.filters.push({ type: 'eq', field, value })
        return this
      }

      in(field: string, values: unknown[]) {
        this.filters.push({ type: 'in', field, values })
        return this
      }

      lt(field: string, value: unknown) {
        this.filters.push({ type: 'lt', field, value })
        return this
      }

      gte(field: string, value: unknown) {
        this.filters.push({ type: 'gte', field, value })
        return this
      }

      lte(field: string, value: unknown) {
        this.filters.push({ type: 'lte', field, value })
        return this
      }

      order(field: string, options?: { ascending?: boolean }) {
        this.orderBy = {
          field,
          ascending: options?.ascending ?? true,
        }
        return this
      }

      limit(count: number) {
        this.limitCount = count
        return this
      }

      insert(payload: Row | Row[]) {
        this.mode = 'insert'
        this.payload = payload
        return this
      }

      update(payload: Row) {
        this.mode = 'update'
        this.payload = payload
        return this
      }

      delete() {
        this.mode = 'delete'
        return this
      }

      async maybeSingle() {
        const result = await this.execute()
        const rows = result.data as Row[] | null

        if (!rows || rows.length === 0) {
          return {
            data: null,
            error: null,
          }
        }

        return {
          data: rows[0],
          error: null,
        }
      }

      async single() {
        const result = await this.execute()
        const rows = result.data as Row[] | null

        if (!rows || rows.length === 0) {
          return {
            data: null,
            error: {
              message: 'No rows returned',
            },
          }
        }

        return {
          data: rows[0],
          error: null,
        }
      }

      then<TResult1 = unknown, TResult2 = never>(
        onfulfilled?: ((value: { data: Row[] | null; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ) {
        return this.execute().then(onfulfilled as never, onrejected as never)
      }

      private async execute(): Promise<{ data: Row[] | null; error: null }> {
        const rows = tableRows(this.table)

        if (this.mode === 'insert') {
          const payloadRows = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}]
          const inserted = payloadRows.map((payloadRow) => {
            const now = nowIso()
            const row = {
              id: String(payloadRow.id ?? nextId(this.table.slice(0, -1))),
              user_id: String(payloadRow.user_id ?? USER_ID),
              created_at: String(payloadRow.created_at ?? now),
              updated_at: String(payloadRow.updated_at ?? now),
              ...payloadRow,
            }
            rows.push(row)
            return row
          })

          return {
            data: clone(inserted.map((row) => applySelect(row, this.selected))),
            error: null,
          }
        }

        const filtered = applyFilters(rows, this.filters)

        if (this.mode === 'update') {
          const patch = this.payload ?? {}
          const now = nowIso()

          filtered.forEach((row) => {
            Object.assign(row, patch, { updated_at: now })
          })

          return {
            data: clone(filtered.map((row) => applySelect(row, this.selected))),
            error: null,
          }
        }

        if (this.mode === 'delete') {
          const idsToDelete = new Set(filtered.map((row) => String(row.id)))
          const retained = rows.filter((row) => !idsToDelete.has(String(row.id)))
          rows.length = 0
          rows.push(...retained)

          return {
            data: clone(filtered.map((row) => applySelect(row, this.selected))),
            error: null,
          }
        }

        let selectedRows = filtered.slice()

        if (this.orderBy) {
          const { field, ascending } = this.orderBy
          selectedRows.sort((left, right) => {
            const leftValue = String(left[field] ?? '')
            const rightValue = String(right[field] ?? '')
            return ascending
              ? leftValue.localeCompare(rightValue)
              : rightValue.localeCompare(leftValue)
          })
        }

        if (this.limitCount !== null) {
          selectedRows = selectedRows.slice(0, this.limitCount)
        }

        return {
          data: clone(selectedRows.map((row) => applySelect(row, this.selected))),
          error: null,
        }
      }
    }

    const session = {
      user: {
        id: USER_ID,
        email: USER_EMAIL,
      },
    }

    function scheduledOnDate(output: Row, dateValue: string): boolean {
      const frequencyType = output.frequency_type

      if (frequencyType === 'daily') {
        return true
      }

      if (frequencyType === 'fixed_weekly') {
        const weekdays = (output.schedule_weekdays ?? []) as number[]
        const day = parseDate(dateValue).getDay()
        return weekdays.includes(day)
      }

      return true
    }

    function computeWeeklyProgress(output: Row, weekStart: string, weekEnd: string) {
      const rangeDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
      const logs = state.action_logs.filter(
        (row) =>
          row.output_id === output.id &&
          row.action_date >= weekStart &&
          row.action_date <= weekEnd,
      )

      if (output.frequency_type === 'flexible_weekly') {
        const completed = logs.reduce((sum, row) => sum + row.completed, 0)
        const target = Number(output.frequency_value)
        const capped = Math.min(completed, target)
        return {
          completed: capped,
          target,
          rate: target > 0 ? Math.round((capped / target) * 100) : 0,
          target_met: capped >= target,
        }
      }

      let completedUnits = 0
      let targetUnits = 0

      rangeDays.forEach((day) => {
        if (!scheduledOnDate(output, day)) {
          return
        }

        targetUnits += 1
        const log = logs.find((row) => row.action_date === day)

        if (!log || log.completed <= 0 || log.total <= 0) {
          return
        }

        completedUnits += Math.min(log.completed / log.total, 1)
      })

      return {
        completed: Math.round(completedUnits * 10) / 10,
        target: targetUnits,
        rate: targetUnits > 0 ? Math.round((completedUnits / targetUnits) * 100) : 0,
        target_met: completedUnits >= targetUnits,
      }
    }

    const supabaseMock = {
      auth: {
        async getSession() {
          return {
            data: { session },
            error: null,
          }
        },
        onAuthStateChange(callback: (event: string, nextSession: typeof session) => void) {
          setTimeout(() => {
            callback('SIGNED_IN', session)
          }, 0)

          return {
            data: {
              subscription: {
                unsubscribe() {},
              },
            },
          }
        },
        async signInWithOtp() {
          return { error: null }
        },
        async signOut() {
          return { error: null }
        },
      },
      async rpc(fn: string, payload: { p_target_date: string }) {
        if (fn !== 'get_daily_dashboard') {
          return {
            data: null,
            error: { message: `Unsupported rpc: ${fn}` },
          }
        }

        const targetDate = payload.p_target_date || today
        const startOfWeek = 1 as const
        const weekStart = weekStartFor(targetDate, startOfWeek)
        const weekEnd = addDays(weekStart, 6)
        const yesterday = addDays(targetDate, -1)

        const outcomes = state.outcomes.map((outcome) => {
          const outputs = state.outputs
            .filter((output) => output.outcome_id === outcome.id && output.status === 'active')
            .map((output) => {
              const todayLog = state.action_logs.find(
                (row) => row.output_id === output.id && row.action_date === targetDate,
              )

              return {
                id: output.id,
                description: output.description,
                frequency_type: output.frequency_type,
                frequency_value: output.frequency_value,
                schedule_weekdays: output.schedule_weekdays,
                is_starter: output.is_starter,
                scheduled_today: scheduledOnDate(output, targetDate),
                today_log: todayLog
                  ? {
                      completed: todayLog.completed,
                      total: todayLog.total,
                      notes: todayLog.notes,
                    }
                  : null,
                weekly_progress: computeWeeklyProgress(output, weekStart, weekEnd),
              }
            })

          return {
            id: outcome.id,
            title: outcome.title,
            category: outcome.category,
            outputs,
          }
        })

        const missedYesterdayCount = state.outputs.reduce((count, output) => {
          if (!scheduledOnDate(output, yesterday)) {
            return count
          }

          const log = state.action_logs.find(
            (row) => row.output_id === output.id && row.action_date === yesterday,
          )

          if (!log || log.completed === 0) {
            return count + 1
          }

          return count
        }, 0)

        return {
          data: {
            date: targetDate,
            week_start: weekStart,
            week_end: weekEnd,
            start_of_week: startOfWeek,
            missed_yesterday_count: missedYesterdayCount,
            outcomes,
          },
          error: null,
        }
      },
      from(table: string) {
        return new QueryBuilder(table)
      },
    }

    interface MaestroWindow extends Window {
      __MAESTRO_SUPABASE_MOCK__?: unknown
      __MAESTRO_MOCK_STATE__?: unknown
    }

    const maestroWindow = window as MaestroWindow
    maestroWindow.__MAESTRO_SUPABASE_MOCK__ = supabaseMock
    maestroWindow.__MAESTRO_MOCK_STATE__ = state
  })
})

test('auth + output logging + skill logging + completion reset cleanup', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible()
  await expect(page.getByText('Practice guitar')).toBeVisible()

  await page.getByRole('button', { name: 'Mark done' }).click()
  await expect(page.getByRole('button', { name: 'Log skills worked' })).toBeVisible()

  await page.getByRole('button', { name: 'Log skills worked' }).click()
  await page.locator('#skill-output-1-skill-1').check()
  await page.locator('#confidence-output-1-skill-1').fill('4')
  await page.getByRole('button', { name: 'Save skills' }).click()

  await page.getByRole('button', { name: 'Log skills worked' }).click()
  await expect(page.locator('#skill-output-1-skill-1')).toBeChecked()
  await expect(page.locator('#confidence-output-1-skill-1')).toHaveValue('4')

  await page.locator('#confidence-output-1-skill-1').fill('2')
  await page.getByRole('button', { name: 'Save skills' }).click()

  await page.locator('#completed-output-1').fill('0')
  await page.getByRole('button', { name: 'Save log' }).click()
  await expect(page.getByRole('button', { name: 'Log skills worked' })).toHaveCount(0)

  const state = await page.evaluate(() => {
    interface MaestroWindow extends Window {
      __MAESTRO_MOCK_STATE__?: {
        skill_logs: unknown[]
      }
    }

    const maestroWindow = window as MaestroWindow
    return maestroWindow.__MAESTRO_MOCK_STATE__
  })

  expect(state).toBeDefined()
  expect(state?.skill_logs).toHaveLength(0)
})
