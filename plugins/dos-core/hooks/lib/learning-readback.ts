/**
 * learning-readback.ts - Close the learning loop by reading learnings back into context
 *
 * PURPOSE:
 * The DOS learning system writes extensively (8,400+ files across 5 hooks) but
 * previously had no readback mechanism. This library provides fast, compact
 * readers that LoadContext.hook.ts calls at session start to inject accumulated
 * knowledge back into the model's context.
 *
 * FUNCTIONS:
 * - loadLearningDigest()  — Recent learning signals (ALGORITHM + SYSTEM)
 * - loadWisdomFrames()    — Crystallized behavioral patterns (WISDOM/FRAMES)
 * - loadFailurePatterns() — Recent failure insights (FAILURES)
 * - loadSignalTrends()    — Performance metrics from learning-cache.sh
 *
 * PERFORMANCE:
 * Each function reads a small number of pre-existing files (<10).
 * Total budget: <100ms combined. All reads are synchronous for simplicity.
 *
 * OUTPUT:
 * Each function returns a compact string (<500 chars) or null if no data.
 * Combined output stays under 2000 chars for context injection.
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { getMemorySubdir } from './paths';

/**
 * Recency weight tiers for learning signals.
 * Recent corrections matter more — they represent active behavioral adjustments.
 */
function getRecencyTag(fileDate: Date): string {
  const ageMs = Date.now() - fileDate.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);

  if (ageHours < 24) return '🔴'; // Last 24h — highest priority
  if (ageHours < 72) return '🟡'; // Last 3 days — medium priority
  if (ageHours < 168) return '⚪'; // Last 7 days — fading
  return ''; // Older — no tag (lowest priority)
}

/**
 * Parse date from learning filename.
 * Formats: "YYYY-MM-DD-HHMMSS_..." or "YYYY-MM-DD_HHMM_..."
 */
function parseDateFromFilename(filename: string): Date | null {
  const match = filename.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
  if (!match) return null;
  return new Date(`${match[1]}-${match[2]}-${match[3]}`);
}

/**
 * Read the N most recent learning files from a LEARNING subdirectory.
 * Files are named YYYY-MM-DD-HHMMSS_LEARNING_*.md with YAML frontmatter.
 * Extracts the **Feedback:** line and rating for compact display.
 * Applies recency tags — recent corrections get visual priority markers.
 */
function getRecentLearnings(baseDir: string, subdir: string, count: number): string[] {
  const insights: string[] = [];
  const learningDir = join(getMemorySubdir('LEARNING'), subdir);
  if (!existsSync(learningDir)) return insights;

  try {
    // Get month dirs sorted descending (newest first)
    const months = readdirSync(learningDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && /^\d{4}-\d{2}$/.test(d.name))
      .map(d => d.name)
      .sort()
      .reverse();

    for (const month of months) {
      if (insights.length >= count) break;
      const monthPath = join(learningDir, month);

      try {
        const files = readdirSync(monthPath)
          .filter(f => f.endsWith('.md'))
          .sort()
          .reverse();

        for (const file of files) {
          if (insights.length >= count) break;
          try {
            const content = readFileSync(join(monthPath, file), 'utf-8');
            const feedbackMatch = content.match(/\*\*Feedback:\*\*\s*(.+)/);
            const ratingMatch = content.match(/rating:\s*(\d+)/);
            if (feedbackMatch) {
              const rating = ratingMatch ? ratingMatch[1] : '?';
              const feedback = feedbackMatch[1].substring(0, 80);
              const fileDate = parseDateFromFilename(file);
              const tag = fileDate ? getRecencyTag(fileDate) : '';
              const prefix = tag ? `${tag} ` : '';
              insights.push(`${prefix}[${rating}/10] ${feedback}`);
            }
          } catch { /* skip unreadable files */ }
        }
      } catch { /* skip unreadable months */ }
    }
  } catch { /* skip if dir scan fails */ }

  return insights;
}

/**
 * Load recent learning signals from ALGORITHM and SYSTEM directories.
 * Returns the 3 most recent from each, formatted as a compact bullet list.
 */
export function loadLearningDigest(dosDir: string): string | null {
  const algorithmInsights = getRecentLearnings(dosDir, 'ALGORITHM', 3);
  const systemInsights = getRecentLearnings(dosDir, 'SYSTEM', 3);

  if (algorithmInsights.length === 0 && systemInsights.length === 0) return null;

  const parts: string[] = ['**Recent Learning Signals:**'];

  if (algorithmInsights.length > 0) {
    parts.push('*Algorithm:*');
    algorithmInsights.forEach(i => parts.push(`  ${i}`));
  }
  if (systemInsights.length > 0) {
    parts.push('*System:*');
    systemInsights.forEach(i => parts.push(`  ${i}`));
  }

  return parts.join('\n');
}

/**
 * Load recent algorithm reflections from the JSONL log.
 * Each entry has reflection_q1 ("what should I have done differently"),
 * reflection_q2 ("what would a smarter algorithm do"), and task_description.
 * Returns the 5 most recent Q1 answers as actionable behavioral directives.
 */
const MAX_REFLECTION_LENGTH = 120;
const REFLECTION_COUNT = 5;

