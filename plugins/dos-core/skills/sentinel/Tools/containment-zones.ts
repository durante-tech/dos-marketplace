/**
 * @pack Sentinel
 * @workflow containment-zones
 *
 * containment-zones.ts — RFC-0044 W-2.64
 *
 * Single source of truth for DOS Containment & Distribution zone declarations.
 * Imported by ContainmentGuard.hook.ts (prospective) and dos-release-publish.ts
 * (retrospective, future). Spec: Plans/Specs/RFC-0044-dos-containment-and-distribution.md §3.
 *
 * Tracer Bullet scope (RFC-0057 §3): zones declared + match helpers exported.
 * Out-of-scope: dos-release-publish.ts (W-2.63), zone-extending release-secret-scan.ts
 * (W-2.65), public-edition compile (W-2.66) — these consume this module in later sessions.
 */

export interface ContainmentZone {
  name: string;
  patterns: string[]; // glob-ish patterns relative to repo root
  rationale: string;
  releaseAction: 'delete' | 'overlay-template' | 'preserve-readme-only';
}

export const CONTAINMENT_ZONES: ContainmentZone[] = [
  {
    name: 'user-data',
    patterns: [
      'MEMORY/RELATIONSHIP/**',
      'MEMORY/SECURITY/**',
      'Tools/.dos-projects.json',
    ],
    rationale: 'Principal/customer identity, contacts, security events',
    releaseAction: 'delete',
  },
  {
    name: 'config-secrets',
    patterns: [
      'settings.local.json',
      '.env',
      '.env.*',
      '.gateway.env',
      '.vscode/settings.json',
    ],
    rationale: 'API tokens, gateway billing, MCP auth, IDE settings',
    releaseAction: 'delete',
  },
  {
    name: 'runtime-memory',
    patterns: [
      'MEMORY/WORK/**',
      'MEMORY/LEARNING/**',
      'MEMORY/STATE/**',
      'MEMORY/RESEARCH/**',
      'MEMORY/ARTIFACTS/**',
      'MEMORY/VOICE/**',
      'MEMORY/MEMPALACE/**',
      'projects/**',
      'sessions/**',
      'shell-snapshots/**',
      'skills/utilities/DOSUpgrade/State/**',
      'skills/utilities/DOSUpgrade/Logs/**',
    ],
    rationale: 'Operator-local buffer (gitignored) — never copied into public release artifacts',
    releaseAction: 'delete',
  },
  {
    name: 'runtime-archive-keep',
    patterns: ['MEMORY/ARCHIVE/**'],
    rationale: 'Git-tracked canonical evidence — distinct from runtime-memory; ships in releases',
    releaseAction: 'preserve-readme-only',
  },
  {
    name: 'private-skills',
    patterns: [
      'skills/_*/**',
      'Packs/_*/**',
      'Releases/v*/.claude/skills/_*/**',
    ],
    rationale: 'Underscore-prefix is the public-release boundary; private skills never ship',
    releaseAction: 'delete',
  },
  {
    name: 'install-state',
    patterns: [
      'history.jsonl',
      'plugins/**',
      'plugins/installed_plugins.json',
      'plugins/known_marketplaces.json',
    ],
    rationale: 'Claude Code runtime install state — operator-local, varies per machine',
    releaseAction: 'delete',
  },
  {
    name: 'private-infra',
    patterns: [
      'Platform/studio/**',
      'Releases/v*/.claude/PAI/**',
    ],
    rationale: 'Cross-repo private infrastructure',
    releaseAction: 'delete',
  },
  {
    name: 'compiled-dist',
    patterns: [
      'dist/**',
      'build/**',
    ],
    rationale: 'Compiled build output — derived from source, regenerated per build, never authored directly',
    releaseAction: 'delete',
  },
  {
    name: 'test-sources',
    patterns: [
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/__tests__/**',
      '**/Tests/fixtures/**',
    ],
    rationale: 'Repository verification fixtures often contain synthetic paths/secrets and are not runtime payload',
    releaseAction: 'delete',
  },
];

/**
 * Files that legitimately contain identity/secret patterns to detect or document them.
 * Every entry is a TODO — ideal end-state is the minimum set.
 */
export const PATTERN_ALLOWLIST_FILES: string[] = [
  // Files that legitimately contain identity/secret patterns to detect or document them
  'Tools/release-secret-scan.ts',
  'Tools/release-secret-scan.test.ts',
  'Tools/dos-toolchain/containment-zones.ts',
  'Tools/dos-toolchain/containment-zones.test.ts',
  // Pack-evolution moves 2026-05-15 (v0.0.16 wave-2) — capability scripts relocated from Tools/ to Pack homes:
  'Packs/sentinel/src/Tools/release-secret-scan.ts',
  'Packs/sentinel/src/Tools/release-secret-scan.test.ts',
  'Packs/sentinel/src/Tools/containment-zones.ts',
  'Packs/sentinel/src/Tools/containment-zones.test.ts',
  'hooks/ContainmentGuard.hook.ts',
  'Releases/v*/.claude/hooks/ContainmentGuard.hook.ts',
  'Plans/Specs/RFC-0044-dos-containment-and-distribution.md',

  // Dated one-shot migration scripts — historical archaeology, not re-run
  'Tools/quarantine-legacy-dlq.ts',
  'Tools/regen-legacy-keys.ts',
  'Tools/topic-seam-migration-2026-05-03.ts',
  'Tools/rfc-status-backfill-2026-05-03.ts',
  'Tools/migrate-env-loader-duplicates.ts',
  'Tools/migrate-studio-client.ts',

  // Test harnesses — fixtures use literal paths by design
  'Tools/test-rfc-0020-phase0.ts',
  'Tools/dos-release-compile.test.ts',
  'Tools/lineage.test.ts',
  'Tools/dos-release-publish.test.ts',
  'Tools/dos-toolchain/eject-roundtrip.test.ts',
  'Tools/dos-toolchain/phase1-integration.test.ts',

  // Incident PRDs — documentation that legitimately contains the
  // credential pattern that was scrubbed (the scrub PRD has to quote the
  // leaked literal to be a complete provenance record). Adding scrub-PRDs
  // here keeps F-025 from blocking CI on the very artifacts that document
  // the scrub. Pattern: MEMORY/ARCHIVE/{YYYY-MM}/{slug}/PRD.md.
  'MEMORY/ARCHIVE/2026-05/20260503-150400_f-023-studio-credential-scrub/PRD.md',

  // Cryptographic constants — Ed25519 DER prefix matches cloudflare-id 32-hex regex
  'Tools/dos-adapter-sign.ts',

  // v0.0.18 A2 gate-predicate — V13 F4e characterization md5 (proof-of-stability
  // hash per Feathers cover-and-modify, NOT a secret). Hash:
  // `f67c473b4da7837b4db6e2cab88499d0` matches the 32-hex cloudflare-id pattern.
  // Allowlisting the file rather than the literal so future md5 baselines in the
  // same file are also exempt. Added 2026-05-25 per v0.0.18 close-out housekeeping.
  'Plans/Specs/RFC-0101-gate-predicate.json',
  'Plans/Specs/A6-gate-predicate.json',
  'Tools/dos-extension/receipt.ts',
  'DOS/Tools/identity.ts',
  'DOS/Tools/identity-bootstrap.ts',
  'DOS/Tools/dos-rotate-key.ts',
  'DOS/Tools/dos-cmd/device-jws.ts',

  // Skill scaffold templates — example operator paths in documentation strings
  'Packs/utilities/src/CreateSkill/Templates/RegularSkill.md',
  'Packs/utilities/src/CreateSkill/Templates/VoiceChannelingSkill.md',

  // Fabric pattern reference docs — example hashes in pattern descriptions
  'Packs/utilities/src/Fabric/Patterns/write_semgrep_rule/system.md',
  'Packs/utilities/src/Fabric/Patterns/write_nuclei_template_rule/system.md',

  // Frozen v0.0.1 pentest docs — synthetic example tokens (ffuf HTTP-request
  // samples: target.com / session=abc123xyz) and public gist hash IDs in wget
  // URLs that match the 32-hex cloudflare-id pattern. Historical snapshot,
  // never re-shipped. Added 2026-07-08 (dos#422 re-green).
  'Releases/v0.0.1/skills/security/WebAssessment/**',

  // W2-S6 daemon probe transcript — shell commands inherently quote the
  // operator home path; no credentials. On main since 5c46c6cc (v23-w1).
  'Docs/Research/v0023-w2-s6-real-daemon-under-plugin-2026-07-07.md',
  'Packs/utilities/src/Fabric/Patterns/create_markmap_visualization/system.md',

  // Pentest reference docs — JWT and hash examples for fuzzing wordlists
  'Packs/security/src/WebAssessment/FfufResources/REQUEST_TEMPLATES.md',
  'Packs/security/src/WebAssessment/Workflows/ffuf/FfufGuide.md',
  'Packs/security/src/WebAssessment/Workflows/pentest/ToolInventory.md',

  // Operator-facing docs — example paths in playbooks, indexes, sales prompts
  'Docs/INDEX/INDEX.md',
  'Docs/AuthoringToolchain/TOOLCHAIN.md',
  'Docs/AuthoringToolchain/OPERATIONS.md',
  'Docs/Sales/Netlify/axscore-deep-scan-prompt.md',
  'Docs/Sales/Netlify/axscore-build-prompt.md',
  'Docs/Sales/Netlify/axscore-scan-prompt.md',
  'Docs/Playbook/voice-channeling-skill-prompts.md',
  'Docs/Playbook/how-a-skill-emits-an-artifact.md',
  'Packs/ax-deep-scan/src/Workflows/ManageReports.md',
  'Packs/agents/IncidentResponder/README.md',

  // PRD-G tracked-content allowlist extension (2026-05-13, v0.0.15 closure-push
  // discovery): legitimate operator-path + 32-hex-ID surfaces in tracked docs
  // and state files. Adding here lets release-secret-scan --tree pass without
  // weakening FORBIDDEN_PATTERNS. See MEMORY/ARCHIVE/2026-05/
  // 20260513-203323_v0015-secret-scan-tracked-content-allowlist/PRD.md.

  // Auto-generated documentation index — references operator-machine paths
  // because the index catalogues local artifact locations
  'Docs/INDEX/INDEX.json',

  // DESIGN + Docs/Artifacts artifact-spec corpora — worked examples cite
  // operator-machine absolute paths (dos-install-instance, four-copies-rule,
  // wing-collection, etc.). Glob covers the whole corpus.
  'DESIGN/Artifacts/**/*.md',
  'Docs/Artifacts/**/*.md',

  // RFC corpus — historical specs frequently cite operator-machine absolute
  // paths in worked examples, transcripts, and migration notes
  'Plans/Specs/RFC-*.md',

  // Plans/Reports + Plans/Studio + Plans/WorkingDocs — sprint reports and
  // working docs cite operator paths in audit ledgers + load-test findings
  'Plans/Reports/*.md',
  'Plans/Studio/*.md',
  'Plans/WorkingDocs/**/*.md',

  // MEMORY/CANONICAL — operator-curated per-primitive truth pages cite
  // operator-machine paths as part of the canonical state snapshot
  'MEMORY/CANONICAL/*.md',

  // MemoryGardener cron config — daily-runtime config tied to operator's
  // machine; paths are intentional, not secret
  'Packs/agents/MemoryGardener/cron.json',

  // DOS upgrade state — caches Cloudflare KV namespace IDs (32-hex) for
  // upstream-check polling; these are public IDs, not secrets
  'Packs/utilities/src/DOSUpgrade/State/last-check.json',

  // Frozen release snapshots — historical artifacts, immutable by design.
  // Operator-paths in these are baked in at freeze-time; modifying them
  // would violate the freeze invariant. Allowlist covers all .claude/**
  // content inside any Releases/v0.0.*/ snapshot.
  'Releases/v0.0.*/.claude/**',

  // Release edition manifests — pin operator-machine paths as the
  // canonical pre-publish source for that edition
  'Releases/Manifests/*.json',

  // Plans documentation — session prompts, release-readiness checklists,
  // and operator-narrative working docs cite operator paths in transcripts
  // and command examples; not customer-facing content
  'Plans/session-prompts/*.md',
  'Plans/release-*.md',
  'Plans/*.md',

  // MCP server config — references operator-machine binary paths for
  // launching MCP servers; required to be absolute paths by MCP protocol
  '.mcp.json',

  // Campaign-doc corpus (2026-06-12, operator GATE decision "hybrid" — session
  // e95acf3e): version-campaign roadmaps, triage matrices, ranked JSON, and the
  // defect registry in the PRIVATE parent repo cite operator-machine paths as
  // captured evidence (matrix cells, census rows, transcript refs). None of
  // these surfaces ship (absent from npm-package files[] and the submodule
  // tree). Ship-side protection remains W6-S2 settings templating + the
  // critical pass, which still scans these files for credential classes.
  // Offender census at decision time: 254 operator-absolute-path hits across
  // exactly 4 files (v0.0.20-{backlog,matrix}.md, v0.0.20-ranked.json,
  // DEFECT-REGISTRY-2026-06-09.md).
  'Plans/Roadmaps/*.md',
  'Plans/Roadmaps/*.json',
  'DEFECT-REGISTRY-*.md',
];

/**
 * Identity / secret patterns. Tracer-bullet minimum set; soak-iterations widen this.
 *
 * Pattern classes (per PRD D5):
 *   (a) absolute operator home paths
 *   (b) operator email (accounts@durante.tech)
 *   (c) generic API token shapes (sk-..., Bearer ...)
 *   (d) Cloudflare account/KV namespace ID format (32-char hex)
 */
export interface IdentityPattern {
  name: string;
  regex: RegExp;
  suggestion: string;
}

// Construct the platform root from path segments so this detector does not
// itself embed the operator-home signature it is responsible for finding.
const MACOS_USERS_SEGMENT = 'Users';
const OPERATOR_HOME_PATH_RE = new RegExp(
  `\\/${MACOS_USERS_SEGMENT}\\/[REDACTED:operator-username](?:\\/|$|\\b)`,
);

export const IDENTITY_PATTERNS: IdentityPattern[] = [
  {
    name: 'operator-absolute-path',
    regex: OPERATOR_HOME_PATH_RE,
    suggestion: 'Use ${HOME} or a config-resolved path instead of a maintainer-specific home path.',
  },
  {
    name: 'operator-email',
    regex: /\baccounts@durante\.tech\b/i,
    suggestion: 'Move operator email behind a config var or principal-identity lookup.',
  },
  {
    name: 'api-token-sk',
    regex: /\bsk-[A-Za-z0-9_-]{20,}\b/,
    suggestion: 'Move API tokens into settings.local.json or .env (already in config-secrets zone).',
  },
  {
    name: 'bearer-token',
    regex: /\bBearer\s+[A-Za-z0-9._\-]{20,}\b/,
    suggestion: 'Move Bearer tokens into settings.local.json or env loader.',
  },
  {
    name: 'cloudflare-id',
    regex: /\b[a-f0-9]{32}\b/,
    suggestion: 'Cloudflare account/KV namespace IDs belong in env vars, not source files.',
  },
];

/**
 * Match a file path against any zone pattern.
 * Returns the matching zone (or null if outside all zones).
 *
 * Glob semantics (minimal — sufficient for declared patterns):
 *   `**`  matches any path segments (including empty)
 *   `*`   matches any chars within a single segment except `/`
 *   `?`   matches a single char
 *   leading `**` means "anywhere in tree"
 */
export function matchesZone(
  filePath: string,
  zones: ContainmentZone[] = CONTAINMENT_ZONES,
): ContainmentZone | null {
  const normalized = filePath.replace(/\\/g, '/').replace(/^\.\//, '');
  for (const zone of zones) {
    for (const pattern of zone.patterns) {
      if (globMatch(pattern, normalized)) return zone;
    }
  }
  return null;
}

/**
 * Returns true if filePath is in PATTERN_ALLOWLIST_FILES (exact match or suffix match).
 */
export function isAllowlisted(
  filePath: string,
  allowlist: string[] = PATTERN_ALLOWLIST_FILES,
): boolean {
  const normalized = filePath.replace(/\\/g, '/').replace(/^\.\//, '');
  return allowlist.some((allowed) => {
    if (
      normalized === allowed ||
      normalized.endsWith('/' + allowed) ||
      globMatch(allowed, normalized)
    ) {
      return true;
    }

    // Pack-source allowlist entries deploy under skills/<Pack>/... in release
    // trees, so a single source declaration should cover both paths.
    const packMatch = /^Packs\/([^/]+)\/src\/(.+)$/.exec(allowed);
    if (packMatch) {
      const deployed = `skills/${packMatch[1]}/${packMatch[2]}`;
      return (
        normalized === deployed ||
        normalized.endsWith('/' + deployed) ||
        globMatch(deployed, normalized)
      );
    }

    return false;
  });
}

export interface Violation {
  pattern: string;
  matchedText: string;
  lineNumber: number;
  suggestion: string;
}

/**
 * Scan content for identity/secret patterns. Returns all matches.
 * Caller must skip the scan when matchesZone() != null (in-zone content is allowed).
 */
export function scanForViolations(
  content: string,
  patterns: IdentityPattern[] = IDENTITY_PATTERNS,
): Violation[] {
  const out: Violation[] = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const p of patterns) {
      const m = line.match(p.regex);
      if (m) {
        out.push({
          pattern: p.name,
          matchedText: m[0],
          lineNumber: i + 1,
          suggestion: p.suggestion,
        });
      }
    }
  }
  return out;
}

/**
 * Minimal glob matcher: supports `**`, `*`, `?`. No brace expansion, no negation.
 * Translates pattern to RegExp once per call.
 */
function globMatch(pattern: string, path: string): boolean {
  const re = new RegExp(
    '^' +
      pattern
        // Tokenize `**/` as a unit BEFORE `**`, so a leading `**/` matches zero
        // or more leading path segments. The prior `**`→`.*` + literal `/` forced
        // at least one `/`, so `**/*.test.ts` missed a repo-root `foo.test.ts`
        // (SENT-14).
        .split(/(\*\*\/|\*\*|\*|\?)/)
        .map((part) => {
          if (part === '**/') return '(?:.*/)?';
          if (part === '**') return '.*';
          if (part === '*') return '[^/]*';
          if (part === '?') return '[^/]';
          return part.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        })
        .join('') +
      '$',
  );
  return re.test(path);
}
