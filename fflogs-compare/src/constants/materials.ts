import { EquipmentStatus } from '@/types/EquipmentType'
import { equipmentStatusIcons } from '@/constants/icons'
import type { Materials } from '@/stores/bisStore'

// Display order and labels for what unfinished BiS items cost
export const materialDefs: { key: keyof Materials; label: string; icon: string }[] = [
  { key: 'tomes', label: 'Tomestones', icon: equipmentStatusIcons[EquipmentStatus.TOME] },
  { key: 'twines', label: 'Twines', icon: equipmentStatusIcons[EquipmentStatus.TWINE] },
  { key: 'glazes', label: 'Glazes', icon: equipmentStatusIcons[EquipmentStatus.GLAZE] },
  { key: 'solvents', label: 'Solvents', icon: equipmentStatusIcons[EquipmentStatus.SOLVENT] },
]
