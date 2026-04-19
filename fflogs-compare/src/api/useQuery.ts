import { query } from '@/api/fflogs'
import { buildQuery, type ModuleKey, type QueryResult } from '@/api/queryModules'

export async function queryModules<const Keys extends ModuleKey[]>(
  token: string,
  modules: Keys,
  variables: Record<string, unknown> = {}
): Promise<QueryResult<Keys>> {
  const { gql } = buildQuery(modules)
  return query<QueryResult<Keys>>(token, gql, variables)
}
