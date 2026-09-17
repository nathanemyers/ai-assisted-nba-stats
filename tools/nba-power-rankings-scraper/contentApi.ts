import { fetchJsonWithRetry, sleep } from './http.js'
import type { ContentListItem } from './types.js'

/**
 * NBA.com's frontend (a Next.js app) lists category pages by calling this
 * public content API client-side — see the "Load more" button on
 * https://www.nba.com/news/category/power-rankings. It's not documented,
 * but it's unauthenticated and returns clean JSON, so we call it directly
 * instead of driving a browser.
 *
 * category id 3194 == "Power Rankings" (found by inspecting the query the
 * site itself makes; there's no public lookup for it).
 */
const CONTENT_API_BASE =
  'https://content-api-prod.nba.com/public/1/leagues/nba/content'
const POWER_RANKINGS_CATEGORY_ID = 3194
const PAGE_SIZE = 50

interface ContentListResponse {
  results: {
    count: number
    total: number
    pages: number
    pageNext: number | false
    items: ContentListItem[]
  }
}

/** Walks every page of the Power Rankings category listing, oldest and newest alike. */
export async function listAllPowerRankingsArticles({
  delayMs = 300,
}: { delayMs?: number } = {}): Promise<ContentListItem[]> {
  const items: ContentListItem[] = []
  let page: number | false = 1

  while (page !== false) {
    const url: string = `${CONTENT_API_BASE}?page=${page}&count=${PAGE_SIZE}&types=post&term-category=${POWER_RANKINGS_CATEGORY_ID}`
    const data: ContentListResponse =
      await fetchJsonWithRetry<ContentListResponse>(url)
    items.push(...data.results.items)
    page = data.results.pageNext
    if (page !== false) {
      await sleep(delayMs)
    }
  }

  return items
}
