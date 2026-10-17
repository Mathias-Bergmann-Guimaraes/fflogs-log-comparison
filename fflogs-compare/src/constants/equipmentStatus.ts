import { EquipmentStatus, EquipmentType, isAccessory } from '@/types/EquipmentType'

const PENDING_CLASS = 'border-gray-600 bg-gray-900'
const PARTIAL_CLASS = 'border-yellow-500 bg-yellow-900/50'
const DONE_CLASS = 'border-green-500 bg-green-900/50'

export const equipmentStatuses: Record<EquipmentStatus, { label: string; className: string }> = {
  [EquipmentStatus.RAID]: { label: 'Raid', className: PENDING_CLASS },
  [EquipmentStatus.TOME]: { label: 'Tome', className: PENDING_CLASS },
  [EquipmentStatus.TWINE]: { label: 'Twine', className: PARTIAL_CLASS },
  [EquipmentStatus.GLAZE]: { label: 'Glaze', className: PARTIAL_CLASS },
  [EquipmentStatus.ACQUIRED]: { label: 'Acquired', className: DONE_CLASS },
}

// Twine upgrades armour, glaze upgrades accessories
export function statusOptionsFor(type: EquipmentType): EquipmentStatus[] {
  const upgrade = isAccessory(type) ? EquipmentStatus.GLAZE : EquipmentStatus.TWINE
  return [EquipmentStatus.RAID, EquipmentStatus.TOME, upgrade, EquipmentStatus.ACQUIRED]
}
