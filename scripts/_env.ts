/**
 * Minimal .env loader for standalone scripts (Next loads env itself at runtime).
 * Reads .env.local then .env, without adding a dotenv dependency.
 * Existing process.env values win.
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

function parseAndApply(file: string) {
  const text = readFileSync(file, "utf8");
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (key in process.env) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

export function loadScriptEnv() {
  for (const name of [".env.local", ".env"]) {
    const file = resolve(process.cwd(), name);
    if (existsSync(file)) parseAndApply(file);
  }
}
