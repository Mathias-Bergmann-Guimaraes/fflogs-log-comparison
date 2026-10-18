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
}

// What the slot still needs to reach BiS; ACQUIRED means done
export enum EquipmentStatus {
  RAID = 'raid',
  TOME = 'tome',
  TWINE = 'twine',
  GLAZE = 'glaze',
  ACQUIRED = 'acquired',
}

// Which piece a slot's BiS is: the raid drop or the tome one (which twine/glaze then upgrade)
export type GearSource = 'raid' | 'tome'

const accessoryTypes = [EquipmentType.EARRINGS, EquipmentType.NECKLACE, EquipmentType.BRACELETS, EquipmentType.RING]

export function isAccessory(type: EquipmentType) {
  return accessoryTypes.includes(type)
}
