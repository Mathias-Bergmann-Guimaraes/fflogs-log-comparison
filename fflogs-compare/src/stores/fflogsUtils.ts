import type { ReportURL } from "@/types/fflogs";

export function parseReportURL(input:string): ReportURL{
   try {
    const url = new URL(input)

    return {
      code: url.pathname.split('/').pop() ?? input,
      fightIDs: url.searchParams.get('fight')?.split('.').map(Number) ?? []
    }
  } catch {
    return {code:"0", fightIDs: []}
  }
}

export const toNum = (v: string | number) => typeof v === 'string' ? parseFloat(v) : v
