// Thin, deliberately restricted wrapper around the local SQLite database.
//
// This is a sandbox project: the "safety" here (SELECT-only, single
// statement, row cap) is a basic heuristic to keep a locally-running LLM
// from doing anything destructive to the file, not a hardened security
// boundary. Fine for a single-user local demo; do not reuse this as-is
// against an untrusted database or a multi-user service.

import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "..", "data", "nba.db");

const MAX_ROWS = 200;

const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
}

export interface QueryError {
  error: string;
}

/** Returns the CREATE TABLE / CREATE VIEW statements that define the schema. */
export function getSchema(): string {
  const rows = db
    .prepare(
      `SELECT sql FROM sqlite_master
       WHERE sql IS NOT NULL AND type IN ('table', 'view')
       ORDER BY type DESC, name`
    )
    .all() as { sql: string }[];
  return rows.map((r) => r.sql).join(";\n\n");
}

/**
 * Runs a single read-only SQL query and returns up to MAX_ROWS rows.
 * Rejects anything that isn't a single SELECT/WITH statement.
 */
export function runQuery(sql: string): QueryResult | QueryError {
  const trimmed = sql.trim().replace(/;+\s*$/, "");

  if (trimmed.includes(";")) {
    return { error: "Only a single SQL statement is allowed per call." };
  }

  const firstWord = trimmed.split(/\s+/)[0]?.toUpperCase();
  if (firstWord !== "SELECT" && firstWord !== "WITH") {
    return {
      error:
        "Only read-only SELECT (or WITH ... SELECT) queries are allowed. " +
        `Got a statement starting with "${firstWord ?? ""}".`,
    };
  }

  const forbidden = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|ATTACH|DETACH|PRAGMA|VACUUM|REPLACE)\b/i;
  if (forbidden.test(trimmed)) {
    return { error: "That statement contains a disallowed keyword." };
  }

  try {
    const stmt = db.prepare(trimmed);
    const allRows = stmt.all() as Record<string, unknown>[];
    const truncated = allRows.length > MAX_ROWS;
    const rows = truncated ? allRows.slice(0, MAX_ROWS) : allRows;
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { columns, rows, rowCount: allRows.length, truncated };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
