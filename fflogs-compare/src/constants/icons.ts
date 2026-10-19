import { EquipmentStatus, EquipmentType, type GearSource } from '@/types/EquipmentType'
import raidIcon from '@/assets/raid.png'
import tomeIcon from '@/assets/Allagan_Tomestone_of_Mnemonics.png'
import twineIcon from '@/assets/Thundersteeped_twine_icon1.png'
import glazeIcon from '@/assets/Thundersteeping_glaze_icon1.png'
import solventIcon from '@/assets/Thundersteeped_solvent.png'
import dungeonIcon from '@/assets/dungeon.png'
import relicIcon from '@/assets/relic.png'
import trialIcon from '@/assets/trial.png'
import ultimateIcon from '@/assets/ultimate.png'
import nutsIcon from '@/assets/Sack_of_Nuts.png'
import centurioIcon from '@/assets/Centurio_Seal.png'
import poeticsIcon from '@/assets/Allagan_Tomestone_of_Poetics.png'
import mathematicsIcon from '@/assets/Allagan_Tomestone_of_Mathematics.png'
import { gearItemIds, gearItemNames } from '@/constants/gearItems'
import type { Currency } from '@/views/hunts/dashboard/trains'

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
  // Not a Lodestone icon like the rest: XIVAPI's for a sword, since there's no job-neutral weapon
  [EquipmentType.WEAPON]: 'https://v2.xivapi.com/api/asset?path=ui/icon/030000/030700_hr1.tex&format=png',
}

export const equipmentStatusIcons: Record<EquipmentStatus, string> = {
  [EquipmentStatus.RAID]: raidIcon,
  [EquipmentStatus.TOME]: tomeIcon,
  [EquipmentStatus.TWINE]: twineIcon,
  [EquipmentStatus.GLAZE]: glazeIcon,
  [EquipmentStatus.SOLVENT]: solventIcon,
  [EquipmentStatus.DUNGEON]: dungeonIcon,
  [EquipmentStatus.RELIC]: relicIcon,
  [EquipmentStatus.TRIAL]: trialIcon,
  [EquipmentStatus.ULTIMATE]: ultimateIcon,
  [EquipmentStatus.ACQUIRED]: ``,
}

// Hunt rewards (icons from XIVAPI, 72px)
export const currencyIcons: Record<Currency, string> = {
  'Sacks of Nuts': nutsIcon,
  'Centurio Seals': centurioIcon,
  Poetics: poeticsIcon,
  Mathematics: mathematicsIcon,
  Mnemonics: tomeIcon,
}

export type GearPiece ={ icon: string; name: string | null }

// The job's actual piece this tier (icons are 80px), or the generic slot icon if gearItems.ts doesn't know it.
// Dungeon gear isn't in gearItems.ts, so it's always the generic icon.
export function gearPiece(job: string, type: EquipmentType, source: GearSource): GearPiece {
  const id = gearItemIds[job]?.[type]?.[source]
  return id ? { icon: `/gear/${id}.png`, name: gearItemNames[id] ?? null } : { icon: equipmentIcons[type], name: null }
}
