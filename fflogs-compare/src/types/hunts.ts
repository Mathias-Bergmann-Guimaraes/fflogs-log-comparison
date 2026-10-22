// Shared by the API server (server/hunts.ts) and the Hunts page. Type-only, so the server can import it.

// Hunt rank of a channel, from its name ("A Light", "s-chaos", ...); see channelRank in server/hunts.ts
export type HuntRank = 'A' | 'S'

// A ping found in a message: 'role:<id>', '@everyone' or '@here'
export type HuntPing = string

export type HuntEmbed = {
  title?: string
  description?: string
  url?: string
  color?: number
  author?: string
  footer?: string
  thumbnail?: string
  image?: string
  fields: { name: string; value: string; inline: boolean }[]
}

export type HuntAttachment = { url: string; filename: string; isImage: boolean }

export type HuntMessage = {
  id: string
  channelId: string | null
  channelName: string | null
  authorName: string
  authorIcon: string | null
  content: string
  embeds: HuntEmbed[]
  attachments: HuntAttachment[]
  pings: HuntPing[]
  createdAt: number
  editedAt: number | null
}

// GET /api/hunts?before=<message id>&ping=<ping>&channel=<channel id>&rank=<A|S>
export type HuntPage = { messages: HuntMessage[]; hasMore: boolean }

// GET /api/hunts/trains: every A rank message (newest first), only what the Hunt Dashboard parses
export type HuntTrainMessage = Pick<HuntMessage, 'id' | 'channelName' | 'content' | 'pings' | 'createdAt'>
export type HuntTrainList = { enabled: boolean; messages: HuntTrainMessage[] }

// GET /api/hunts/sranks: the last day's S rank messages (newest first), with their embeds, which hold the zone,
// spawn points and map image the Hunt Dashboard shows
export type HuntSRankMessage = Pick<HuntMessage, 'id' | 'channelName' | 'content' | 'embeds' | 'createdAt'>
export type HuntSRankList = { enabled: boolean; messages: HuntSRankMessage[] }

// GET /api/hunts/meta?rank=<A|S>
export type HuntMeta = {
  // False when neither pushing (HUNT_INGEST_SECRET) nor polling (bot token + channel) is configured
  enabled: boolean
  // Whether the server reads the channel itself; lastSyncAt/syncError are about that
  polling: boolean
  lastSyncAt: number | null
  syncError: string | null
  // Last time a bot pushed messages to /api/hunts/ingest since the server started
  lastPushAt: number | null
  pings: { ping: HuntPing; count: number; lastAt: number }[]
  // name is the latest one seen for the channel, null if no message brought one
  channels: { id: string; name: string | null; count: number; lastAt: number }[]
}
