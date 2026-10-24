import { useSettingsStore } from '@/stores/settingsStore'
import { MARK_REWARDS, TRAIN_TYPES, type Currency } from './dashboard/trains'
import { EXPANSIONS, S_REWARDS, type ExpansionKey } from './dashboard/sRanks'

// How many hunts pay a given amount of a currency, from the hunt dashboard's own rewards, so the two never disagree.
// One row per source (a train type or an S rank's expansion), newest expansion first; the range runs from the
// best-paying row to the worst-paying one. Mathematics and Mnemonics only drop on a level-capped job.

export type HuntEstimateRow = { key: string; tag: string; color: string; name: string; each: number; count: number }

export type HuntEstimate = { kind: 'trains' | 'sRanks'; label: string; unit: string; rows: HuntEstimateRow[]; fewest: number; most: number }

function estimate(
  kind: HuntEstimate['kind'],
  label: string,
  unit: string,
  rows: Omit<HuntEstimateRow, 'count'>[],
  needed: number,
): HuntEstimate | null {
  const paying = rows.filter((r) => r.each > 0).map((r) => ({ ...r, count: Math.ceil(needed / r.each) }))
  if (!paying.length) return null
  const counts = paying.map((r) => r.count)
  return { kind, label, unit, rows: paying, fewest: Math.min(...counts), most: Math.max(...counts) }
}

// A train of as many A ranks as Settings assumes for its type
export function trainsFor(currency: Currency, needed: number) {
  const marks = useSettingsStore().trainMarks
  const counts = new Set(TRAIN_TYPES.map((t) => marks(t.key)))
  return estimate(
    'trains',
    'hunt trains',
    counts.size === 1 ? `a train of ${[...counts][0]} A ranks` : 'a full train',
    TRAIN_TYPES.map((t) => ({
      key: t.key,
      tag: t.label,
      color: t.color,
      name: t.expansion,
      each: (MARK_REWARDS[t.key][currency] ?? 0) * marks(t.key),
    })),
    needed,
  )
}

// S ranks only (SS ranks pay more, but are rare enough not to count on)
export const sRanksFor = (currency: Currency, needed: number) =>
  estimate(
    'sRanks',
    'S ranks',
    'an S rank',
    (Object.keys(S_REWARDS).map(Number) as ExpansionKey[])
      .reverse()
      .map((key) => ({
        key: String(key),
        tag: EXPANSIONS[key].label,
        color: EXPANSIONS[key].color,
        name: EXPANSIONS[key].name,
        each: S_REWARDS[key][currency] ?? 0,
      })),
    needed,
  )

// "3" when both ends agree, else "3–5"
export const rangeOf = (e: HuntEstimate) =>
  e.fewest === e.most ? e.fewest.toLocaleString() : `${e.fewest.toLocaleString()}–${e.most.toLocaleString()}`
