import { EquipmentType } from '@/types/EquipmentType'

// The most of the current tomestone you can hold at once
export const MAX_TOMES_HELD = 2000

// Item id of the current capped tomestone (Mnemonics), for the game plugin's inventory: swap at a new one
export const TOME_ITEM_ID = 49

// Allagan Tomestones for each tome piece
export const tomeCosts: Record<EquipmentType, number> = {
  [EquipmentType.HEAD]: 495,
  [EquipmentType.BODY]: 825,
  [EquipmentType.HANDS]: 495,
  [EquipmentType.LEGS]: 825,
  [EquipmentType.FEET]: 495,
  [EquipmentType.EARRINGS]: 375,
  [EquipmentType.NECKLACE]: 375,
  [EquipmentType.BRACELETS]: 375,
  [EquipmentType.RING]: 375,
  [EquipmentType.WEAPON]: 500,
}
