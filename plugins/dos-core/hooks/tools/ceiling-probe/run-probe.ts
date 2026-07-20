#!/usr/bin/env bun
/**
 * run-probe.ts — empirical PostToolUse per-matcher hook-execution ceiling probe.
 *
 * WHY THIS EXISTS
 * ---------------
 * RFC-0110 (2026-05-17) added a subprocess fan-out inside
 * StreamEventDispatcher.hook.ts to work around a BELIEVED "5 hooks per matcher"
 * runtime ceiling in Claude Code — a ceiling that was never measured, only
 * inferred from a dropped-hook symptom. This harness measures it empirically so
 * the fan-out decision rests on evidence, not folklore.
 *
 * METHOD
 * ------
 * Register a single PostToolUse matcher group "Edit" containing N sentinel
 * hooks (default 12). Each sentinel is a UNIQUE shell command that appends a
 * unique marker (p01..pNN) to a shared counter file. Uniqueness matters: the
 * platform deduplicates identical command hooks by command string, so twelve
 * copies of the same command would collapse to one and defeat the measurement.
 * Then drive exactly one Edit tool call via `claude -p` and count how many
 * DISTINCT markers landed in the counter. If all N fired, there is no ceiling
 * at N. If only V < N fired (consistently across trials), V is the ceiling.
 *
 * ISOLATION
 * ---------
 * Each trial runs in a fresh throwaway temp dir (mkdtemp under os.tmpdir()), so
 * no project-level `.claude/settings.json` contributes competing Edit hooks.
 * The user-level DOS hooks (~/.claude/settings.json) still load, but they never
 * write our counter, so they cannot inflate the count. They COULD in principle
 * steal slots if the ceiling is enforced per-(event) across merged sources
 * rather than per-matcher-group — see README.md "Threats to validity". Kill
 * switches (DOS_STREAM_DISPATCH=off, DOS_FANOUT_DROPPED_HOOKS=off) quiet the
 * heaviest user hooks during the run.
 *
 * OUTPUT
 * ------
 * Per-trial:  trial K: EXECUTED=<distinct>/<N> fired=[...] missing=[...] edited=<yes|no> exit=<code>
 * Verdict:    EXECUTED=<n>/<N> -> CEILING=<none|n>
 *
 * USAGE
 * -----
 *   bun run-probe.ts                       # 2 trials, 12 sentinels, 180s each
 *   bun run-probe.ts --trials 3            # 3 trials
 *   bun run-probe.ts --sentinels 8         # test a lower N
 *   bun run-probe.ts --timeout 120         # per-trial hard timeout (seconds)
 *   bun run-probe.ts --model claude-haiku-4-5-20251001
 *   bun run-probe.ts --keep                # do not delete temp dirs (inspect)
 *   bun run-probe.ts --dry-run             # generate + print settings, DO NOT run claude
 *
 * NOTE ON NESTING: running `claude -p` from inside a Claude Code session can
 * hang for minutes (nested headless CLI). Prefer running this harness from a
 * plain terminal. --dry-run exercises everything up to the claude invocation
 * with zero nesting risk.
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

interface Args {
  trials: number;
  sentinels: number;
  timeoutSec: number;
  model: string;
  keep: boolean;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = {
    trials: 2,
    sentinels: 12,
    timeoutSec: 180,
    model: DEFAULT_MODEL,
    keep: false,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case '--trials': a.trials = Math.max(1, Number(next())); break;
      case '--sentinels': a.sentinels = Math.max(1, Number(next())); break;
      case '--timeout': a.timeoutSec = Math.max(5, Number(next())); break;
      case '--model': a.model = next(); break;
      case '--keep': a.keep = true; break;
      case '--dry-run': a.dryRun = true; break;
      case '--help': case '-h': printHelp(); process.exit(0); break;
      default:
        if (arg.startsWith('--')) { console.error(`unknown flag: ${arg}`); process.exit(2); }
    }
  }
  return a;
}

function printHelp(): void {
  console.log(
    'run-probe.ts — measure PostToolUse per-matcher hook ceiling\n' +
    '  --trials N       trials to run (default 2)\n' +
    '  --sentinels K    sentinel hooks in the Edit group (default 12)\n' +
    '  --timeout SEC    per-trial hard timeout (default 180)\n' +
    '  --model ID       model for claude -p (default ' + DEFAULT_MODEL + ')\n' +
    '  --keep           keep temp dirs for inspection\n' +
    '  --dry-run        generate + print probe-settings.json, do not run claude\n',
  );
}

function tag(i: number): string {
  return 'p' + String(i).padStart(2, '0');
}

/**
 * Build the probe settings object with the concrete counter path baked into
 * every sentinel command. Env expansion inside a --settings file is not
 * relied on: the absolute path is literal.
 */
function buildProbeSettings(counterPath: string, n: number): unknown {
  const hooks = [];
  for (let i = 1; i <= n; i++) {
    // Unique command per sentinel (distinct marker) defeats command-string dedup.
    // Final command Claude runs:  bash -c 'printf "p01\n" >> "/abs/counter.txt"'
    const command = `bash -c 'printf "${tag(i)}\\n" >> "${counterPath}"'`;
    hooks.push({ type: 'command', command });
  }
  return { hooks: { PostToolUse: [{ matcher: 'Edit', hooks }] } };
}

interface TrialResult {
  distinct: number;
  fired: string[];
  missing: string[];
  edited: boolean;
  exit: string;
  conclusive: boolean;
}

