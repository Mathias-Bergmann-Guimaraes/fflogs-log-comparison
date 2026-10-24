// GET /api/fashion (server/fashion.ts): the newest Fashion Report guide, if one was ever posted
export type FashionReportInfo = {
  report: { image: string; postedAt: number } | null
}
