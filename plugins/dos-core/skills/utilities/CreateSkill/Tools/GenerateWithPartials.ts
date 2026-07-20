#!/usr/bin/env bun
/**
 * GenerateWithPartials — RFC-0006 §5.1 generator extension to CreateSkill.
 *
 * Emits a partial-using SKILL.md by composing the canonical boilerplate
 * from `<!-- partial: ... -->` include directives. The expanded form
 * (post `dos-toolchain/expand`) is byte-identical to a hand-authored
 * SKILL.md following the canonical layout.
 *
 * Usage:
 *   bun GenerateWithPartials.ts \
 *     --pack <SkillName> \
 *     --description "<description>" \
 *     [--tier secondary] [--icon Shield] [--category Engineering] \
 *     [--workflow "Name1:Trigger1:File1"] (repeatable) \
 *     [--out <path/SKILL.md>] \
 *     [--use-partials] \
 *     [--regenerate-frontmatter-only]
 *
 * Behavior:
 *   --use-partials (default for this tool): emits the partial-using form.
 *   --regenerate-frontmatter-only: when target file exists, replaces ONLY
 *     the YAML frontmatter block, leaving the body verbatim. Required to
 *     overwrite an existing SKILL.md.
 *
 * Exit codes:
 *   0  successful generation
 *   1  refusing to overwrite existing file without --regenerate-frontmatter-only
 *   2  invalid args / IO error
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

interface Workflow {
  name: string;
  trigger: string;
  file: string;
}

type Visibility = "public" | "internal" | "beta";
const VISIBILITY_VALUES: readonly Visibility[] = ["public", "internal", "beta"];

interface Args {
  pack: string;
  description: string;
  tier?: string;
  icon?: string;
  category?: string;
  // RFC-0011 §6 + RFC-0024 frontmatter fields — backward compatible (defaults applied when omitted)
  role?: string;
  accepts?: string;
  visibility?: Visibility;
  roots?: string;
  displayLabel?: string;
  marketingDescription?: string;
  elevator?: string;
  // RFC-0030 §11.10 frontmatter fields — explicit capability declaration + delegation
  capabilities?: string;
  delegatesTo?: string;
  useSlots?: string;
  writes?: boolean;
  workflows: Workflow[];
  out: string;
  usePartials: boolean;
  regenerateFrontmatterOnly: boolean;
}

// RFC-0030 §11.1 — slot → canonical Partial mapping (mirror `_capabilities-enum.md`).
// Hard-coded for deterministic emission; future extension: parse the enum partial.
// voice-notification retired 2026-07-02 — removed from both maps so no scaffold
// path (body OR capabilities) can re-introduce it.
const SLOT_PARTIAL_MAP: Record<string, string> = {
  customization: "_customization.md",
  "artifact-tracking": "_artifact-tracking.md",
  "four-copy-footer": "_four-copy-footer.md",
  "workflow-routing": "_workflow-routing-table.md",
  examples: "_examples-block.md",
};

// RFC-0030 §11.1 — slot → required capabilities (matches `<!-- partial-requires: -->` headers).
const SLOT_REQUIRED_CAPS: Record<string, string[]> = {
  customization: ["customization.cascade"],
  "artifact-tracking": ["artifact.write"],
  "four-copy-footer": ["four-copy.sync"],
  "workflow-routing": [],
  examples: [],
};

// RFC-0030 §11.2 D3 — role exemption matrix.
const ROLE_DEFAULT_WRITES: Record<string, boolean> = {
  extractor: true,
  generator: true,
  validator: true,
  analyzer: true,
  executor: true,
  orchestrator: false,
  advisor: false,
  thinker: false,
  researcher: false,
};

function usage(msg?: string): never {
  if (msg) console.error(`error: ${msg}`);
  console.error(
    "usage: bun GenerateWithPartials.ts --pack <SkillName> --description <desc> [--role R] [--accepts 'text,code'] [--visibility public|internal|beta] [--roots '[PROJECT.WORK]'] [--displayLabel L] [--marketingDescription M] [--elevator E] [--tier T] [--icon I] [--category C] [--workflow Name:Trigger:File ...] [--capabilities 'artifact.write'] [--delegates-to 'Sales,Brand'] [--use-slots 'customization,artifact-tracking,four-copy-footer'] [--writes true|false] [--out <path>] [--use-partials] [--regenerate-frontmatter-only]",
  );
  process.exit(2);
}

function parseArgs(argv: string[]): Args {
  const a: Partial<Args> = {
    workflows: [],
    usePartials: false,
    regenerateFrontmatterOnly: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    switch (flag) {
      case "--pack":
        a.pack = argv[++i];
        break;
      case "--description":
        a.description = argv[++i];
        break;
      case "--tier":
        a.tier = argv[++i];
        break;
      case "--icon":
        a.icon = argv[++i];
        break;
      case "--category":
        a.category = argv[++i];
        break;
      case "--role":
        a.role = argv[++i];
        break;
      case "--accepts":
        a.accepts = argv[++i];
        break;
      case "--visibility": {
        const v = argv[++i];
        if (!(VISIBILITY_VALUES as readonly string[]).includes(v)) {
          usage(`--visibility must be one of public|internal|beta (got '${v}')`);
        }
        a.visibility = v as Visibility;
        break;
      }
      case "--roots":
        a.roots = argv[++i];
        break;
      case "--displayLabel":
        a.displayLabel = argv[++i];
        break;
      case "--marketingDescription":
        a.marketingDescription = argv[++i];
        break;
      case "--elevator":
        a.elevator = argv[++i];
        break;
      case "--out":
        a.out = argv[++i];
        break;
      case "--use-partials":
        a.usePartials = true;
        break;
      case "--regenerate-frontmatter-only":
        a.regenerateFrontmatterOnly = true;
        break;
      case "--capabilities":
        a.capabilities = argv[++i];
        break;
      case "--delegates-to":
        a.delegatesTo = argv[++i];
        break;
      case "--use-slots":
        a.useSlots = argv[++i];
        break;
      case "--writes": {
        const v = argv[++i];
        if (v !== "true" && v !== "false") usage(`--writes must be true|false (got '${v}')`);
        a.writes = v === "true";
        break;
      }
      case "--workflow": {
        const spec = argv[++i] ?? "";
        const parts = spec.split(":");
        if (parts.length !== 3) usage(`--workflow requires Name:Trigger:File, got '${spec}'`);
        (a.workflows ??= []).push({
          name: parts[0],
          trigger: parts[1],
          file: parts[2],
        });
        break;
      }
      default:
        usage(`unknown flag '${flag}'`);
    }
  }
  if (!a.pack) usage("--pack is required");
  if (!a.description) usage("--description is required");
  if (!a.out) usage("--out is required");
  return a as Args;
}

/**
 * RFC-0030 §11.10 — derive effective slot list, capability set, writes flag.
 * Returns the active slots (filtered for --writes false), the union of caps,
 * and a normalized writes value.
 */