function countMarkers(counterPath: string, n: number): { distinct: number; fired: string[]; missing: string[] } {
  const all = new Set<string>();
  if (existsSync(counterPath)) {
    const raw = readFileSync(counterPath, 'utf-8');
    for (const token of raw.split(/\s+/)) {
      if (/^p\d{2}$/.test(token)) all.add(token);
    }
  }
  const fired: string[] = [];
  const missing: string[] = [];
  for (let i = 1; i <= n; i++) {
    const t = tag(i);
    (all.has(t) ? fired : missing).push(t);
  }
  return { distinct: fired.length, fired, missing };
}

function runClaude(cwd: string, settingsPath: string, targetPath: string, model: string, timeoutSec: number): Promise<string> {
  return new Promise((resolve) => {
    const prompt = `Use the Edit tool to replace the word alpha with beta in ${targetPath}. Perform exactly that one edit, then stop.`;
    const args = [
      '-p', prompt,
      '--settings', settingsPath,
      '--allowedTools', 'Edit',
      '--permission-mode', 'acceptEdits',
      '--model', model,
    ];
    let settled = false;
    const done = (code: string) => { if (!settled) { settled = true; resolve(code); } };
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn('claude', args, {
        cwd,
        env: { ...process.env, DOS_STREAM_DISPATCH: 'off', DOS_FANOUT_DROPPED_HOOKS: 'off' },
        stdio: ['ignore', 'ignore', 'ignore'],
      });
    } catch (err) {
      done('spawn-error:' + (err instanceof Error ? err.message : String(err)));
      return;
    }
    const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* ignore */ } done('timeout'); }, timeoutSec * 1000);
    child.on('close', (code) => { clearTimeout(timer); done(String(code ?? 'null')); });
    child.on('error', (err) => { clearTimeout(timer); done('error:' + err.message); });
  });
}

async function runTrial(k: number, args: Args): Promise<TrialResult> {
  const dir = mkdtempSync(join(tmpdir(), 'ceiling-probe-'));
  const counterPath = join(dir, 'counter.txt');
  const targetPath = join(dir, 'target.txt');
  const settingsPath = join(dir, 'probe-settings.json');
  writeFileSync(counterPath, '');
  writeFileSync(targetPath, 'The alpha value is here.\n');
  writeFileSync(settingsPath, JSON.stringify(buildProbeSettings(counterPath, args.sentinels), null, 2));

  const exit = await runClaude(dir, settingsPath, targetPath, args.model, args.timeoutSec);
  const { distinct, fired, missing } = countMarkers(counterPath, args.sentinels);
  const edited = existsSync(targetPath) && readFileSync(targetPath, 'utf-8').includes('beta');
  // A trial is only conclusive if the Edit tool actually ran (else zero hooks
  // fired for reasons unrelated to any ceiling).
  const conclusive = edited || distinct > 0;

  console.log(
    `trial ${k}: EXECUTED=${distinct}/${args.sentinels} ` +
    `fired=[${fired.join(',')}] missing=[${missing.join(',')}] ` +
    `edited=${edited ? 'yes' : 'no'} exit=${exit}` +
    (conclusive ? '' : ' (INCONCLUSIVE: Edit did not run)'),
  );

  if (!args.keep) { try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ } }
  else console.log(`  kept: ${dir}`);

  return { distinct, fired, missing, edited, exit, conclusive };
}

function verdict(results: TrialResult[], n: number): string {
  const conclusive = results.filter((r) => r.conclusive);
  if (conclusive.length === 0) {
    return `EXECUTED=?/${n} -> CEILING=inconclusive (no trial ran the Edit tool; run from a plain terminal, not nested inside Claude Code)`;
  }
  const values = [...new Set(conclusive.map((r) => r.distinct))];
  const max = Math.max(...conclusive.map((r) => r.distinct));
  if (values.length > 1) {
    return `EXECUTED=${max}/${n} -> CEILING=indeterminate (trials disagreed: ${values.sort((a, b) => a - b).join(',')}; add --trials)`;
  }
  const v = values[0];
  return v >= n
    ? `EXECUTED=${v}/${n} -> CEILING=none`
    : `EXECUTED=${v}/${n} -> CEILING=${v}`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.dryRun) {
    const dir = mkdtempSync(join(tmpdir(), 'ceiling-probe-dry-'));
    const counterPath = join(dir, 'counter.txt');
    const targetPath = join(dir, 'target.txt');
    const settingsPath = join(dir, 'probe-settings.json');
    const settings = buildProbeSettings(counterPath, args.sentinels);
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    console.log(`--dry-run: generated ${args.sentinels}-sentinel probe settings`);
    console.log(`settings: ${settingsPath}`);
    console.log(`counter:  ${counterPath}`);
    console.log(`target:   ${targetPath}`);
    console.log('---- probe-settings.json ----');
    console.log(JSON.stringify(settings, null, 2));
    console.log('---- claude command ----');
    console.log(
      `claude -p "Use the Edit tool to replace the word alpha with beta in ${targetPath}. ` +
      `Perform exactly that one edit, then stop." ` +
      `--settings ${settingsPath} --allowedTools Edit --permission-mode acceptEdits --model ${args.model}`,
    );
    if (!args.keep) { try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ } }
    return;
  }

  console.log(`ceiling-probe: ${args.trials} trial(s), ${args.sentinels} sentinels, ${args.timeoutSec}s timeout, model ${args.model}`);
  const results: TrialResult[] = [];
  for (let k = 1; k <= args.trials; k++) {
    results.push(await runTrial(k, args));
  }
  console.log(verdict(results, args.sentinels));
}

main().catch((err) => {
  console.error('run-probe fatal:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
