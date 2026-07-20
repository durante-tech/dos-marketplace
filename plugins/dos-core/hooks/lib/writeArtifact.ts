/**
 * writeArtifact.ts — the one blessed API for skill-produced file output
 *
 * Why this exists: PostToolUse hooks only see file writes performed via
 * Claude Code's Write/Edit/MultiEdit tools. Skills that call `fs.writeFileSync`
 * directly from inside their Bun Tools (e.g., `media` saving generated
 * images to `~/Downloads/`) bypass the hook system entirely — no artifact
 * event, no Studio row, Studio knows you spent credits on the generation
 * but not what happened to the result.
 *
 * This helper is the contract: any skill that produces a user-visible
 * output file MUST use writeArtifact(). Sentinel's ValidateFileWrites.ts
 * enforces the rule at commit time.
 *
 * Guarantees:
 *   - Parent directory is created if missing (recursive).
 *   - File is written with the requested mode (default 0o644).
 *   - streamEvent.capture('artifacts', ...) fires on success with the
 *     full CreateArtifactSchema-shaped payload — Studio gets the row
 *     whether the file lives in MEMORY/, ~/Downloads/, /tmp/, anywhere.
 *   - Failure modes are explicit (throws on write failure; returns
 *     degraded event outcome on capture failure, never swallows).
 *
 * Usage:
 *
 *   import { writeArtifact } from '~/.claude/hooks/lib/writeArtifact';
 *   import { homedir } from 'node:os';
 *   import { join } from 'node:path';
 *
 *   const downloads = join(homedir(), 'Downloads');
 *
 *   // Text output (content preview auto-extracted from first 500 chars)
 *   await writeArtifact(join(downloads, 'report.md'), markdown, {
 *     pack: 'Sales',
 *     workflow: 'CreateProposal',
 *     wing: 'altyaa',
 *   });
 *
 *   // Binary output (e.g., generated image bytes)
 *   const bytes = await fetch(imageUrl).then(r => r.arrayBuffer());
 *   await writeArtifact(join(downloads, 'hero.png'), new Uint8Array(bytes), {
 *     pack: 'Media',
 *     workflow: 'GenerateImage',
 *     artifactType: 'image',
 *     title: 'Hero banner v3',
 *   });
 *
 * Exempt paths (scratch / internal) should NOT use this helper — use
 * plain fs for MEMORY/STATE/*, .sentinel/*, tmpdir(), .log/.jsonl files.
 */

import {
  writeFileSync,
  statSync,
  mkdirSync,
  existsSync,
} from 'fs';
import { dirname, basename, extname } from 'path';

import { capture, type CaptureResult } from './streamEvent';
import { classifyArtifactPath } from './vendor/artifact-classifier.ts';

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export interface WriteArtifactOpts {
  /**
   * The skill that produced this artifact. REQUIRED — "" or "unknown" is
   * a design smell; if the caller doesn't know, something is wrong. Used
   * as the `pack` column in Studio's Artifact table.
   */
  pack: string;
  /** Workflow within the pack (e.g., "CreateProposal", "GenerateImage"). */
  workflow?: string;
  /** Semantic type (e.g., "image", "proposal", "markdown"). Inferred from file extension if missing. */
  artifactType?: string;
  /** Display title. Defaults to basename(filePath). */
  title?: string;
  /** First 500 chars of text content. Auto-extracted for string payloads; "" for Buffer/Uint8Array. */
  contentPreview?: string;
  /** Project wing (durante, studio, altyaa, etc.). */
  wing?: string;
  /** DOS session UUID. Defaults to env DOS_SESSION_ID / CLAUDE_SESSION_ID. */
  sessionId?: string;
  /** Claude Code tool_use_id if this artifact is bound to a specific tool call. */
  toolCallId?: string;
  /** Sequence number within a tool call (for batches). Defaults to 1. */
  artifactSeq?: number;
  /** Unix file mode. Defaults to 0o644. */
  mode?: number;
  /**
   * Bypass the artifact event emit entirely. ONLY for test harnesses and
   * the writeArtifact helper's own implementation — never in skill code.
   */
  skipEvent?: boolean;
}

export interface WriteArtifactResult {
  /** Absolute path of the written file. */
  path: string;
  /** File size in bytes post-write. */
  bytes: number;
  /** Outcome of the streamEvent.capture() call. */
  event: CaptureResult;
}

// ─────────────────────────────────────────────────────────────────────
// Heuristics
// ─────────────────────────────────────────────────────────────────────

