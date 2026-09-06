import path from "node:path";
import { fileURLToPath } from "node:url";

import { scrape } from "./scrape.js";

function parseArgs(argv: string[]) {
  const args = { years: 10, outDir: "", delayMs: 400, force: false };

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--years":
        args.years = Number(argv[++i]);
        break;
      case "--out":
        args.outDir = argv[++i];
        break;
      case "--delay-ms":
        args.delayMs = Number(argv[++i]);
        break;
      case "--force":
        args.force = true;
        break;
      case "--help":
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`Unknown argument: ${argv[i]}`);
        printHelp();
        process.exit(1);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage: npm run scrape -- [options]

Options:
  --years <n>      How many years back to scrape (default: 10)
  --out <dir>       Output directory (default: ./data)
  --delay-ms <n>    Delay between requests to NBA.com, in ms (default: 400)
  --force           Re-fetch articles even if already saved
  --help            Show this help`);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = args.outDir || path.join(__dirname, "..", "data");

  await scrape({
    years: args.years,
    outDir,
    delayMs: args.delayMs,
    force: args.force,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