export function loadAlgorithmReflections(dosDir: string): string | null {
  const reflPath = join(getMemorySubdir('LEARNING'), 'REFLECTIONS', 'algorithm-reflections.jsonl');
  if (!existsSync(reflPath)) return null;

  try {
    // Read only the last N lines efficiently via tail
    const raw = execFileSync('tail', ['-n', String(REFLECTION_COUNT), reflPath], { encoding: 'utf-8', timeout: 3000 });
    const lines = raw.trim().split('\n').filter(Boolean);
    if (lines.length === 0) return null;

    const directives: string[] = [];

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        const q1 = entry.reflection_q1;
        if (q1) {
          const truncated = q1.length > MAX_REFLECTION_LENGTH
            ? q1.substring(0, MAX_REFLECTION_LENGTH - 3) + '...'
            : q1;
          // Add recency tag if timestamp available
          let tag = '';
          if (entry.timestamp) {
            const entryDate = new Date(entry.timestamp);
            tag = getRecencyTag(entryDate);
          }
          const prefix = tag ? `${tag} ` : '';
          directives.push(`- ${prefix}${truncated}`);
        }
      } catch { /* skip malformed lines */ }
    }

    if (directives.length === 0) return null;

    return `**Algorithm Self-Corrections (apply these actively):**\n${directives.join('\n')}`;
  } catch {
    return null;
  }
}

/**
 * Load recent failure pattern insights.
 * Reads the 5 most recent FAILURES directories and extracts the CONTEXT.md
 * first paragraph for a compact summary of what went wrong.
 */
export function loadFailurePatterns(dosDir: string): string | null {
  // Failure records are written to the GLOBAL corpus while getMemorySubdir resolves
  // project-first — a project LEARNING dir without FAILURES/ must not hide the global
  // history. Union both roots (project-first, then dosDir-global), newest month first.
  const failureRoots = [
    join(getMemorySubdir('LEARNING'), 'FAILURES'),
    join(dosDir, 'MEMORY', 'LEARNING', 'FAILURES'),
  ].filter((dir, i, arr) => arr.indexOf(dir) === i && existsSync(dir));
  if (failureRoots.length === 0) return null;

  const patterns: string[] = [];

  try {
    // Month dirs across all roots, sorted descending; remember each month's root
    const monthEntries: Array<{ month: string; root: string }> = [];
    for (const root of failureRoots) {
      for (const d of readdirSync(root, { withFileTypes: true })) {
        if (d.isDirectory() && /^\d{4}-\d{2}$/.test(d.name))
          monthEntries.push({ month: d.name, root });
      }
    }
    monthEntries.sort((a, b) => b.month.localeCompare(a.month));

    for (const { month, root } of monthEntries) {
      if (patterns.length >= 5) break;
      const monthPath = join(root, month);

      try {
        // Failure dirs are named timestamp_slug
        const dirs = readdirSync(monthPath, { withFileTypes: true })
          .filter(d => d.isDirectory())
          .map(d => d.name)
          .sort()
          .reverse();

        for (const dir of dirs) {
          if (patterns.length >= 5) break;
          const contextPath = join(monthPath, dir, 'CONTEXT.md');
          if (!existsSync(contextPath)) continue;

          try {
            // Extract slug as human-readable failure description
            const slug = dir.replace(/^\d{4}-\d{2}-\d{2}-\d{6}_/, '').replace(/-/g, ' ');
            // Get date from dir name
            const dateMatch = dir.match(/^(\d{4}-\d{2}-\d{2})/);
            const date = dateMatch ? dateMatch[1] : '';
            const tag = date ? getRecencyTag(new Date(date)) : '';
            const prefix = tag ? `${tag} ` : '';
            patterns.push(`${prefix}[${date}] ${slug.substring(0, 70)}`);
          } catch { /* skip unreadable */ }
        }
      } catch { /* skip unreadable months */ }
    }
  } catch { /* skip if dir scan fails */ }

  if (patterns.length === 0) return null;

  return `**Recent Failure Patterns — ACTIVE CONSTRAINTS:**\nWhen you encounter a situation similar to these failures, you MUST change your approach. Do not repeat the pattern — choose a different strategy.\n${patterns.map(p => `  ${p}`).join('\n')}`;
}

/**
 * Load performance signal trends from the pre-computed learning-cache.sh.
 * Extracts numeric averages and trend direction for a compact status line.
 */
export function loadSignalTrends(dosDir: string): string | null {
  const cachePath = join(dosDir, 'MEMORY', 'STATE', 'learning-cache.sh');
  if (!existsSync(cachePath)) return null;

  try {
    const content = readFileSync(cachePath, 'utf-8');

    // Parse shell variable assignments (key='value' or key=value)
    const vars: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const match = line.match(/^(\w+)='?([^']*)'?$/);
      if (match) vars[match[1]] = match[2];
    }

    const todayAvg = vars.today_avg || '?';
    const weekAvg = vars.week_avg || '?';
    const monthAvg = vars.month_avg || '?';
    const trend = vars.trend || 'stable';
    const totalCount = vars.total_count || '?';

    const trendEmoji = trend === 'up' ? 'trending up' : trend === 'down' ? 'trending down' : 'stable';

    return `**Performance Signals:** Today: ${todayAvg}/10 | Week: ${weekAvg}/10 | Month: ${monthAvg}/10 | Trend: ${trendEmoji} | Total signals: ${totalCount}`;
  } catch {
    return null;
  }
}
