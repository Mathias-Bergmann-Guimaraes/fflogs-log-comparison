// FF Logs' colours for a parse (a percentile, 0-100), by the bracket its floor falls in: grey under 25, green, blue,
// purple from 75, orange from 95, pink at 99 and gold at 100
const brackets: readonly [min: number, color: string][] = [
  [100, '#e5cc80'],
  [99, '#e268a8'],
  [95, '#ff8000'],
  [75, '#a335ee'],
  [50, '#0070ff'],
  [25, '#1eff00'],
  [0, '#666666'],
]

export const parseColor = (percent: number) => brackets.find(([min]) => Math.floor(percent) >= min)?.[1] ?? '#666666'
