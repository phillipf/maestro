const MS_PER_DAY = 24 * 60 * 60 * 1000

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')

  return `${year}-${month}-${day}`
}

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

function addLocalDays(value: string, days: number): string {
  const date = parseLocalDate(value)
  date.setDate(date.getDate() + days)
  return formatLocalDate(date)
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value)
}

function daysBetweenLocalDates(from: string | Date, to: string | Date): number {
  const fromDate = startOfLocalDay(toDate(from))
  const toDateValue = startOfLocalDay(toDate(to))

  return Math.max(0, Math.floor((toDateValue.getTime() - fromDate.getTime()) / MS_PER_DAY))
}

export {
  formatLocalDate,
  parseLocalDate,
  addLocalDays,
  startOfLocalDay,
  toDate,
  daysBetweenLocalDates,
}
