---
name: query-elo
description: Query the NBA ELO database (1946-47 through 2014-15)
---

# 538 ELO Database

This database contains ELO predictions for all games up through 2015.

## Usage

The database lives at `assets/elo.db` (plain SQLite file, no server/tool wrapper). Query it with the `sqlite3` CLI via Bash, e.g.:

```bash
sqlite3 assets/elo.db "SELECT ... ;"
```

Write a single SELECT statement per call. Prefer aggregating in SQL (COUNT/SUM/AVG/GROUP BY/ORDER BY/LIMIT) over pulling raw rows - there's no automatic row cap like a hosted query tool would have, so don't rely on one.

- Source: FiveThirtyEight's "NBA All Elo" dataset. Covers every NBA/BAA game, 1946-47 through 2014-15.
- Each real game produces TWO rows in `games` (one per team's perspective) - use the `games_unique` view (`is_copy = 0`, same columns) when you want one row per real game instead.
- "season" is the season-ENDING year (season = 1996 means the 1995-96 season).

### Schema (`games` / `games_unique`)

```
gameorder, game_id        -- sequence/id shared by both perspective rows of a game
league                    -- 'NBA' or 'BAA' (BAA = pre-1949 precursor)
is_copy                   -- 0 = primary row, 1 = mirrored opponent row
season, game_date, season_game_num, is_playoffs
team_id, team_name        -- historical abbreviation/nickname at the time
team_pts, team_elo_pre, team_elo_post, win_equiv
opp_team_id, opp_team_name, opp_pts, opp_elo_pre, opp_elo_post
location                  -- 'H' home, 'A' away, 'N' neutral
result                    -- 'W' or 'L' for team_id
forecast                  -- FiveThirtyEight's pre-game win probability for team_id
notes
```

### Franchise history and small-sample stints

A franchise can have multiple `team_id`/`team_name` pairs over its history (relocations, renames) - see the `teams` view (`team_id, team_name, first_season, last_season, games_played`). `team_name` often (but not always) stays constant across a relocation and changes on a rename, so grouping by `team_id` alone fragments a franchise into short stints - including some with only a handful of games (e.g. a 3-game or 30-game partial season). For "best/worst team" style questions:

- Run `SELECT DISTINCT team_id, team_name FROM games ORDER BY team_name;` first to see how a franchise's identifiers changed over time before deciding how to group it.
- Apply a minimum-games threshold (e.g. `HAVING games >= 200`) when ranking extremes, or report both the unfiltered and filtered results so tiny stints don't dominate.
