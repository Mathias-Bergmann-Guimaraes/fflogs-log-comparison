// Shared by the API server (server/characters.ts) and the Profile modal. No imports, so the server can import it.

// A character as the Lodestone shows it. lodestoneId: the number in its Lodestone link. avatar: its portrait's link.
export type LodestoneCharacter = { lodestoneId: string; name: string; world: string; dataCenter?: string; avatar?: string }

// Verified: the account's code was found in the character's Lodestone profile.
// fflogs: the account's FF Logs character (at most one); the first claim is it until another is picked.
export type ClaimedCharacter = LodestoneCharacter & { verifiedAt: number; fflogs: boolean }

// Waiting for the code to show up on the Lodestone. expiresAt: after that, starting again hands out a new code.
export type PendingClaim = LodestoneCharacter & { code: string; createdAt: number; expiresAt: number }

// GET /api/characters
export type CharacterClaims = { claimed: ClaimedCharacter[]; pending: PendingClaim[] }

// Where a character's owner edits its Lodestone profile text ("Character Profile")
export const LODESTONE_PROFILE_SETTINGS = 'https://na.finalfantasyxiv.com/lodestone/my/setting/profile/'
export const lodestoneUrl = (lodestoneId: string) => `https://na.finalfantasyxiv.com/lodestone/character/${lodestoneId}/`
export const fflogsUrl = (lodestoneId: string | number) => `https://www.fflogs.com/character/lodestone-id/${lodestoneId}`
// tomestone.gg wants a name after the id (any will do, but this is theirs): lowercase, accents dropped, dashes between words
export const tomestoneUrl = (c: LodestoneCharacter) =>
  `https://tomestone.gg/character/${c.lodestoneId}/${c.name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`
