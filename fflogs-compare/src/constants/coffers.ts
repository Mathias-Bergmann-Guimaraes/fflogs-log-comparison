import { EquipmentType } from '@/types/EquipmentType'

// Savage coffers: each holds one raid piece of its slot, for whichever job opens it.
// Both ring slots use the same ring coffer.
// icon: set once the coffer icons are in src/assets; until then a placeholder is shown.
export const cofferDefs: { type: EquipmentType; label: string; icon?: string }[] = [
  { type: EquipmentType.HEAD, label: 'Head' },
  { type: EquipmentType.BODY, label: 'Body' },
  { type: EquipmentType.HANDS, label: 'Hands' },
  { type: EquipmentType.LEGS, label: 'Legs' },
  { type: EquipmentType.FEET, label: 'Feet' },
  { type: EquipmentType.EARRINGS, label: 'Earrings' },
  { type: EquipmentType.NECKLACE, label: 'Necklace' },
  { type: EquipmentType.BRACELETS, label: 'Bracelets' },
  { type: EquipmentType.RING, label: 'Ring' },
  { type: EquipmentType.WEAPON, label: 'Weapon' },
]