const EXTENSION_TO_TYPE: Record<string, string> = {
  // images
  '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.webp': 'image',
  '.gif': 'image', '.svg': 'image', '.bmp': 'image', '.ico': 'image',
  // video
  '.mp4': 'video', '.mov': 'video', '.webm': 'video', '.mkv': 'video',
  // audio
  '.mp3': 'audio', '.wav': 'audio', '.flac': 'audio', '.m4a': 'audio',
  '.ogg': 'audio', '.opus': 'audio',
  // documents
  '.pdf': 'document', '.docx': 'document', '.xlsx': 'document', '.pptx': 'document',
  '.odt': 'document', '.rtf': 'document',
  // text & markup
  '.md': 'markdown', '.txt': 'text', '.json': 'json', '.yaml': 'yaml',
  '.yml': 'yaml', '.toml': 'toml', '.html': 'html', '.css': 'css',
  '.xml': 'xml', '.csv': 'csv', '.tsv': 'csv',
  // code
  '.ts': 'source', '.tsx': 'source', '.js': 'source', '.jsx': 'source',
  '.py': 'source', '.rs': 'source', '.go': 'source', '.rb': 'source',
  '.java': 'source', '.c': 'source', '.cpp': 'source', '.h': 'source',
  '.sh': 'source', '.zsh': 'source', '.bash': 'source',
};

function inferArtifactType(filePath: string): string {
  const classified = classifyArtifactPath(filePath);
  if (classified.kind !== 'unknown') return classified.pathAttribution.artifactType;

  const ext = extname(filePath).toLowerCase();
  return EXTENSION_TO_TYPE[ext] ?? 'file';
}

function inferContentPreview(content: string | Uint8Array | Buffer): string {
  if (typeof content === 'string') return content.slice(0, 500);
  return ''; // binary — no meaningful preview
}

function resolveSessionId(opts: WriteArtifactOpts): string {
  return (
    opts.sessionId ??
    process.env.DOS_SESSION_ID ??
    process.env.CLAUDE_SESSION_ID ??
    `pid-${process.pid}`
  );
}

// ─────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────

/**
 * Write a file to disk AND emit an artifact event to Studio.
 *
 * This is the only sanctioned way for skills to produce user-visible
 * output files. Uses fs.writeFileSync (synchronous) for simplicity;
 * fires streamEvent.capture() after the write succeeds.
 *
 * Throws on write failure (no silent corruption). Returns a result
 * even when the capture() event is degraded — the file write itself
 * is the primary contract; the Studio row is best-effort.
 */
export async function writeArtifact(
  filePath: string,
  content: string | Uint8Array | Buffer,
  opts: WriteArtifactOpts,
): Promise<WriteArtifactResult> {
  if (!opts.pack || opts.pack.length === 0) {
    throw new Error(
      'writeArtifact: opts.pack is required. Name the skill that produced this file.',
    );
  }

  // 1. Ensure parent directory exists.
  const parent = dirname(filePath);
  if (!existsSync(parent)) {
    mkdirSync(parent, { recursive: true });
  }

  // 2. Write the file. Typed as any because writeFileSync accepts a union
  //    (string | Buffer | Uint8Array) that TS doesn't cleanly narrow here.
  writeFileSync(filePath, content as Buffer, { mode: opts.mode ?? 0o644 });

  // 3. Stat for size (survives symlinks, zero-length, etc.).
  let bytes = 0;
  try { bytes = statSync(filePath).size; } catch { /* best-effort */ }

  // 4. Emit artifact event unless explicitly bypassed.
  let event: CaptureResult = { outcome: 'degraded', reason: 'skipEvent' };
  if (!opts.skipEvent) {
    const sessionId = resolveSessionId(opts);
    const artifactSeq = opts.artifactSeq ?? 1;
    const toolCallId =
      opts.toolCallId ??
      `${opts.pack.toLowerCase()}-${sessionId}-${Date.now()}`;
    const payload = {
      pack: opts.pack,
      workflow: opts.workflow,
      artifactType: opts.artifactType ?? inferArtifactType(filePath),
      title: opts.title ?? basename(filePath),
      filePath,
      contentPreview: opts.contentPreview ?? inferContentPreview(content),
      wing: opts.wing,
      sessionId,
      toolCallId,
      artifactSeq,
      producedAt: new Date().toISOString(),
    };
    try {
      event = await capture('artifacts', payload, {
        sessionId,
        toolCallId,
        keyFields: { sessionId, toolCallId, artifactSeq },
      });
    } catch (err) {
      // capture() should be non-throwing per streamEvent design, but be
      // defensive — never block the caller on an event-emit failure.
      event = {
        outcome: 'dropped',
        reason: `capture-threw:${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  return { path: filePath, bytes, event };
}

/**
 * Convenience: write a text artifact (string content). Same as writeArtifact
 * with a string payload; here just for explicit call-site readability.
 */
export async function writeTextArtifact(
  filePath: string,
  text: string,
  opts: WriteArtifactOpts,
): Promise<WriteArtifactResult> {
  return writeArtifact(filePath, text, opts);
}

/**
 * Convenience: write a binary artifact (Uint8Array / Buffer content).
 */
export async function writeBinaryArtifact(
  filePath: string,
  bytes: Uint8Array | Buffer,
  opts: WriteArtifactOpts,
): Promise<WriteArtifactResult> {
  return writeArtifact(filePath, bytes, opts);
}
