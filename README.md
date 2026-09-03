# ai-assisted-nba-stats

A sandbox repo for exploring local model usage with local data: a local
Ollama model answers NBA questions by writing and running SQL against a
local SQLite database, using Ollama's tool-calling (function-calling) API.

```
you ask a question
      -> model (via Ollama, running locally) decides to call query_database(sql)
      -> code runs the SQL against data/nba.db and returns the rows
      -> model reads the rows and writes an answer (or calls the tool again)
```

## The data

`data/nba.db.gz` is a prebuilt SQLite database (auto-decompressed to
`data/nba.db` by `npm install`, via the `postinstall` script) built from
FiveThirtyEight's
["NBA All Elo"](https://github.com/fivethirtyeight/data/tree/master/nba-elo)
dataset: every NBA/BAA game, **1946-47 through 2014-15** (FiveThirtyEight
never extended this file past 2015, so more recent seasons aren't in there
— ask about a season in that window).

Schema (see `build_db.py` for full column comments):

- **`games`** — one row per team per game (so each real game is two rows,
  one per team's perspective). Columns include `season`, `game_date`,
  `team_id` / `team_name`, `team_pts`, `opp_id` / `opp_team_name`,
  `opp_pts`, `result` (`W`/`L`), `is_playoffs`, Elo ratings before/after
  the game, and FiveThirtyEight's pre-game win `forecast`.
- **`games_unique`** — a view: the same table filtered to one row per real
  game (`is_copy = 0`).
- **`teams`** — a view: every distinct `(team_id, team_name)` a franchise
  has used, with the season range each was active (franchises relocate and
  rename — e.g. the Lakers were `MNL` in Minneapolis before `LAL`).

`season` is the season-**ending** year (`season = 1996` is the 1995-96
season).

Want to rebuild it yourself, or point at a different dataset? `python3
build_db.py` re-downloads the source CSV and regenerates `data/nba.db`
(needs Python 3 with no extra packages).

## Setup

1. **Install [Ollama](https://ollama.com)** and make sure it's running
   (`ollama serve`, or just open the app).
2. **Pull a tool-calling-capable model.** Not every model supports Ollama's
   tool-calling API — this has been tested against:
   ```
   ollama pull llama3.1
   ```
   Other options that support tools: `qwen2.5`, `mistral-nemo`,
   `firefunction-v2`. Set `OLLAMA_MODEL=<name>` (see below) to use a
   different one.
3. **Install dependencies**:
   ```
   npm install
   ```
4. **Run it**:
   ```
   npm start
   ```

### Config (optional environment variables)

- `OLLAMA_MODEL` — model name to use (default `llama3.1`)
- `OLLAMA_HOST` — Ollama server URL (default `http://127.0.0.1:11434`)

## Example questions to try

- "What was the Chicago Bulls' record in the 1995-96 season?"
- "Which team had the highest Elo rating ever, and when?"
- "How many championships-era games did the Lakers play at home vs away in the 1980s?" *(there's no "championship" flag — see how the model handles a question the schema can't fully answer)*
- "List the 5 largest margins of victory in playoff games."
- "Has any team won 70+ games in a regular season? Which ones, and how many times?"

## How it's built

- `src/db.ts` — opens `data/nba.db` read-only via `better-sqlite3` and
  exposes `getSchema()` and `runQuery()`. `runQuery` only allows a single
  `SELECT`/`WITH` statement and caps results at 200 rows — a basic
  heuristic to keep a model from doing anything destructive, not hardened
  security. Fine for this local single-user sandbox; don't reuse as-is
  against an untrusted database.
- `src/tools.ts` — the tool definitions (`get_schema`, `query_database`)
  handed to Ollama, and the dispatcher that runs them.
- `src/agent.ts` — the tool-calling loop: send the conversation + tools to
  Ollama, execute whatever it asks for, feed results back, repeat until it
  answers in plain text (capped at 8 round-trips per question).
- `src/cli.ts` — a REPL. `/reset` clears the conversation, `/exit` quits.

## Notes / things worth poking at

- Try swapping models (`OLLAMA_MODEL=qwen2.5 npm start`) and compare how
  reliably each one writes correct SQL and calls tools instead of
  guessing.
- The system prompt (`buildSystemPrompt` in `src/agent.ts`) injects the
  live schema every run — if you change the schema, the model's prompt
  updates automatically.
- The two-rows-per-game shape in `games` is a good test of whether a model
  actually reads the schema notes rather than assuming a more "normal"
  one-row-per-game table.
