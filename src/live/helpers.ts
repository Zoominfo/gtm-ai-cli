import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe } from 'vitest';

// The live suite drives the *built* CLI as a subprocess and asserts on its JSON output —
// the same path a user exercises. It reuses the `gtm auth login` OAuth session on disk.
const CREDENTIALS_PATH = join(homedir(), '.config', 'gtm-ai', 'credentials');

export function loggedIn(): boolean {
  return existsSync(CREDENTIALS_PATH);
}

// How to invoke the CLI. Default runs from source via bun; CI/local can point at the built
// JS with GTM_CLI_CMD="node dist/js/index.js".
const CLI_CMD = process.env.GTM_CLI_CMD ?? 'bun run src/index.ts';

export interface CliResult {
  status: number;
  stdout: string;
  stderr: string;
}

export function runCli(args: string[], timeoutMs = 60_000): CliResult {
  const parts = CLI_CMD.split(' ').filter(Boolean);
  const cmd = parts[0] ?? 'bun';
  const base = parts.slice(1);
  const res = spawnSync(cmd, [...base, ...args], { encoding: 'utf8', timeout: timeoutMs });
  return { status: res.status ?? 1, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

export interface JsonResult {
  status: number;
  data: unknown;
  raw: CliResult;
}

export function runJson(args: string[], timeoutMs = 60_000): JsonResult {
  const raw = runCli([...args, '--format', 'json'], timeoutMs);
  let data: unknown = null;
  try {
    data = JSON.parse(raw.stdout);
  } catch {
    data = null;
  }
  return { status: raw.status, data, raw };
}

// Best-effort: pull the first array-of-objects out of a (possibly nested) response envelope.
// Live responses vary in shape, so the suite stays tolerant rather than asserting exact keys.
export function records(data: unknown): Record<string, unknown>[] {
  const find = (obj: unknown, depth: number): Record<string, unknown>[] | null => {
    if (Array.isArray(obj) && obj.length > 0 && typeof obj[0] === 'object') {
      return obj as Record<string, unknown>[];
    }
    if (depth <= 0 || !obj || typeof obj !== 'object') return null;
    for (const v of Object.values(obj as Record<string, unknown>)) {
      const nested = find(v, depth - 1);
      if (nested) return nested;
    }
    return null;
  };
  return find(data, 3) ?? [];
}

// Best-effort: read the first present id-ish key from a record (or its JSON:API attributes).
export function pickField(rec: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  if (!rec) return undefined;
  const attrs = (rec.attributes && typeof rec.attributes === 'object')
    ? (rec.attributes as Record<string, unknown>)
    : {};
  for (const k of keys) {
    const v = rec[k] ?? attrs[k];
    if (v !== undefined && v !== null && v !== '') return String(v);
  }
  return undefined;
}

const SKIP = !loggedIn() || Boolean(process.env.GTM_SKIP_LIVE);

// Skips the whole suite when not logged in (or GTM_SKIP_LIVE=1) — never fails in that case.
export const liveDescribe = SKIP ? describe.skip : describe;

// Write tier mutates real data / consumes credits — opt in with GTM_LIVE_WRITES=1.
export const writesDescribe = (SKIP || !process.env.GTM_LIVE_WRITES) ? describe.skip : describe;
