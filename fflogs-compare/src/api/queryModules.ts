import type { RateLimitData, Report, ReportPlayers } from '@/stores/fflogsDataType'

export interface QueryModule {
  variables: string[]
  fields: string
}

export const MODULE_REGISTRY = {
  rateLimitData: {
    variables: [],
    fields: `
    rateLimitData {
      limitPerHour
      pointsSpentThisHour
      pointsResetIn
    }`,
  },

  reportData: {
    variables: ['$code: String!'],
    fields: `
    reportData {
      report(code: $code) {
        title
        startTime
        endTime
        fights {
          id
          name
          kill
          difficulty
          lastPhaseAsAbsoluteIndex
        }
      }
    }`,
  },

  reportPlayers: {
    variables: ['$code: String!', '$fightIDs: [Int!]!'],
    fields: `
    reportData {
      report(code: $code) {
        masterData {
          actors(type: "Player") { id name subType server }
        }
        fights(fightIDs: $fightIDs) { friendlyPlayers }
      }
    }`,
  },
} as const satisfies Record<string, QueryModule>

export type ModuleKey = keyof typeof MODULE_REGISTRY

type ModuleDataMap = {
  rateLimitData: { rateLimitData: RateLimitData }
  reportData: { reportData: { report: Report } }
  reportPlayers: { reportData: { report: ReportPlayers } }
}

type UnionToIntersection<U> =
  (U extends unknown ? (x: U) => void : never) extends (x: infer I) => void ? I : never

export type QueryResult<Keys extends ModuleKey[]> =
  UnionToIntersection<ModuleDataMap[Keys[number]]>

export function buildQuery<const Keys extends ModuleKey[]>(modules: Keys): { gql: string } {
  const vars = [...new Set(modules.flatMap(k => [...MODULE_REGISTRY[k].variables]))]
  const signature = vars.length ? `(${vars.join(', ')})` : ''
  const body = modules.map(k => MODULE_REGISTRY[k].fields).join('\n')
  return { gql: `query${signature} {\n${body}\n}` }
}
