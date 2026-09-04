import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Minimal .env loader so tests see the same DATABASE_URL / AUTH_SECRET /
 * AUTOMATION_SECRET the app uses, without adding a dotenv dependency.
 * Never overrides a variable the environment already provides.
 */
function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

// .env.test takes priority (e.g. a separate DATABASE_URL for integration
// tests); .env fills in anything it doesn't set.
loadEnvFile(resolve(process.cwd(), ".env.test"));
loadEnvFile(resolve(process.cwd(), ".env"));

process.env.AUTH_SECRET ??= "test-only-secret-do-not-use-in-prod";
process.env.AUTOMATION_SECRET ??= "test-only-automation-secret";
