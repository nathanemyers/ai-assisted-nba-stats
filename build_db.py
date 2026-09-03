#!/usr/bin/env python3
"""
Builds a local SQLite database (nba.db) from the FiveThirtyEight
"NBA All Elo" dataset (nbaallelo.csv).

Source: https://github.com/fivethirtyeight/data/tree/master/nba-elo
Coverage: every NBA/BAA regular-season and playoff game, 1946-47 through
2014-15 (this is the last season FiveThirtyEight published for this file).

Each real-world game produces TWO rows in the source data -- one from each
team's point of view (see is_copy). We keep that shape (it makes "team X's
game log" a single WHERE clause) but rename columns to be self-explanatory
and add indexes for the columns an LLM-generated query is most likely to
filter or join on.

The repo already ships a prebuilt data/nba.db, so you only need to run this
if you want to rebuild it from scratch. Re-running re-downloads the source
CSV (about 18MB) if it isn't already sitting next to this script.
"""
import csv
import sqlite3
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / "nbaallelo.csv"
DB = HERE / "data" / "nba.db"
CSV_URL = "https://raw.githubusercontent.com/fivethirtyeight/data/master/nba-elo/nbaallelo.csv"


def ensure_source_csv():
    if SRC.exists():
        return
    print(f"downloading {CSV_URL} ...")
    urllib.request.urlretrieve(CSV_URL, SRC)

SCHEMA = """
CREATE TABLE games (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,  -- one row per (game, team) perspective
    gameorder         INTEGER NOT NULL,      -- sequence number of the underlying game (shared by both perspective rows)
    game_id           TEXT NOT NULL,         -- shared by both teams' rows for one real game
    league            TEXT NOT NULL,         -- 'NBA' or 'BAA' (BAA = NBA's precursor, pre-1949)
    is_copy           INTEGER NOT NULL,      -- 0 = primary row for this game, 1 = the mirrored/opponent row
    season            INTEGER NOT NULL,      -- season-ending year, e.g. 1996 means the 1995-96 season
    game_date         TEXT NOT NULL,         -- ISO date YYYY-MM-DD
    season_game_num   INTEGER,               -- this team's game number within its season
    is_playoffs       INTEGER NOT NULL,      -- 0 = regular season, 1 = playoffs
    team_id           TEXT NOT NULL,         -- historical team abbreviation (changes on relocation/rename)
    team_name         TEXT NOT NULL,         -- franchise nickname at the time (e.g. 'Lakers')
    team_pts          INTEGER NOT NULL,
    team_elo_pre      REAL,                  -- team's Elo rating entering the game
    team_elo_post     REAL,                  -- team's Elo rating after the game
    win_equiv         REAL,                  -- Elo-implied 82-game win total at this rating
    opp_team_id       TEXT NOT NULL,
    opp_team_name     TEXT NOT NULL,
    opp_pts           INTEGER NOT NULL,
    opp_elo_pre       REAL,
    opp_elo_post      REAL,
    location          TEXT,                  -- 'H' home, 'A' away, 'N' neutral court
    result            TEXT NOT NULL,         -- 'W' or 'L' for team_id
    forecast          REAL,                  -- FiveThirtyEight's pre-game win probability for team_id
    notes             TEXT
);

CREATE INDEX idx_games_team_season ON games(team_id, season);
CREATE INDEX idx_games_fran_season ON games(team_name, season);
CREATE INDEX idx_games_season      ON games(season);
CREATE INDEX idx_games_date        ON games(game_date);
CREATE INDEX idx_games_game_id     ON games(game_id);

-- Convenience view: one row per real game (no duplicate perspective row),
-- home team framed as "team", away team framed as "opp".
CREATE VIEW games_unique AS
SELECT * FROM games WHERE is_copy = 0;

-- Distinct team identities seen in the data, with the span of seasons
-- each (team_id, team_name) combination appeared in. A single franchise
-- can have multiple team_ids/team_names over time (relocations, renames).
CREATE VIEW teams AS
SELECT team_id,
       team_name,
       MIN(season) AS first_season,
       MAX(season) AS last_season,
       COUNT(*)    AS games_played
FROM games
GROUP BY team_id, team_name
ORDER BY team_name, first_season;
"""


def to_int(v):
    return int(v) if v not in (None, "") else None


def to_float(v):
    return float(v) if v not in (None, "") else None


def iso_date(mmddyyyy: str) -> str:
    m, d, y = mmddyyyy.split("/")
    return f"{y}-{int(m):02d}-{int(d):02d}"


def main():
    ensure_source_csv()
    DB.parent.mkdir(parents=True, exist_ok=True)
    if DB.exists():
        DB.unlink()

    conn = sqlite3.connect(DB)
    conn.executescript(SCHEMA)

    with SRC.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        batch = []
        total = 0
        for row in reader:
            batch.append((
                None,
                to_int(row["gameorder"]),
                row["game_id"],
                row["lg_id"],
                to_int(row["_iscopy"]),
                to_int(row["year_id"]),
                iso_date(row["date_game"]),
                to_int(row["seasongame"]),
                to_int(row["is_playoffs"]),
                row["team_id"],
                row["fran_id"],
                to_int(row["pts"]),
                to_float(row["elo_i"]),
                to_float(row["elo_n"]),
                to_float(row["win_equiv"]),
                row["opp_id"],
                row["opp_fran"],
                to_int(row["opp_pts"]),
                to_float(row["opp_elo_i"]),
                to_float(row["opp_elo_n"]),
                row["game_location"],
                row["game_result"],
                to_float(row["forecast"]),
                row["notes"] or None,
            ))
            if len(batch) >= 5000:
                conn.executemany(
                    "INSERT INTO games VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    batch,
                )
                total += len(batch)
                batch.clear()
        if batch:
            conn.executemany(
                "INSERT INTO games VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                batch,
            )
            total += len(batch)

    conn.commit()

    n_games = conn.execute("SELECT COUNT(*) FROM games").fetchone()[0]
    n_unique = conn.execute("SELECT COUNT(*) FROM games_unique").fetchone()[0]
    n_teams = conn.execute("SELECT COUNT(*) FROM teams").fetchone()[0]
    seasons = conn.execute("SELECT MIN(season), MAX(season) FROM games").fetchone()
    conn.close()

    print(f"inserted rows: {total}")
    print(f"games table rows: {n_games}, unique games (games_unique): {n_unique}")
    print(f"distinct (team_id, team_name) identities: {n_teams}")
    print(f"season range: {seasons[0]}-{seasons[1]}")
    print(f"db file: {DB} ({DB.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
