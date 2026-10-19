export enum EquipmentType {
  HEAD,
  BODY,
  HANDS,
  LEGS,
  FEET,
  EARRINGS,
  NECKLACE,
  BRACELETS,
  RING,
  WEAPON,
}

// What the slot still needs to reach BiS; ACQUIRED means done
export enum EquipmentStatus {
  RAID = 'raid',
  TOME = 'tome',
  TWINE = 'twine',
  GLAZE = 'glaze',
  SOLVENT = 'solvent',
  DUNGEON = 'dungeon',
  RELIC = 'relic',
  TRIAL = 'trial',
  ULTIMATE = 'ultimate',
  ACQUIRED = 'acquired',
}

// Which piece a slot's BiS is: the raid drop, the tome one (which twine/glaze/solvent then upgrade), a dungeon drop,
// or for the weapon the relic, the extreme trial's or the tier's ultimate's
export type GearSource = 'raid' | 'tome' | 'dungeon' | 'relic' | 'trial' | 'ultimate'

const accessoryTypes = [EquipmentType.EARRINGS, EquipmentType.NECKLACE, EquipmentType.BRACELETS, EquipmentType.RING]

export function isAccessory(type: EquipmentType) {
  return accessoryTypes.includes(type)
}
