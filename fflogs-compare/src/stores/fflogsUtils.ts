import type { ReportURL } from "./fflogsDataType";

export function parseReportURL(input:string): ReportURL{
   try {
    const url = new URL(input)

    return {
      code: url.pathname.split('/').pop() ?? input,
      fightIDs: url.searchParams.get('fight')?.split('.').map(Number) ?? undefined
    }
  } catch {
    return {code:"0"}
  }
}
