/**
 * RFC-0001 orchestration runtime — PRD ↔ Criterion serialization.
 *
 * Extracted from index.ts per the G6 (Long-Class) refactor iter 6. Owns:
 *   - parsing legacy `## Criteria` markdown blocks into structured Criterion[]
 *   - inferring subject + verification method from criterion descriptions
 *   - rendering Criterion[] back to checkbox-list markdown
 *   - rendering a full PRD projection (frontmatter + criteria + phase records)
 *
 * Pure text in / pure text out. Zero I/O. Zero state.
 */

import {
  type Criterion,
  type CriterionPriority,
  type CriterionStatus,
  type EffortLevel,
  type PhaseId,
  type PhaseRecord,
  type VerificationMethod,
} from "./types";

export function importLegacyCriteriaMarkdown(content: string, phase: PhaseId = "DEFINE"): Criterion[] {
  const criteriaMatch = content.match(/## Criteria\n([\s\S]*?)(?=\n## |\n---|$)/);
  if (!criteriaMatch) return [];
  return criteriaMatch[1]
    .split("\n")
    .map((line) => line.match(/^- \[([ x])\]\s*([^:]+):\s*(.*)$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m, index): Criterion => {
      const id = m[2]!.trim();
      const description = m[3]!.trim();
      const priorityMatch = description.match(/\b(priority|prio)\s*[:=]\s*(critical|important|nice)\b/i)?.[2]?.toLowerCase();
      const statusMatch = description.match(/\bstatus\s*[:=]\s*(pending|in_progress|completed|failed)\b/i)?.[1]?.toLowerCase();
      const evidenceMatch = description.match(/\bEvidence:\s*(.+)$/i)?.[1]?.trim();
      const isAnti = /^(ISC-)?A[-\d]?/i.test(id) || /^ISC-A/i.test(id) || /\b(no|not|without|must not)\b/i.test(description);
      return {
        id,
        subject: subjectFromDescription(description),
        description,
        priority: (priorityMatch as CriterionPriority | undefined) ?? (index === 0 ? "critical" : "important"),
        isAnti,
        status: (statusMatch as CriterionStatus | undefined) ?? (m[1] === "x" ? "completed" : "pending"),
        verificationMethod: inferVerificationMethod(description),
        evidence: evidenceMatch ?? (m[1] === "x" ? "legacy checkbox checked" : undefined),
        createdInPhase: phase,
        updatedInPhase: phase,
      };
    });
}

function subjectFromDescription(description: string): string {
  return description
    .replace(/\s+/g, " ")
    .split(" ")
    .slice(0, 12)
    .join(" ")
    .replace(/[.;:]$/, "");
}

function inferVerificationMethod(description: string): VerificationMethod {
  const command = description.match(/`([^`]*(?:test|lint|typecheck|verify)[^`]*)`/i);
  if (command) return { type: "command", command: command[1] };
  if (/\b(test|lint|typecheck|verify|spec)\b/i.test(description)) return { type: "subjective", hint: "Verify via project test or lint evidence." };
  return { type: "subjective", hint: "Verify against the criterion description." };
}

export function renderCriteriaMarkdown(criteria: readonly Criterion[]): string {
  return criteria
    .map((c) => {
      const mark = c.status === "completed" ? "x" : " ";
      const anti = c.isAnti ? " anti" : "";
      const evidence = c.evidence ? ` Evidence: ${c.evidence}` : "";
      return `- [${mark}] ${c.id}: ${c.description} (${c.priority}${anti}; status=${c.status}).${evidence}`;
    })
    .join("\n");
}

export function renderPrdProjection(
  task: string,
  effort: EffortLevel,
  criteria: readonly Criterion[],
  phaseRecords: readonly PhaseRecord[],
): string {
  const phase = phaseRecords.at(-1)?.phase.toLowerCase() ?? "classify";
  const passed = criteria.filter((c) => c.status === "completed").length;
  return [
    "---",
    `task: ${JSON.stringify(task)}`,
    `effort: ${effort}`,
    `phase: ${phase}`,
    `progress: ${passed}/${criteria.length}`,
    "---",
    "",
    "## Criteria",
    renderCriteriaMarkdown(criteria),
    "",
    "## Phase Records",
    ...phaseRecords.map((r) => `- ${r.phase}: ${Object.keys(r.slots).join(", ") || "recorded"}`),
    "",
  ].join("\n");
}
