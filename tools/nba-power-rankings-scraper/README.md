# nba-power-rankings-scraper

Scrapes NBA.com's weekly "Power Rankings" articles (written by John
Schuhmann) into JSON.

## How it works

NBA.com's site is a Next.js app. The "Load more" button on
[nba.com/news/category/power-rankings](https://www.nba.com/news/category/power-rankings)
calls an undocumented but public, unauthenticated JSON API
(`content-api-prod.nba.com`) to list articles in that category, and each
article page embeds a `__NEXT_DATA__` script tag with the full article body
— including, for articles from the 2017-18 season onward, a structured
`powerRankings` array (team, current/previous rank, and an HTML blurb with
record/ratings/analysis for each team). This tool calls that listing API to
discover every Power Rankings article, then fetches and parses each one.

**Coverage note:** NBA.com only started publishing rankings in this
structured, per-team format partway through the 2017-18 season buildup
(August 2017). The category archive itself only goes back to October 2016
(the 2016-17 season) — articles from that first season exist but are
plain prose with no per-team breakdown recoverable from the current site,
so they're saved with `hasStructuredRankings: false` and a `rawText` field
instead of a `rankings` array. Everything from August 2017 onward has full
structured rankings.

## Usage

```bash
npm install
npm run scrape
```

By default this fetches the last 10 years of articles into `./data`. Options:

```
npm run scrape -- --years 10 --out ./data --delay-ms 400
```

- `--years <n>` — how far back to go (default 10)
- `--out <dir>` — output directory (default `./data`)
- `--delay-ms <n>` — delay between requests to NBA.com, to be polite (default 400)
- `--force` — re-fetch articles that were already saved by a previous run

Re-running without `--force` is cheap: any article already saved on disk is
read from disk instead of re-fetched, so you can resume an interrupted run
or extend the year range later without hitting NBA.com again for articles
you already have.

## Output

```
data/
  index.json                          # one row per article: id, slug, title,
                                       # season, week, date, whether it has
                                       # structured rankings, and its file path
  articles/
    2025-26/
      power-rankings-2025-26-week-11.json
      ...
    2016-17/
      power-rankings-week-1.json      # hasStructuredRankings: false
```

Each article file looks like:

```jsonc
{
  "id": 2262932,
  "slug": "power-rankings-2025-26-week-11",
  "url": "https://www.nba.com/news/power-rankings-2025-26-week-11",
  "title": "Power Rankings, Week 11: Spurs power past Thunder for No. 1",
  "author": "John Schuhmann",
  "publishedAt": "2026-01-05T17:00:00Z",
  "season": "2025-26",
  "week": 11,
  "hasStructuredRankings": true,
  "rankings": [
    {
      "rank": 1,
      "previousRank": 5,
      "teamId": 1610612759,
      "teamName": "San Antonio Spurs",
      "teamLink": "https://www.nba.com/spurs/",
      "summaryHtml": "<p><strong>Record:</strong> 23-8</p>...",
      "summaryText": "Record: 23-8\nOffRtg: 118.8 (5) ..."
    }
    // ...30 teams (or fewer for playoff-only editions), sorted by rank
  ],
  "rawText": null
}
```