function resolveSlotsAndCaps(args: Args): {
  slots: string[];
  capabilities: string[];
  delegatesTo: string[];
  writes: boolean;
} {
  const role = args.role ?? "executor";

  // --writes resolution: explicit flag > role default > true.
  let writes: boolean;
  if (args.writes !== undefined) {
    writes = args.writes;
  } else {
    writes = ROLE_DEFAULT_WRITES[role] ?? true;
  }

  // --use-slots: parse to list. Empty means no slot-driven emission.
  const requestedSlots = (args.useSlots ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Filter artifact-tracking when writes:false (RFC §11.10).
  const slots = requestedSlots.filter((s) => {
    if (s === "artifact-tracking" && !writes) return false;
    return true;
  });

  // Auto-derive capabilities from slot requirements (union semantics).
  const slotCaps = new Set<string>();
  for (const s of slots) {
    for (const c of SLOT_REQUIRED_CAPS[s] ?? []) slotCaps.add(c);
  }

  // --capabilities flag (explicit) overrides slot-derived if provided.
  let capabilities: string[];
  if (args.capabilities !== undefined) {
    capabilities = args.capabilities
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  } else {
    capabilities = Array.from(slotCaps).sort();
  }

  // --delegates-to: parse comma-list (orchestrator pattern).
  const delegatesTo = (args.delegatesTo ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return { slots, capabilities, delegatesTo, writes };
}

function buildFrontmatter(args: Args): string {
  // RFC-0011 §6 + RFC-0024 + R3/R4/R8 ERROR-blocking fields applied as defaults.
  // RFC-0030 §11.10 capability declaration extension applied when --use-slots
  // or --capabilities is present.
  // Order mirrors canonical-pack examples (Brand, MemPalace) for diffability.
  const role = args.role ?? "executor";
  const accepts = args.accepts ?? "text";
  const visibility = args.visibility ?? "public";
  const roots = args.roots ?? "[]";
  const displayLabel = args.displayLabel ?? args.pack;
  const { capabilities, delegatesTo, writes } = resolveSlotsAndCaps(args);
  const lines: string[] = ["---"];
  lines.push(`name: ${args.pack}`);
  lines.push(`description: ${args.description}`);
  lines.push(`role: ${role}`);
  // accepts is YAML flow sequence — split on `,` and reflow as bracketed list
  const acceptsList = accepts
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .join(", ");
  lines.push(`accepts: [${acceptsList}]`);
  if (args.icon) lines.push(`icon: ${args.icon}`);
  if (args.tier) lines.push(`tier: ${args.tier}`);
  if (args.category) lines.push(`category: ${args.category}`);
  lines.push(`displayLabel: ${displayLabel}`);
  if (args.marketingDescription) lines.push(`marketingDescription: ${args.marketingDescription}`);
  if (args.elevator) lines.push(`elevator: ${args.elevator}`);
  // RFC-0030 §11.10: emit capabilities + delegates_writes_to + writes when relevant.
  // capabilities array always emitted when --use-slots was used or --capabilities explicit.
  if (capabilities.length > 0 || args.useSlots !== undefined || args.capabilities !== undefined) {
    lines.push(`capabilities: [${capabilities.join(", ")}]`);
  }
  if (delegatesTo.length > 0) {
    lines.push(`delegates_writes_to: [${delegatesTo.join(", ")}]`);
  }
  // Emit writes:false explicitly (D3 exemption); writes:true is the default
  // when applicable so we omit it for brevity unless the user passed --writes
  // explicitly with true (rare).
  if (args.writes !== undefined) {
    lines.push(`writes: ${writes}`);
  } else if (!writes && (args.useSlots !== undefined)) {
    // Inferred writes:false from role + --use-slots context; emit for clarity.
    lines.push(`writes: false`);
  }
  lines.push(`roots: ${roots}`);
  lines.push(`visibility: ${visibility}`);
  lines.push("---");
  return lines.join("\n") + "\n";
}

function buildWorkflowTable(workflows: Workflow[]): string {
  if (workflows.length === 0) return "";
  const lines: string[] = [];
  lines.push("");
  lines.push("## Workflow Routing");
  lines.push("");
  lines.push("| Workflow | Trigger | File |");
  lines.push("|----------|---------|------|");
  for (const w of workflows) {
    lines.push(`| **${w.name}** | "${w.trigger}" | \`${w.file}\` |`);
  }
  return lines.join("\n") + "\n";
}

function buildPartialsBody(args: Args): string {
  // RFC-0030 §11.10: when --use-slots is provided, emit only the requested
  // canonical slot directives. Otherwise default to the canonical layout
  // (customization + artifact-tracking + four-copy). Voice-notification was
  // retired 2026-07-02 (operator directive) — never injected into new skills.
  const { slots } = resolveSlotsAndCaps(args);
  const useExplicitSlots = args.useSlots !== undefined;
  if (useExplicitSlots && slots.includes("voice-notification")) {
    console.error("[GenerateWithPartials] slot 'voice-notification' was retired 2026-07-02 — ignored");
  }
  const sections: string[] = [];
  sections.push(""); // blank line after frontmatter

  const wantsSlot = (s: string) =>
    // voice-notification is retired — always false, even if explicitly requested.
    s === "voice-notification"
      ? false
      : useExplicitSlots
        ? slots.includes(s)
        : (s === "customization" || s === "artifact-tracking" || s === "four-copy-footer");

  if (wantsSlot("customization")) {
    sections.push(`<!-- partial: ${SLOT_PARTIAL_MAP["customization"]} skill_name=${args.pack} -->`);
    sections.push("");
  }
  sections.push(`# ${args.pack}`);
  sections.push("");
  sections.push("[Brief description of what this skill does]");
  if (args.workflows.length > 0) {
    sections.push("");
    sections.push("## Workflow Routing");
    sections.push("");
    sections.push("| Workflow | Trigger | File |");
    sections.push("|----------|---------|------|");
    for (const w of args.workflows) {
      sections.push(`| **${w.name}** | "${w.trigger}" | \`${w.file}\` |`);
    }
  }
  // Tail slots: artifact-tracking, four-copy-footer.
  if (wantsSlot("artifact-tracking")) {
    sections.push("");
    sections.push(`<!-- partial: ${SLOT_PARTIAL_MAP["artifact-tracking"]} skill_name=${args.pack} -->`);
  }
  if (wantsSlot("four-copy-footer")) {
    sections.push("");
    // install_dir = the kebab-case live-install directory (dos#578 Gate 4:
    // skill_name is the display name and stays CapCase for the pack/prose
    // contexts; the footer's path lines need the on-disk dir name).
    const installDir = args.pack
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .toLowerCase();
    sections.push(
      `<!-- partial: ${SLOT_PARTIAL_MAP["four-copy-footer"]} skill_name=${args.pack} install_dir=${installDir} -->`,
    );
  }
  return sections.join("\n") + "\n";
}

function buildInlinedBody(args: Args): string {
  // Reserved for the non-partials path (default CreateSkill behaviour).
  // Phase 0 ships only the partials path; the inline path defers to
  // CreateSkill's existing prompt-driven workflow.
  return "[inline-body generation requires --use-partials in Phase 0]\n";
}

function generate(args: Args): { content: string } {
  const fm = buildFrontmatter(args);
  const body = args.usePartials ? buildPartialsBody(args) : buildInlinedBody(args);
  return { content: fm + body };
}

/**
 * Strip-and-replace the frontmatter region of an existing SKILL.md while
 * keeping the body verbatim.
 */
function regenerateFrontmatterOnly(args: Args): { content: string } {
  if (!existsSync(args.out)) {
    throw new Error(`--regenerate-frontmatter-only requires existing file at ${args.out}`);
  }
  const existing = readFileSync(args.out, "utf8");
  if (!existing.startsWith("---\n")) {
    throw new Error(`existing file at ${args.out} has no frontmatter to replace`);
  }
  const closing = existing.indexOf("\n---\n", 4);
  if (closing === -1) throw new Error("malformed frontmatter in existing file");
  const body = existing.slice(closing + "\n---\n".length);
  const fm = buildFrontmatter(args);
  return { content: fm + body };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  let result;
  if (args.regenerateFrontmatterOnly) {
    result = regenerateFrontmatterOnly(args);
  } else {
    if (existsSync(args.out)) {
      console.error(
        `refusing to overwrite existing file at ${args.out}; pass --regenerate-frontmatter-only to replace just the frontmatter`,
      );
      process.exit(1);
    }
    result = generate(args);
  }
  mkdirSync(dirname(args.out), { recursive: true });
  // writeArtifact:exempt — scaffold emission — CreateSkill tooling; artifact logging is the workflow step
  writeFileSync(args.out, result.content);
  console.log(`wrote ${args.out} (${Buffer.byteLength(result.content, "utf8")} bytes)`);
  process.exit(0);
}

main();
