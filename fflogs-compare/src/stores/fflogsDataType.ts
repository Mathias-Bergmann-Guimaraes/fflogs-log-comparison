export interface Fight {
  id: number
  name: string
  kill: boolean
  difficulty: number
  lastPhaseAsAbsoluteIndex: number
}

export interface Report {
  title: string
  startTime: number
  endTime: number
  fights: Fight[]
}

export interface RateLimitData {
  limitPerHour: number
  pointsSpentThisHour: number
  pointsResetIn: number
}

export interface PlayerDetails {
  id: number
  name: string
  subType: string
  server: string
}

export interface ReportPlayers {
  masterData: {
    actors: PlayerDetails[]
  }
  fights?: ReportFight[]
}

export interface ReportFight{
  friendlyPlayers: number[]
}

export interface ReportURL {
  code: string
  fightIDs?: number[]
}
