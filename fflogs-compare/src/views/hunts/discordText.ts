import type { HuntPing } from '@/types/hunts'
import { apiFetch } from '@/api/backend'

// Discord message markup split into pieces the template renders one by one (no v-html, so message text
// can't inject markup). Only what hunt posts use is handled; other markdown stays as plain text.
export type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'link'; url: string }
  | { kind: 'ping'; ping: HuntPing }
  | { kind: 'mention'; text: string }
  | { kind: 'emoji'; name: string; url: string }
  | { kind: 'time'; text: string; title: string }

const TOKEN_RE =
  /<@&(\d+)>|@everyone|@here|<@!?(\d+)>|<#(\d+)>|<(a?):(\w+):(\d+)>|<t:(-?\d+)(?::([tTdDfFR]))?>|\*\*(.+?)\*\*|(https?:\/\/[^\s<>]+[^\s<>.,;:!?)\]'"])/g

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
const RELATIVE_STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 30],
  ['month', 12],
  ['year', Infinity],
]

export function relativeTime(ms: number, now = Date.now()): string {
  let value = (ms - now) / 1000
  for (const [unit, size] of RELATIVE_STEPS) {
    if (Math.abs(value) < size) return relative.format(Math.round(value), unit)
    value /= size
  }
  return ''
}

// Discord's <t:unix:style> timestamp styles
function formatTime(ms: number, style = 'f'): string {
  const date = new Date(ms)
  switch (style) {
    case 't':
      return date.toLocaleTimeString(undefined, { timeStyle: 'short' })
    case 'T':
      return date.toLocaleTimeString(undefined, { timeStyle: 'medium' })
    case 'd':
      return date.toLocaleDateString(undefined, { dateStyle: 'short' })
    case 'D':
      return date.toLocaleDateString(undefined, { dateStyle: 'long' })
    case 'F':
      return date.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })
    case 'R':
      return relativeTime(ms)
    default:
      return date.toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })
  }
}

export function parseDiscordText(content: string): Segment[] {
  const segments: Segment[] = []
  let last = 0
  for (const m of content.matchAll(TOKEN_RE)) {
    if (m.index > last) segments.push({ kind: 'text', text: content.slice(last, m.index) })
    last = m.index + m[0].length

    const [token, roleId, userId, channelId, animated, emojiName, emojiId, unix, timeStyle, bold, url] = m
    if (roleId) segments.push({ kind: 'ping', ping: `role:${roleId}` })
    else if (token === '@everyone' || token === '@here') segments.push({ kind: 'ping', ping: token })
    // Users and channels of the hunt server can't be resolved from here
    else if (userId) segments.push({ kind: 'mention', text: '@user' })
    else if (channelId) segments.push({ kind: 'mention', text: '#channel' })
    else if (emojiId)
      segments.push({
        kind: 'emoji',
        name: emojiName!,
        url: `https://cdn.discordapp.com/emojis/${emojiId}.${animated ? 'gif' : 'webp'}?size=48`,
      })
    else if (unix) {
      const ms = Number(unix) * 1000
      segments.push({ kind: 'time', text: formatTime(ms, timeStyle), title: formatTime(ms, 'F') })
    } else if (bold) segments.push({ kind: 'bold', text: bold })
    else if (url) segments.push({ kind: 'link', url })
  }
  if (last < content.length) segments.push({ kind: 'text', text: content.slice(last) })
  return segments
}

// Ant Design tag presets; each ping always gets the same one, so e.g. an expansion's train ping is recognisable by colour
const PING_COLORS = ['magenta', 'volcano', 'gold', 'green', 'cyan', 'blue', 'geekblue', 'purple', 'red', 'lime', 'orange']

export function pingColor(ping: HuntPing): string {
  let hash = 0
  for (const ch of ping) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return PING_COLORS[hash % PING_COLORS.length]!
}

// Hunt server roles are only known by id; the user names them (saved in the huntPingLabels setting)
export function pingLabel(ping: HuntPing, labels: Record<string, string>): string {
  if (labels[ping]) return labels[ping]
  return ping.startsWith('role:') ? `Role …${ping.slice(-4)}` : ping
}

// Names of the hunt server's roles, so they read right before anyone names them. A user's own names win.
export const DEFAULT_PING_LABELS: Record<string, string> = {
  // A rank trains
  'role:1255412015757918240': '7.0',
  'role:934264593470070784': '6.0',
  'role:934264458069561354': '5.0',
  'role:1091904124301353110': 'Old',
  // S ranks
  'role:1252550450251563049': '7.0',
  'role:932118510841258024': '6.0',
  'role:932118446882295808': '5.0',
  'role:932114569390862347': 'Old S',
}

// The huntPingLabels setting over the defaults, cleaned of anything that isn't a string
export async function fetchPingLabels(): Promise<Record<string, string>> {
  const { value } = await apiFetch<{ value: unknown }>('/settings/huntPingLabels')
  if (!value || typeof value !== 'object') return { ...DEFAULT_PING_LABELS }
  return { ...DEFAULT_PING_LABELS, ...Object.fromEntries(Object.entries(value).filter((e): e is [string, string] => typeof e[1] === 'string')) }
}
