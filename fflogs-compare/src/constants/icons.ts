import { EquipmentStatus, EquipmentType } from '@/types/EquipmentType'
import raidIcon from '@/assets/raid.png'
import tomeIcon from '@/assets/Allagan_Tomestone_of_Mnemonics.png'
import twineIcon from '@/assets/Thundersteeped_twine_icon1.png'
import glazeIcon from '@/assets/Thundersteeping_glaze_icon1.png'

const ICON_BASE = 'https://lds-img.finalfantasyxiv.com/itemicon'

export const equipmentIcons: Record<EquipmentType, string> = {
  [EquipmentType.HEAD]: `${ICON_BASE}/c7/c7d3950cf65a2a020b1c2cb735ae2c7242a39288.png`,
  [EquipmentType.BODY]: `${ICON_BASE}/20/20852415684acf66dc77006dc0ba82d6afbf9442.png`,
  [EquipmentType.HANDS]: `${ICON_BASE}/e6/e65b9cfdf59e422024f83c76fa27d37b04446b8a.png`,
  [EquipmentType.LEGS]: `${ICON_BASE}/ed/ed2896ee0aa046e05cae8dac6dac2c7a65bdaab4.png`,
  [EquipmentType.FEET]: `${ICON_BASE}/8d/8d7f70d22689df8a56dbe5b98f9aaf31e4544808.png`,
  [EquipmentType.EARRINGS]: `${ICON_BASE}/52/527150317ca7bae8a209cb9598e32a89f67896d6.png`,
  [EquipmentType.NECKLACE]: `${ICON_BASE}/62/62571593c8d89fb74ad208a5a618a5255e12fa36.png`,
  [EquipmentType.BRACELETS]: `${ICON_BASE}/f8/f81f6b4e9af75cb515672f2e66e7bf9c94927b4a.png`,
  [EquipmentType.RING]: `${ICON_BASE}/ba/baebc2fd0a60fd2424b78c16bf8dc8282496c545.png`,
}

export const equipmentStatusIcons: Record<EquipmentStatus, string> = {
  [EquipmentStatus.RAID]: raidIcon,
  [EquipmentStatus.TOME]: tomeIcon,
  [EquipmentStatus.TWINE]: twineIcon,
  [EquipmentStatus.GLAZE]: glazeIcon,
  [EquipmentStatus.ACQUIRED]: ``,
}
