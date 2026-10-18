// Shared look for the dashboard's ECharts on Ant's dark theme.
// Series colours: dark categorical slots, validated as a set against the dark card surface (#141414)
// in this order with the dataviz validator: acquired, upgrade, tome, raid.
export const statusColors = {
  acquired: '#199e70',
  upgrade: '#c98500',
  tome: '#3987e5',
  raid: '#d95926',
}

export const SURFACE = '#141414'

export const textPrimary = 'rgba(255,255,255,0.85)'
export const textSecondary = 'rgba(255,255,255,0.45)'

export const axisStyle = {
  axisLine: { lineStyle: { color: '#303030' } },
  axisTick: { show: false },
  axisLabel: { color: textSecondary },
  splitLine: { lineStyle: { color: '#262626' } },
}

export const tooltipStyle = {
  backgroundColor: '#1f1f1f',
  borderColor: '#303030',
  textStyle: { color: textPrimary },
}

export const legendStyle = {
  textStyle: { color: textSecondary },
  itemWidth: 12,
  itemHeight: 12,
  icon: 'roundRect',
}

// Bar segments: a 2px surface gap between neighbours
export const barItemStyle = (color: string) => ({ color, borderColor: SURFACE, borderWidth: 2, borderRadius: 4 })

// Shopping list tables show exactly this many rows, then scroll (rows are ~57.5px with ItemCell)
export const VISIBLE_ROWS = 4
export const ROW_HEIGHT = 57.5
export const fixedRowsStyle = { '--table-body-height': `${VISIBLE_ROWS * ROW_HEIGHT}px` }
