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
