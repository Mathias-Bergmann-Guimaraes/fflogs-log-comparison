import { EquipmentType } from '@/types/EquipmentType'

// Index order is what the server stores, and must match ARMOUR_SLOTS / ACCESSORY_SLOTS in gearSharing.ts.
// The two rings are separate indexes, so they track separately.
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
]

export const bisSlotLabels: readonly string[] = ['Head', 'Body', 'Hands', 'Legs', 'Feet', 'Earrings', 'Necklace', 'Bracelets', 'Ring 1', 'Ring 2']
