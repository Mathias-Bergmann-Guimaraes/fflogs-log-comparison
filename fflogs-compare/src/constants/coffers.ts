import { EquipmentType } from '@/types/EquipmentType'

// Savage coffers: each holds one raid piece of its slot, for whichever job opens it.
// Both ring slots use the same ring coffer.
// itemId: the coffer's item id (Grand Champion's ... Coffer), for the game plugin's inventory.
// icon: set once the coffer icons are in src/assets; until then a placeholder is shown.
export const cofferDefs: { type: EquipmentType; label: string; itemId: number; icon?: string }[] = [
  { type: EquipmentType.HEAD, label: 'Head', itemId: 49739 },
  { type: EquipmentType.BODY, label: 'Body', itemId: 49740 },
  { type: EquipmentType.HANDS, label: 'Hands', itemId: 49741 },
  { type: EquipmentType.LEGS, label: 'Legs', itemId: 49742 },
  { type: EquipmentType.FEET, label: 'Feet', itemId: 49743 },
  { type: EquipmentType.EARRINGS, label: 'Earrings', itemId: 49744 },
  { type: EquipmentType.NECKLACE, label: 'Necklace', itemId: 49745 },
  { type: EquipmentType.BRACELETS, label: 'Bracelets', itemId: 49746 },
  { type: EquipmentType.RING, label: 'Ring', itemId: 49747 },
  { type: EquipmentType.WEAPON, label: 'Weapon', itemId: 49738 },
]
