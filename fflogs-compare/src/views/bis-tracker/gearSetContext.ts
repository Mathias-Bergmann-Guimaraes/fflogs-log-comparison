import { inject, provide, type InjectionKey } from 'vue'
import { allJobs } from '@/constants/gearSharing'
import { useBisStore, type BisStore } from '@/stores/bisStore'

// Which gear set the cards and dialogs below a GearSetPanel work on. Without a panel above them
// (the dashboard), it's the default set with every job.
export type GearSetContext = {
  setId: number
  // Jobs in the set: linking only offers these
  readonly jobs: readonly string[]
  store: BisStore
}

const key: InjectionKey<GearSetContext> = Symbol('gearSet')

export function provideGearSet(context: GearSetContext) {
  provide(key, context)
}

export function useGearSet(): GearSetContext {
  return inject(key, null) ?? { setId: 0, jobs: allJobs, store: useBisStore() }
}
