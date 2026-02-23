type DataPoint = {
  label: string
  value: number
}

function yValue(
  value: number,
  min: number,
  max: number,
  height: number,
  padding: number,
): number {
  const span = Math.max(max - min, 1)
  const normalized = (value - min) / span
  return height - padding - normalized * (height - padding * 2)
}

export function SimpleLineChart({
  title,
  points,
  goalValue,
}: {
  title: string
  points: DataPoint[]
  goalValue?: number
}) {
  if (!points.length) {
    return <p className="muted">No data points yet.</p>
  }

  const width = 420
  const height = 170
  const padding = 24

  const values = points.map((point) => point.value)

  if (goalValue !== undefined) {
    values.push(goalValue)
  }

  const min = Math.min(...values)
  const max = Math.max(...values)

  const chartPoints = points.map((point, index) => {
    const x =
      points.length === 1
        ? width / 2
        : padding + (index / (points.length - 1)) * (width - padding * 2)

    const y = yValue(point.value, min, max, height, padding)

    return {
      ...point,
      x,
      y,
    }
  })

  const polyline = chartPoints.map((point) => `${point.x},${point.y}`).join(' ')
  const goalY = goalValue !== undefined ? yValue(goalValue, min, max, height, padding) : null

  return (
    <div className="chart-wrap">
      <p className="chart-title">{title}</p>
      <svg aria-label={title} className="line-chart" role="img" viewBox={`0 0 ${width} ${height}`}>
        <line
          stroke="#cad7cc"
          strokeWidth="1"
          x1={padding}
          x2={width - padding}
          y1={height - padding}
          y2={height - padding}
        />

        {goalY !== null ? (
          <line
            stroke="#7c919f"
            strokeDasharray="6 4"
            strokeWidth="1.5"
            x1={padding}
            x2={width - padding}
            y1={goalY}
            y2={goalY}
          />
        ) : null}

        <polyline fill="none" points={polyline} stroke="#1f6f56" strokeWidth="3" />

        {chartPoints.map((point) => (
          <g key={`${point.label}-${point.value}`}>
            <circle cx={point.x} cy={point.y} fill="#1f6f56" r="4" />
            <title>{`${point.label}: ${point.value}`}</title>
          </g>
        ))}
      </svg>

      <div className="chart-range">
        <span>{points[0]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
    </div>
  )
}
