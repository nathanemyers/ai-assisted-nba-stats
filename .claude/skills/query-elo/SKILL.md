---
name: query-elo
description: Query historical NBA/BAA/ABA game results and FiveThirtyEight Elo ratings (1946-47 through 2014-15) in a local SQLite DB. Use for team or franchise win/loss records, win %, best/worst teams or seasons, head-to-head, Elo peaks, and forecast accuracy for anything before the 2015-16 season.
---

# 538 ELO Database

Every NBA, BAA and ABA game from 1946-47 through 2014-15, with FiveThirtyEight's Elo ratings and pre-game forecasts. Nothing after the 2014-15 season is included.

## Usage

The database is a plain SQLite file. Run `sqlite3` from the **repo root** with the full path (a relative `assets/...` path fails because Claude does not run from the skill folder):

```bash
sqlite3 .claude/skills/query-elo/assets/elo.db "SELECT ... ;"
```

(`data/elo.db` is a symlink to the same file.) The database is read-only reference data: never modify it. Franchise grouping is done inside the query (see below), not with extra tables.

Write a single SELECT statement per call. Aggregate in SQL (COUNT/SUM/AVG/GROUP BY/ORDER BY/LIMIT) rather than pulling raw rows. There is no automatic row cap.

- Source: FiveThirtyEight "NBA All Elo" dataset.
- `season` is the season-ENDING year (1996 = the 1995-96 season).

## Read before answering: scope rules

1. **Leagues.** `league` is `'NBA'` or `'ABA'` (1968-76, 30 team ids, 4,149 unique games). 1940s BAA games are stored as `'NBA'`. ABA games are in the data. For "NBA" questions add `league = 'NBA'`; for "all-time" questions say whether the ABA is included.
2. **Franchises.** `team_id` changes whenever a franchise relocates or renames (e.g. Lakers are `MNL` then `LAL`; Spurs are `DLC`, `TEX`, `SAA`, `SAS`). Grouping by `team_id` fragments a franchise and drops years. `team_name` also changes on renames (Sonics to Thunder, Bullets to Wizards). For franchise-level questions, **use the mapping CTE below and group by `fid`.**
3. **Regular season vs playoffs.** `is_playoffs` is 0 or 1. "Win %" is ambiguous: pick regular season (`is_playoffs = 0`) unless the user asks otherwise, and **state which you used**. The choice can change the answer: NBA regular season only puts the Spurs first (.616), while all games including ABA and playoffs put the Lakers first (.607).
4. **Small samples.** Defunct 1940s teams and short stints can top rankings. Use `HAVING COUNT(*) >= 200` for "best/worst" questions, or report filtered and unfiltered results.
5. **Report your filters** (league, season type, minimum games) in the answer.

## Schema

`games` has two rows per real game, one per team's perspective. `games_unique` is the `is_copy = 0` half, one row per game. `is_copy = 0` does NOT mean the winner: `result` is from `team_id`'s perspective. To count each team's wins and losses, use `games` (both rows), not `games_unique`.

```
gameorder, game_id        -- sequence/id shared by both perspective rows of a game
league                    -- 'NBA' or 'ABA'
is_copy                   -- 0 = primary row, 1 = mirrored opponent row
season, game_date, season_game_num, is_playoffs
team_id, team_name        -- historical abbreviation/nickname at the time
team_pts, team_elo_pre, team_elo_post, win_equiv
opp_team_id, opp_team_name, opp_pts, opp_elo_pre, opp_elo_post
location                  -- 'H' home, 'A' away, 'N' neutral
result                    -- 'W' or 'L' for team_id
forecast                  -- 538 pre-game win probability for team_id
notes                     -- free text (e.g. neutral-site city); mixes NULL and '' for "none"
```

The `teams` view lists each `team_id`/`team_name` stint (`first_season`, `last_season`, `games_played`). Use it to see how ids change over time.

## Franchise mapping CTE

