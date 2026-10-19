import { computed } from 'vue'
import { EquipmentStatus } from '@/types/EquipmentType'
import { jobsByRole } from '@/constants/jobs'
import { raidFloors, floorOf, type RaidFloor } from '@/constants/raidFloors'
import { bisSlots } from '@/constants/bisSlots'
import { upgradeStatusFor } from '@/constants/equipmentStatus'
import { useBisStore } from '@/stores/bisStore'
import { useStockStore } from '@/stores/stockStore'
import { useFavoritesStore } from '@/stores/favoritesStore'

export const WEEKLY_TOME_CAP = 450
const BOOKS_PER_FLOOR_PER_WEEK = 1
const MAX_WEEKS = 520 // safety stop for the simulation

export const allJobs = jobsByRole.flatMap((group) => group.jobs)
export const trackedFloors = raidFloors.filter((f) => f.slots.length)

export type Source = 'tome' | RaidFloor

// One thing to buy. A linked item is one purchase covering every job in `jobs`.
export type Purchase = {
  id: string
  job: string
  slot: number
  jobs: string[]
  source: Source
  cost: number
  upgrade: 'twine' | 'glaze' | 'solvent' | null
  // Week it becomes affordable (1 = this week), from the simulation
  week: number
}

// --- Weekly reset: Tuesday 08:00 UTC ---

export function nextWeeklyReset(now = new Date()): Date {
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 8))
  const daysUntilTuesday = (2 - reset.getUTCDay() + 7) % 7
  reset.setUTCDate(reset.getUTCDate() + daysUntilTuesday)
  if (reset <= now) reset.setUTCDate(reset.getUTCDate() + 7)
  return reset
}

// Week 1 is the current week; week k starts at the (k-1)th upcoming reset
export function weekStart(week: number, now = new Date()): Date {
  if (week <= 1) return now
  const start = nextWeeklyReset(now)
  start.setUTCDate(start.getUTCDate() + (week - 2) * 7)
  return start
}

const dateFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

export function weekLabel(week: number): string {
  if (week <= 1) return 'This week'
  return `Week ${week} · ${dateFormat.format(weekStart(week))}`
}

export function formatDate(date: Date): string {
  return dateFormat.format(date)
}

// Buys `queue` in order as soon as the balance allows. Returns the week each entry is bought.
function simulate(costs: number[], startBalance: number, incomeForWeek: (week: number) => number): number[] {
  const weeks: number[] = []
  let balance = startBalance
  let next = 0
  for (let week = 1; next < costs.length && week <= MAX_WEEKS; week++) {
    balance += incomeForWeek(week)
    while (next < costs.length && balance >= costs[next]!) {
      balance -= costs[next]!
      weeks.push(week)
      next++
    }
  }
  // Anything left is unreachable within MAX_WEEKS (shouldn't happen with positive income)
  while (weeks.length < costs.length) weeks.push(Infinity)
  return weeks
}

const lastWeek = (purchases: Purchase[]) => purchases.reduce((max, p) => Math.max(max, p.week), 0)

