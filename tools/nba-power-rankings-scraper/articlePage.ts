import { fetchTextWithRetry } from "./http.js";
import { htmlToText } from "./htmlToText.js";
import type { PowerRankingsArticle, PowerRankingTeamEntry } from "./types.js";

const NEXT_DATA_RE = /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s;

/** Raw shape (only the fields we use) of `pageProps.article` embedded in the article page's __NEXT_DATA__. */
interface RawArticle {
  id: number;
  slug: string;
  permalink: string;
  title: string;
  shortTitle?: string | null;
  excerpt: string;
  date: string;
  modified: string;
  author?: { name?: string | null } | null;
  contentText?: string | null;
  contentFiltered?: string | null;
  powerRankings?: Array<{
    teamId: number;
    teamName: string;
    teamLink?: string | null;
    lastWeekRank: number | null;
    currentWeekRank: number;
    powerRankSummary: string;
  }> | null;
}

function extractNextData(html: string): unknown {
  const match = NEXT_DATA_RE.exec(html);
  if (!match) {
    throw new Error("Could not find __NEXT_DATA__ script tag in article page");
  }
  return JSON.parse(match[1]);
}

function deriveSeason(slug: string, publishedAt: string): string | null {
  const inSlug = /(\d{4})-(\d{2})(?!\d)/.exec(slug);
  if (inSlug) {
    return `${inSlug[1]}-${inSlug[2]}`;
  }

  // Pre-2017 slugs don't encode the season, so fall back to the publish date.
  // NBA seasons start in October, so August onward counts as the *next* season.
  const publishedDate = new Date(publishedAt);
  if (Number.isNaN(publishedDate.getTime())) {
    return null;
  }
  const year = publishedDate.getUTCFullYear();
  const month = publishedDate.getUTCMonth() + 1;
  const startYear = month >= 8 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

function deriveWeek(slug: string, title: string): number | null {
  const match = /week-(\d+)/i.exec(slug) ?? /week\s+(\d+)/i.exec(title);
  return match ? parseInt(match[1], 10) : null;
}

/** Fetches one Power Rankings article page and parses it into our normalized shape. */
export async function fetchPowerRankingsArticle(url: string): Promise<PowerRankingsArticle> {
  const html = await fetchTextWithRetry(url);
  const nextData = extractNextData(html) as {
    props?: { pageProps?: { article?: RawArticle } };
  };
  const raw = nextData.props?.pageProps?.article;
  if (!raw) {
    throw new Error(`Article data missing from __NEXT_DATA__ for ${url}`);
  }

  const rankings: PowerRankingTeamEntry[] = (raw.powerRankings ?? [])
    .map((entry) => ({
      rank: entry.currentWeekRank,
      previousRank: entry.lastWeekRank ?? null,
      teamId: entry.teamId,
      teamName: entry.teamName,
      teamLink: entry.teamLink ?? null,
      summaryHtml: entry.powerRankSummary,
      summaryText: htmlToText(entry.powerRankSummary),
    }))
    .sort((a, b) => a.rank - b.rank);

  const hasStructuredRankings = rankings.length > 0;

  return {
    id: raw.id,
    slug: raw.slug,
    url: raw.permalink || url,
    title: raw.title,
    shortTitle: raw.shortTitle ?? null,
    excerpt: raw.excerpt,
    author: raw.author?.name ?? null,
    publishedAt: raw.date,
    modifiedAt: raw.modified,
    season: deriveSeason(raw.slug, raw.date),
    week: deriveWeek(raw.slug, raw.title),
    hasStructuredRankings,
    rankings,
    rawText: hasStructuredRankings
      ? null
      : htmlToText(raw.contentFiltered || raw.contentText || ""),
  };
}
