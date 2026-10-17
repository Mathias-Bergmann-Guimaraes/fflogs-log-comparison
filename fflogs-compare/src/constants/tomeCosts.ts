import { EquipmentType } from '@/types/EquipmentType'

// Allagan Tomestones for each tome piece. Weapon is 500, but weapons aren't tracked yet.
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
}
