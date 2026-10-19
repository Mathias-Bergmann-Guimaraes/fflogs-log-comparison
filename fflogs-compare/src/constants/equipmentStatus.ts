import { EquipmentStatus, EquipmentType, isAccessory } from '@/types/EquipmentType'

const PENDING_CLASS = 'border-gray-600 bg-gray-900'
const PARTIAL_CLASS = 'border-yellow-500 bg-yellow-900/50'
const DONE_CLASS = 'border-green-500 bg-green-900/50'

export const equipmentStatuses: Record<EquipmentStatus, { label: string; className: string }> = {
  [EquipmentStatus.RAID]: { label: 'Raid', className: PENDING_CLASS },
  [EquipmentStatus.TOME]: { label: 'Tome', className: PENDING_CLASS },
  [EquipmentStatus.TWINE]: { label: 'Twine', className: PARTIAL_CLASS },
  [EquipmentStatus.GLAZE]: { label: 'Glaze', className: PARTIAL_CLASS },
  [EquipmentStatus.SOLVENT]: { label: 'Solvent', className: PARTIAL_CLASS },
  [EquipmentStatus.DUNGEON]: { label: 'Dungeon', className: PENDING_CLASS },
  [EquipmentStatus.RELIC]: { label: 'Relic', className: PENDING_CLASS },
  [EquipmentStatus.TRIAL]: { label: 'Trial', className: PENDING_CLASS },
  [EquipmentStatus.ULTIMATE]: { label: 'Ultimate', className: PENDING_CLASS },
  [EquipmentStatus.ACQUIRED]: { label: 'Acquired', className: DONE_CLASS },
}

// The status that's left once a tome piece is bought: it still needs its upgrade material
export function upgradeStatusFor(type: EquipmentType): EquipmentStatus {
  if (type === EquipmentType.WEAPON) return EquipmentStatus.SOLVENT
  return isAccessory(type) ? EquipmentStatus.GLAZE : EquipmentStatus.TWINE
}

// Twine upgrades armour, glaze accessories and solvent the weapon. Dungeon gear costs nothing but a run;
// a weapon has no dungeon piece but can be the relic, the extreme trial's or (`ultimate`: when the tier has one)
// the ultimate's, which aren't costed either.
export function statusOptionsFor(type: EquipmentType, ultimate = false): EquipmentStatus[] {
  const from =
    type === EquipmentType.WEAPON
      ? [EquipmentStatus.RELIC, EquipmentStatus.TRIAL, ...(ultimate ? [EquipmentStatus.ULTIMATE] : [])]
      : [EquipmentStatus.DUNGEON]
  return [EquipmentStatus.RAID, EquipmentStatus.TOME, upgradeStatusFor(type), ...from, EquipmentStatus.ACQUIRED]
}