export function useBisPlan() {
  const bis = useBisStore()
  const stockStore = useStockStore()
  const favorites = useFavoritesStore()

  // Favorites first, then role order: everything below is queued in this order
  const jobOrder = computed(() => favorites.jobOrder)
  const trackedJobs = computed(() => jobOrder.value.filter(bis.isTracked))

  const withJobs = (job: string, slot: number) => [job, ...bis.linkedOnSlot(job, slot)].filter((j) => allJobs.includes(j))

  // --- Tomestones: items marked Tome, in job order (favorites first) ---
  const tomePurchases = computed<Purchase[]>(() => {
    const pieces = bis.neededPieces(jobOrder.value).filter((p) => p.tomes > 0)
    const stock = stockStore.stock
    const weeks = simulate(
      pieces.map((p) => p.tomes),
      stock.tomes,
      (week) => (week === 1 ? Math.max(0, WEEKLY_TOME_CAP - stock.tomesEarnedThisWeek) : WEEKLY_TOME_CAP),
    )
    return pieces.map((p, i) => ({
      id: `tome:${p.job}:${p.slot}`,
      job: p.job,
      slot: p.slot,
      jobs: withJobs(p.job, p.slot),
      source: 'tome',
      cost: p.tomes,
      upgrade: p.twines ? 'twine' : p.glazes ? 'glaze' : p.solvents ? 'solvent' : null,
      week: weeks[i]!,
    }))
  })

  // --- Coffers: each held coffer stands in for one raid piece of its slot type, whatever the job ---
  // They cover the pieces furthest down each floor's queue, so the rest keep their order and the book
  // queue just gets shorter. Coffers beyond what's needed cover nothing.
  const cofferCovered = computed(() => {
    const left = { ...stockStore.stock.coffers }
    const covered = new Set<string>()
    for (const p of [...bis.raidPieces(jobOrder.value)].reverse()) {
      const type = bisSlots[p.slot]!
      if (!left[type]) continue
      left[type]--
      covered.add(`${p.job}:${p.slot}`)
    }
    return covered
  })

  // --- Books: raid items on tracked jobs not covered by a coffer, per floor ---
  const bookPurchases = computed<Record<RaidFloor, Purchase[]>>(() => {
    const stock = stockStore.stock
    const result: Record<RaidFloor, Purchase[]> = { 1: [], 2: [], 3: [], 4: [] }
    const pieces = bis.raidPieces(jobOrder.value).filter((p) => !cofferCovered.value.has(`${p.job}:${p.slot}`))
    for (const floor of raidFloors) {
      const onFloor = pieces.filter((p) => p.floor === floor.floor)
      const weeks = simulate(
        onFloor.map(() => floor.bookCost),
        stock.books[floor.floor],
        (week) => (week === 1 && stock.floorsClearedThisWeek[floor.floor] ? 0 : BOOKS_PER_FLOOR_PER_WEEK),
      )
      result[floor.floor] = onFloor.map((p, i) => ({
        id: `book:${p.job}:${p.slot}`,
        job: p.job,
        slot: p.slot,
        jobs: withJobs(p.job, p.slot),
        source: floor.floor,
        cost: floor.bookCost,
        upgrade: null,
        week: weeks[i]!,
      }))
    }
    return result
  })

  // --- Upgrade materials: every Tome/Twine/Glaze item needs one ---
  const upgrades = computed(() => {
    const pieces = bis.neededPieces(jobOrder.value).filter((p) => p.twines || p.glazes)
    const items = pieces.map((p) => ({
      id: `upgrade:${p.job}:${p.slot}`,
      job: p.job,
      slot: p.slot,
      jobs: withJobs(p.job, p.slot),
      kind: (p.twines ? 'twine' : 'glaze') as 'twine' | 'glaze',
      // Still needs the tome piece first?
      needsTomePiece: p.tomes > 0,
    }))
    const twines = items.filter((i) => i.kind === 'twine').length
    const glazes = items.filter((i) => i.kind === 'glaze').length
    return {
      items,
      twines,
      glazes,
      twinesShort: Math.max(0, twines - stockStore.stock.twines),
      glazesShort: Math.max(0, glazes - stockStore.stock.glazes),
    }
  })

  // --- Headline numbers ---
  const tomesNeeded = computed(() => tomePurchases.value.reduce((sum, p) => sum + p.cost, 0))
  const tomesShort = computed(() => Math.max(0, tomesNeeded.value - stockStore.stock.tomes))
  const tomeWeeks = computed(() => lastWeek(tomePurchases.value))

  const floorWeeks = computed(() =>
    trackedFloors.map((f) => {
      const purchases = bookPurchases.value[f.floor]
      const books = purchases.reduce((sum, p) => sum + p.cost, 0)
      const coffers = [...cofferCovered.value].filter((key) => floorOf(Number(key.split(':')[1])) === f.floor).length
      return {
        ...f,
        books,
        short: Math.max(0, books - stockStore.stock.books[f.floor]),
        weeks: lastWeek(purchases),
        items: purchases.length,
        coffers,
      }
    }),
  )
  const raidWeeks = computed(() => Math.max(0, ...floorWeeks.value.map((f) => f.weeks)))
  const bottleneck = computed(() => (raidWeeks.value ? floorWeeks.value.find((f) => f.weeks === raidWeeks.value) : undefined))

  const doneWeek = computed(() => Math.max(tomeWeeks.value, raidWeeks.value))
  const doneDate = computed(() => (doneWeek.value ? weekStart(doneWeek.value) : null))

  const allPurchases = computed(() => [...tomePurchases.value, ...trackedFloors.flatMap((f) => bookPurchases.value[f.floor])])
  const thisWeek = computed(() => allPurchases.value.filter((p) => p.week === 1))

  // Purchases still open at the end of each week: [now, after week 1, after week 2, ...]
  const burndown = computed(() => {
    const purchases = allPurchases.value
    return Array.from({ length: doneWeek.value + 1 }, (_, week) => ({
      week,
      remaining: purchases.filter((p) => p.week > week).length,
      tome: purchases.filter((p) => p.source === 'tome' && p.week > week).length,
      books: purchases.filter((p) => p.source !== 'tome' && p.week > week).length,
    }))
  })

  // What an item becomes once bought: tome pieces still need their upgrade, book items are done
  function statusAfterBuying(purchase: Purchase): EquipmentStatus {
    if (purchase.source !== 'tome' || !purchase.upgrade) return EquipmentStatus.ACQUIRED
    return upgradeStatusFor(bisSlots[purchase.slot]!)
  }

  // Marks the item bought on the gear sheet (all linked jobs) and pays for it out of the stock.
  // Paying more than is held means the rest was earned this week, so that's recorded too:
  // extra tomes count towards this week's cap, a missing book means the floor was cleared.
  // Resolves to an undo function, or null if the gear sheet couldn't be saved.
  async function buy(purchase: Purchase): Promise<(() => Promise<void>) | null> {
    const previousStatus = bis.statusOf(purchase.job, purchase.slot)
    if (!(await bis.setStatus(purchase.job, purchase.slot, statusAfterBuying(purchase)))) return null

    // Record exactly what this purchase changed, so undoing it reverses only that and leaves
    // other purchases made in the meantime alone (restoring a snapshot would wipe those)
    const stock = stockStore.stock
    let undoStock: () => void
    if (purchase.source === 'tome') {
      const paid = Math.min(purchase.cost, stock.tomes)
      const earned = Math.min(WEEKLY_TOME_CAP - stock.tomesEarnedThisWeek, purchase.cost - paid)
      stock.tomes -= paid
      stock.tomesEarnedThisWeek += earned
      undoStock = () => {
        stock.tomes += paid
        stock.tomesEarnedThisWeek = Math.max(0, stock.tomesEarnedThisWeek - earned)
      }
    } else {
      const floor = purchase.source
      const paid = Math.min(purchase.cost, stock.books[floor])
      const markedCleared = purchase.cost > paid && !stock.floorsClearedThisWeek[floor]
      stock.books[floor] -= paid
      if (markedCleared) stock.floorsClearedThisWeek[floor] = true
      undoStock = () => {
        stock.books[floor] += paid
        if (markedCleared) stock.floorsClearedThisWeek[floor] = false
      }
    }

    return async () => {
      undoStock()
      await bis.setStatus(purchase.job, purchase.slot, previousStatus)
    }
  }

  return {
    buy,
    statusAfterBuying,
    trackedJobs,
    tomePurchases,
    bookPurchases,
    upgrades,
    tomesNeeded,
    tomesShort,
    tomeWeeks,
    floorWeeks,
    raidWeeks,
    bottleneck,
    doneWeek,
    doneDate,
    allPurchases,
    thisWeek,
    burndown,
  }
}
