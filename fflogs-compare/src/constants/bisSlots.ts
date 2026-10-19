import { EquipmentType } from '@/types/EquipmentType'

// Index order is what the server stores, and must match ARMOUR_SLOTS / ACCESSORY_SLOTS / WEAPON_SLOT in gearSharing.ts.
// The two rings are separate indexes, so they track separately. The weapon came last, so older saves keep their indexes.
export const bisSlots: readonly EquipmentType[] = [
  EquipmentType.HEAD,
  EquipmentType.BODY,
  EquipmentType.HANDS,
  EquipmentType.LEGS,
  EquipmentType.FEET,
  EquipmentType.EARRINGS,
  EquipmentType.NECKLACE,
  EquipmentType.BRACELETS,
  EquipmentType.RING,
  EquipmentType.RING,
  EquipmentType.WEAPON,
]

export const bisSlotLabels: readonly string[] = [
  'Head',
  'Body',
  'Hands',
  'Legs',
  'Feet',
  'Earrings',
  'Necklace',
  'Bracelets',
  'Ring 1',
  'Ring 2',
  'Weapon',
]
