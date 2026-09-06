import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

import { listAllPowerRankingsArticles } from "./contentApi.js";
import { fetchPowerRankingsArticle } from "./articlePage.js";
import { sleep } from "./http.js";
import type { PowerRankingsArticle } from "./types.js";

export interface ScrapeOptions {
  /** How many years back from today to keep. NBA.com's own archive for this category starts in Oct 2016. */
  years: number;
  outDir: string;
  delayMs: number;
  /** Re-fetch and overwrite articles that were already saved from a previous run. */
  force: boolean;
}

export interface IndexEntry {
  id: number;
  slug: string;
  title: string;
  season: string | null;
  week: number | null;
  publishedAt: string;
  hasStructuredRankings: boolean;
  file: string;
}

function slugify(value: string): string {
  return value.replace(/[^a-z0-9-]/gi, "_");
}

function articleFilePath(article: Pick<PowerRankingsArticle, "season" | "slug">): string {
  const seasonDir = article.season ? slugify(article.season) : "unknown-season";
  return path.join("articles", seasonDir, `${slugify(article.slug)}.json`);
}

export async function scrape(options: ScrapeOptions): Promise<void> {
  const cutoff = new Date();
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - options.years);

  console.log("Fetching Power Rankings article list from NBA.com...");
  const listItems = await listAllPowerRankingsArticles({ delayMs: options.delayMs });
  console.log(`Found ${listItems.length} articles total.`);

  const inRange = listItems.filter((item) => new Date(item.date) >= cutoff);
  console.log(
    `${inRange.length} articles published on or after ${cutoff.toISOString().slice(0, 10)} ` +
      `(the rest of NBA.com's archive is older than the requested ${options.years}-year window).`,
  );

  await mkdir(options.outDir, { recursive: true });

  const index: IndexEntry[] = [];
  let fetched = 0;
  let skipped = 0;
  let failed = 0;

  for (const [i, item] of inRange.entries()) {
    console.log(`[${i + 1}/${inRange.length}] ${item.slug}`);

    try {
      let article: PowerRankingsArticle;
      const existingPath = options.force ? null : await findExistingArticleFile(options.outDir, item.slug);

      if (existingPath) {
        article = JSON.parse(await readFile(existingPath, "utf8")) as PowerRankingsArticle;
        skipped++;
      } else {
        article = await fetchPowerRankingsArticle(item.permalink);
        const filePath = path.join(options.outDir, articleFilePath(article));
        await mkdir(path.dirname(filePath), { recursive: true });
        await writeFile(filePath, JSON.stringify(article, null, 2), "utf8");
        fetched++;
        await sleep(options.delayMs);
      }

      index.push({
        id: article.id,
        slug: article.slug,
        title: article.title,
        season: article.season,
        week: article.week,
        publishedAt: article.publishedAt,
        hasStructuredRankings: article.hasStructuredRankings,
        file: articleFilePath(article),
      });
    } catch (err) {
      failed++;
      console.error(`  failed: ${String(err)}`);
    }
  }

  index.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  await writeFile(path.join(options.outDir, "index.json"), JSON.stringify(index, null, 2), "utf8");

  console.log(
    `\nDone. Fetched ${fetched}, skipped (already saved) ${skipped}, failed ${failed}. ` +
      `Index written to ${path.join(options.outDir, "index.json")}.`,
  );
}

/** Looks for a previously-saved article with this slug under any season subdirectory. */
async function findExistingArticleFile(outDir: string, slug: string): Promise<string | null> {
  const articlesDir = path.join(outDir, "articles");
  if (!existsSync(articlesDir)) {
    return null;
  }
  const fileName = `${slugify(slug)}.json`;
  for (const seasonDir of await readdir(articlesDir)) {
    const candidate = path.join(articlesDir, seasonDir, fileName);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}
