import type { RouteLocationNormalizedLoaded } from 'vue-router'
import type { GearSet } from '@/stores/gearSetsStore'

// The gear set open on the Gear sets page, from ?set=: a custom set's id, or 0 (the default set) when it's missing or unknown
export function activeGearSetId(route: RouteLocationNormalizedLoaded, sets: readonly GearSet[]): number {
  if (route.name !== 'bisGear') return 0
  const id = Number(route.query.set)
  return sets.some((s) => s.id === id) ? id : 0
}
