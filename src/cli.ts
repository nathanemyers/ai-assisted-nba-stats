// Minimal REPL: type an NBA question, get an answer reasoned out against
// the local SQLite database by a local Ollama model.

import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type { Message } from "ollama";
import { ask, buildSystemPrompt, MODEL } from "./agent.js";

async function main() {
  console.log(`ai-assisted-nba-stats - model: ${MODEL}`);
  console.log('Ask a question about NBA history (1946-47 through 2014-15). Type "/reset" to clear context, "/exit" to quit.\n');

  const history: Message[] = [{ role: "system", content: buildSystemPrompt() }];
  const rl = readline.createInterface({ input: stdin, output: stdout });

  while (true) {
    const question = (await rl.question("> ")).trim();

    if (!question) continue;
    if (question === "/exit" || question === "/quit") break;
    if (question === "/reset") {
      history.length = 1; // keep the system prompt, drop everything else
      console.log("(conversation reset)\n");
      continue;
    }

    history.push({ role: "user", content: question });

    try {
      const answer = await ask(history);
      console.log(`\n${answer}\n`);
    } catch (err) {
      console.error(
        "\nSomething went wrong talking to Ollama. Is `ollama serve` running, and have you pulled the model " +
          `(${MODEL})? Error:`,
        err instanceof Error ? err.message : err,
        "\n"
      );
      history.pop(); // don't leave a dangling user turn with no reply
    }
  }

  rl.close();
}

main();
