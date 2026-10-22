import { getToken } from '@/api/auth'
import { fetchCharacterLookup } from '@/api/useQuery'

// A character on FF Logs: by its FF Logs id, or by region, server and name (both, once it's been looked up)
export type FFLogsCharacter = { id?: number; name?: string; server?: string; region?: string }

const isText = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 64

export function isCharacter(value: unknown): value is FFLogsCharacter {
  if (!value || typeof value !== 'object') return false
  const c = value as Record<string, unknown>
  if (c.id !== undefined && !(Number.isInteger(c.id) && (c.id as number) > 0)) return false
  const named = [c.name, c.server, c.region].every(isText)
  if (!named && [c.name, c.server, c.region].some((v) => v !== undefined)) return false
  return named || c.id !== undefined
}

// A character page link, as copied from FF Logs: .../character/eu/cerberus/Some%20Name or .../character/id/12345.
// undefined if it isn't one.
export function parseCharacterLink(link: string): FFLogsCharacter | undefined {
  const match = /fflogs\.com\/character\/([^/?#]+)\/([^/?#]+)(?:\/([^/?#]+))?/i.exec(link.trim())
  if (!match) return undefined
  const [, first, second, third] = match
  if (first!.toLowerCase() === 'id' && !third) return /^\d+$/.test(second!) ? { id: Number(second) } : undefined
  if (!third) return undefined
  try {
    return { region: first!.toLowerCase(), server: decodeURIComponent(second!).toLowerCase(), name: decodeURIComponent(third) }
  } catch {
    return undefined // malformed %-escape
  }
}

export const characterLabel = (c: FFLogsCharacter) => (c.name ? `${c.name} (${c.server}, ${c.region!.toUpperCase()})` : `FF Logs character #${c.id}`)

export const characterUrl = (c: FFLogsCharacter) =>
  c.id ? `https://www.fflogs.com/character/id/${c.id}` : `https://www.fflogs.com/character/${c.region}/${c.server}/${encodeURIComponent(c.name!)}`

// The arguments of characterData.character(): by id when known, else by name; the others null. Codegen's maybeValue: 'T'
// types every variable as required, hence the cast at the call sites.
export const characterArgs = (c: FFLogsCharacter) =>
  c.id ? { id: c.id, name: null, serverSlug: null, serverRegion: null } : { id: null, name: c.name!, serverSlug: c.server!, serverRegion: c.region! }

// Whether two saves name the same character (the id when both have one)
export const sameCharacter = (a: FFLogsCharacter | undefined, b: FFLogsCharacter | undefined) =>
  !!a && !!b && (a.id && b.id ? a.id === b.id : a.name === b.name && a.server === b.server && a.region === b.region)

// The OAuth token for FF Logs' public API, fetched once (again after a failure)
let token: Promise<string> | undefined
export function fflogsToken() {
  token ??= getToken().catch((err) => {
    token = undefined
    throw err
  })
  return token
}

// The character as FF Logs knows it, with its id, exact name and server; throws if there's no such character
export async function lookUpCharacter(c: FFLogsCharacter): Promise<FFLogsCharacter> {
  const data = await fetchCharacterLookup(await fflogsToken(), characterArgs(c) as unknown as Parameters<typeof fetchCharacterLookup>[1])
  const found = data.characterData.character
  if (!found) throw new Error(`${characterLabel(c)} isn't on FF Logs`)
  return { id: found.id, name: found.name, server: found.server.slug, region: found.server.region.slug.toLowerCase() }
}
