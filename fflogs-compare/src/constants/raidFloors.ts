// Which savage floor drops each BiS item (and its book). Floor numbers stay 1-4 whatever the
// tier's names are (M9S-M12S this tier). Slot indexes match bisSlots in constants/bisSlots.ts.
import tier1Book from '@/assets/tier1.png'
import tier2Book from '@/assets/tier2.png'
import tier3Book from '@/assets/tier3.png'
import tier4Book from '@/assets/tier4.png'

export type RaidFloor = 1 | 2 | 3 | 4

// bookCost: books that floor's vendor wants per item
// upgrade: the tome-gear upgrade material that floor drops (glaze for accessories, twine for armour)
export const raidFloors: {
  floor: RaidFloor
  label: string
  slots: readonly number[]
  icon: string
  bookCost: number
  upgrade?: 'twine' | 'glaze'
}[] = [
  { floor: 1, label: 'Floor 1', slots: [5, 6, 7, 8, 9], icon: tier1Book, bookCost: 3 }, // Earrings, Necklace, Bracelets, Rings
  { floor: 2, label: 'Floor 2', slots: [0, 2, 4], icon: tier2Book, bookCost: 4, upgrade: 'glaze' }, // Head, Hands, Feet
  { floor: 3, label: 'Floor 3', slots: [1, 3], icon: tier3Book, bookCost: 6, upgrade: 'twine' }, // Body, Legs
  { floor: 4, label: 'Floor 4', slots: [], icon: tier4Book, bookCost: 8 }, // Weapon: not tracked yet
]

export function floorOf(slot: number): RaidFloor | undefined {
  return raidFloors.find((f) => f.slots.includes(slot))?.floor
}

export type RaidNeeds = Record<RaidFloor, number>
