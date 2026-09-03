// Decompresses data/nba.db.gz -> data/nba.db if the plain .db isn't there
// yet. The db is shipped gzipped (~9MB vs ~30MB) to keep the repo small;
// this runs automatically on `npm install` via the "postinstall" script.
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { createGunzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
const dbPath = path.join(dataDir, "nba.db");
const gzPath = path.join(dataDir, "nba.db.gz");

if (existsSync(dbPath)) {
  process.exit(0);
}

if (!existsSync(gzPath)) {
  console.error(`Neither ${dbPath} nor ${gzPath} exist. Run "npm run build-db" to build it from source.`);
  process.exit(1);
}

await pipeline(createReadStream(gzPath), createGunzip(), createWriteStream(dbPath));
console.log("Decompressed data/nba.db.gz -> data/nba.db");
