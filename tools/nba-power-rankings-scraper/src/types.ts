/** One item from the content-api-prod listing endpoint (article metadata only). */
export interface ContentListItem {
  id: number;
  type: string;
  name: string;
  title: string;
  slug: string;
  permalink: string;
  excerpt: string;
  date: string;
  modified: string;
}

/** A single team's entry within a structured power-rankings article. */
export interface PowerRankingTeamEntry {
  rank: number;
  previousRank: number | null;
  teamId: number;
  teamName: string;
  teamLink: string | null;
  /** Raw HTML blurb (record, ratings, "three takeaways", schedule) as published. */
  summaryHtml: string;
  /** Same blurb with HTML tags stripped, for easy reading/searching. */
  summaryText: string;
}

/** One scraped Power Rankings article. */
export interface PowerRankingsArticle {
  id: number;
  slug: string;
  url: string;
  title: string;
  shortTitle: string | null;
  excerpt: string;
  author: string | null;
  publishedAt: string;
  modifiedAt: string;
  /** e.g. "2023-24", derived from the slug or, failing that, the publish date. */
  season: string | null;
  /** Week number parsed from the slug/title, when this is a numbered weekly edition. */
  week: number | null;
  /** True when NBA.com published this article with the structured per-team rankings field. */
  hasStructuredRankings: boolean;
  rankings: PowerRankingTeamEntry[];
  /**
   * Plain-text article body, kept only when hasStructuredRankings is false
   * (NBA.com's pre-2017-18 archive has no structured per-team data) so the
   * article isn't dropped entirely — just less structured.
   */
  rawText: string | null;
}