Prefix franchise-level queries with this CTE and `JOIN f ON f.team_id = g.team_id`. It maps every historical `team_id` to a franchise id (`fid`, the franchise's final id). Defunct teams are not listed because they map to themselves: use `COALESCE(f.fid, g.team_id)` with a `LEFT JOIN`. ABA teams that joined the NBA (Spurs, Nuggets, Pacers, Nets) are folded into their NBA franchise, so filter by `league` to separate the eras. The Condors, Floridians, Sounds, Spirits, Squires, Stars and Sails each changed ids too (see `teams`) and are folded together here.

```sql
WITH f(team_id, fid) AS (VALUES
 ('MNL','LAL'),('LAL','LAL'),
 ('DLC','SAS'),('TEX','SAS'),('SAA','SAS'),('SAS','SAS'),
 ('SEA','OKC'),('OKC','OKC'),
 ('NJA','BRK'),('NYA','BRK'),('NYN','BRK'),('NJN','BRK'),('BRK','BRK'),
 ('DNR','DEN'),('DNA','DEN'),('DEN','DEN'),
 ('INA','IND'),('IND','IND'),
 ('BUF','LAC'),('SDC','LAC'),('LAC','LAC'),
 ('VAN','MEM'),('MEM','MEM'),
 ('TRI','ATL'),('MLH','ATL'),('STL','ATL'),('ATL','ATL'),
 ('CHA','CHA'),('CHO','CHA'),
 ('NOJ','UTA'),('UTA','UTA'),
 ('ROC','SAC'),('CIN','SAC'),('KCO','SAC'),('KCK','SAC'),('SAC','SAC'),
 ('CHH','NOP'),('NOH','NOP'),('NOK','NOP'),('NOP','NOP'),
 ('FTW','DET'),('DET','DET'),
 ('SDR','HOU'),('HOU','HOU'),
 ('SYR','PHI'),('PHI','PHI'),
 ('PHW','GSW'),('SFW','GSW'),('GSW','GSW'),
 ('CHP','WAS'),('CHZ','WAS'),('BAL','WAS'),('CAP','WAS'),('WSB','WAS'),('WAS','WAS'),
 ('PTP','PTP'),('MNP','PTP'),('PTC','PTP'),
 ('MNM','FLO'),('MMF','FLO'),('FLO','FLO'),
 ('NOB','MMS'),('MMP','MMS'),('MMT','MMS'),('MMS','MMS'),
 ('HSM','SSL'),('CAR','SSL'),('SSL','SSL'),
 ('OAK','VIR'),('WSA','VIR'),('VIR','VIR'),
 ('ANA','UTS'),('LAS','UTS'),('UTS','UTS'),
 ('SDA','SDA'),('SDS','SDA'))
```

Notes:
- Franchises not in the CTE (BOS, CHI, MIL, NYK, ...) never changed id, or are defunct, so they map to themselves.
- Charlotte (`CHA`, `CHO`, 2005 on) is a separate franchise from the original Hornets (`CHH`), whose history belongs to the Pelicans.
- A franchise's display name is the `team_name` from its latest row. For the answer, use the common current name (e.g. `LAL` = Los Angeles Lakers).

## Recipes

Best franchise win % (NBA, regular season, 200+ games): put the full mapping CTE above in front of this query.

```sql
SELECT COALESCE(f.fid, g.team_id) AS fid, COUNT(*) AS games, SUM(g.result='W') AS wins,
       ROUND(1.0*SUM(g.result='W')/COUNT(*), 4) AS pct
FROM games g LEFT JOIN f ON f.team_id = g.team_id
WHERE g.league = 'NBA' AND g.is_playoffs = 0
GROUP BY fid HAVING games >= 200
ORDER BY pct DESC LIMIT 10;
```

Single-team questions don't need the CTE: a plain `WHERE team_id IN ('MNL','LAL')` is enough once you know the ids from `teams`.

Peak Elo by team-season (use `team_id`; add the CTE to roll up by franchise):

```bash
sqlite3 .claude/skills/query-elo/assets/elo.db "SELECT team_name, season, ROUND(MAX(team_elo_post),0) peak_elo FROM games GROUP BY team_id, season ORDER BY peak_elo DESC LIMIT 10;"
```

Head-to-head record (Celtics vs Lakers, both ids for the Lakers):

```bash
sqlite3 .claude/skills/query-elo/assets/elo.db "SELECT SUM(result='W') wins, SUM(result='L') losses FROM games WHERE team_id='BOS' AND opp_team_id IN ('MNL','LAL');"
```

Forecast accuracy by season (share of games where the favorite won):

```bash
sqlite3 .claude/skills/query-elo/assets/elo.db "SELECT season, ROUND(AVG((forecast>0.5)=(result='W')),3) acc FROM games_unique WHERE forecast<>0.5 GROUP BY season ORDER BY season DESC LIMIT 10;"
```
