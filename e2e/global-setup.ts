import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ensureFixture } from "./setup";

export const STATE_PATH = path.join(process.cwd(), "e2e", ".state.json");

export default async function globalSetup(): Promise<void> {
  const fixture = await ensureFixture();
  mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(fixture, null, 2));
}
