import { EquipmentStatus } from '@/types/EquipmentType'
import { WEAPON_SLOT } from '@/constants/gearSharing'
import { relicSeries, type RelicSeries } from '@/constants/relicWeapons'
import { ultimateRaids, type UltimateRaid } from '@/constants/ultimateWeapons'
import { useBisStore, type BisStore } from './bisStore'
import { useGearSetsStore } from './gearSetsStore'
import { useRelicStore } from './relicStore'
import { useUltimateStore } from './ultimateStore'

// Keeps a gear set's weapon and the Relic / Ultimate Weapons pages in step: a weapon slot after a relic or ultimate
// weapon is Acquired exactly when that page has it. Which weapon goes by item id (bisStore.weaponItem), so a relic slot
// matches one stage of a series (this tier's relic is Phantom's last), and a custom set's relic only once it's pinned.
// Either side changing updates the other; each step does nothing when the other side already agrees, so it stops there.

type Weapon = { series: RelicSeries; stage: number } | { raid: UltimateRaid }

function weaponOf(bis: BisStore, job: string): Weapon | undefined {
  const source = bis.sourceOf(job, WEAPON_SLOT)
  if (source !== 'relic' && source !== 'ultimate') return undefined
  const item = bis.weaponItem(job)
  if (item === undefined) return undefined
  if (source === 'ultimate') {
    const raid = ultimateRaids.find((r) => r.weapons[job] === item)
    return raid && { raid }
  }
  for (const series of relicSeries) {
    const stage = series.weapons[job]?.indexOf(item) ?? -1
    if (stage >= 0) return { series, stage }
  }
  return undefined
}

// Whether the Relic / Ultimate Weapons page has the job's weapon (a relic: that stage done)
function hasWeapon(weapon: Weapon, job: string) {
  return 'raid' in weapon ? useUltimateStore().has(weapon.raid, job) : useRelicStore().stagesDone(weapon.series, job) > weapon.stage
}

// A gear set's weapon slots for `jobs` changed (from `previous` statuses). Acquired ticks the weapon on its page;
// going from Acquired back to Relic / Ultimate unticks it (a relic: that stage and later). Any other change, such as
// picking Relic as the BiS, takes on what the page says: already had means Acquired.
export async function syncGearToWeapons(setId: number, jobs: readonly string[], previous: readonly EquipmentStatus[]) {
  const bis = useBisStore(setId)
  const relics = useRelicStore()
  const ultimates = useUltimateStore()
  // Saving before the pages' progress is in would replace it
  if (!(await relics.whenLoaded()) || !(await ultimates.whenLoaded())) return
  for (const [i, job] of jobs.entries()) {
    const weapon = weaponOf(bis, job)
    if (!weapon) continue
    const acquired = bis.statusOf(job, WEAPON_SLOT) === EquipmentStatus.ACQUIRED
    const had = hasWeapon(weapon, job)
    if (acquired || previous[i] === EquipmentStatus.ACQUIRED) {
      if (had === acquired) continue
      if ('raid' in weapon) await ultimates.setAll(weapon.raid, acquired, [job])
      else await relics.setStageForAll(weapon.series, weapon.stage, weapon.stage, acquired, [job])
    } else if (had) {
      await bis.setStatus(job, WEAPON_SLOT, EquipmentStatus.ACQUIRED)
    }
  }
}

// The page changed these jobs' weapons: every gear set (opened or not) after one of them follows
async function syncWeaponsToGear(matches: (weapon: Weapon) => boolean, jobs: readonly string[]) {
  const gearSets = useGearSetsStore()
  for (const setId of [0, ...gearSets.sets.map((s) => s.id)]) {
    const bis = useBisStore(setId)
    try {
      await bis.ensureLoaded()
    } catch (err) {
      console.error(`Couldn't load gear set ${setId} to update its weapons`, err)
      continue
    }
    const setJobs = setId ? (gearSets.byId(setId)?.jobs ?? []) : jobs
    for (const job of jobs.filter((j) => setJobs.includes(j))) {
      const weapon = weaponOf(bis, job)
      if (!weapon || !matches(weapon)) continue
      const acquired = bis.statusOf(job, WEAPON_SLOT) === EquipmentStatus.ACQUIRED
      const had = hasWeapon(weapon, job)
      if (had === acquired) continue
      const unticked = 'raid' in weapon ? EquipmentStatus.ULTIMATE : EquipmentStatus.RELIC
      await bis.setStatus(job, WEAPON_SLOT, had ? EquipmentStatus.ACQUIRED : unticked)
    }
  }
}

export const syncRelicToGear = (series: RelicSeries, jobs: readonly string[]) =>
  syncWeaponsToGear((weapon) => 'series' in weapon && weapon.series.key === series.key, jobs)

export const syncUltimateToGear = (raid: UltimateRaid, jobs: readonly string[]) =>
  syncWeaponsToGear((weapon) => 'raid' in weapon && weapon.raid.key === raid.key, jobs)
