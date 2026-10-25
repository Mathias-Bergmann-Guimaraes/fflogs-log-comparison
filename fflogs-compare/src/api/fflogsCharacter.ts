import { getToken } from '@/api/auth'

// A character on FF Logs. The account's comes from a character claimed through the Lodestone (characterStore), and FF Logs
// finds it by its lodestoneId; name and server (its home world) are only for showing it. Older saves (the Ultimate
// Weapons page's last sync) name it by FF Logs id or by region, server and name instead.
export type FFLogsCharacter = { lodestoneId?: number; id?: number; name?: string; server?: string; region?: string }

const isText = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 64
const isId = (v: unknown) => Number.isInteger(v) && (v as number) > 0

export function isCharacter(value: unknown): value is FFLogsCharacter {
  if (!value || typeof value !== 'object') return false
  const c = value as Record<string, unknown>
  if ([c.lodestoneId, c.id].some((v) => v !== undefined && !isId(v))) return false
  const parts = [c.name, c.server, c.region]
  if (parts.some((v) => v !== undefined && !isText(v))) return false
  return parts.every(isText) || c.id !== undefined || c.lodestoneId !== undefined
}

export function characterLabel(c: FFLogsCharacter) {
  if (!c.name) return c.lodestoneId ? `Lodestone character #${c.lodestoneId}` : `FF Logs character #${c.id}`
  const where = [c.server, c.region?.toUpperCase()].filter(Boolean).join(', ')
  return where ? `${c.name} (${where})` : c.name
}

export const characterUrl = (c: FFLogsCharacter) =>
  c.lodestoneId
    ? `https://www.fflogs.com/character/lodestone-id/${c.lodestoneId}`
    : c.id
      ? `https://www.fflogs.com/character/id/${c.id}`
      : `https://www.fflogs.com/character/${c.region}/${c.server}/${encodeURIComponent(c.name!)}`

// The arguments of characterData.character(): by Lodestone id when known, else by FF Logs id, else by name; the others
// null. Codegen's maybeValue: 'T' types every variable as required, hence the cast at the call sites.
export const characterArgs = (c: FFLogsCharacter) => {
  const none = { lodestoneID: null, id: null, name: null, serverSlug: null, serverRegion: null }
  if (c.lodestoneId) return { ...none, lodestoneID: c.lodestoneId }
  if (c.id) return { ...none, id: c.id }
  return { ...none, name: c.name!, serverSlug: c.server!, serverRegion: c.region! }
}

const same = (a?: string, b?: string) => a?.toLowerCase() === b?.toLowerCase()

// Whether two saves name the same character: by Lodestone id, else FF Logs id, when both have one; else by name and
// server (a save by Lodestone id has the home world as its server, which is FF Logs' server slug in other case)
export function sameCharacter(a: FFLogsCharacter | undefined, b: FFLogsCharacter | undefined) {
  if (!a || !b) return false
  if (a.lodestoneId && b.lodestoneId) return a.lodestoneId === b.lodestoneId
  if (a.id && b.id) return a.id === b.id
  return !!a.name && same(a.name, b.name) && same(a.server, b.server) && (!a.region || !b.region || same(a.region, b.region))
}

// The OAuth token for FF Logs' public API, fetched once (again after a failure)
let token: Promise<string> | undefined
export function fflogsToken() {
  token ??= getToken().catch((err) => {
    token = undefined
    throw err
  })
  return token
}
