---
name: query-elo
description: Query the NBA ELO database (1946-47 through 2014-15)
---

# 538 ELO Database

This database contains ELO predictions for all games up through 2015.

## Usage

You can find the database in `assets/elo.db`.

- Source: FiveThirtyEight's "NBA All Elo" dataset. Covers every NBA/BAA game, 1946-47 through 2014-15.
- Each real game produces TWO rows in "games" (one per team's perspective) - use "games_unique" (is_copy = 0) when you want one row per real game instead.
- "season" is the season-ENDING year (season = 1996 means the 1995-96 season).
- A franchise can have multiple team_id/team_name pairs over its history (relocations, renames) - see the "teams" view.

When you call query_database, write a single SQLite SELECT statement. Prefer aggregating in SQL (COUNT/SUM/AVG/GROUP BY/ORDER BY/LIMIT) over pulling raw rows, since results are capped at 200 rows.`;
