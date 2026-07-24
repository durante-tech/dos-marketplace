/**
 * RFC-0001 orchestration runtime — Store implementations.
 *
 * Extracted from index.ts per the G6 (Long-Class) refactor iter 8. Owns:
 *   - state-helper functions (initialRun, cloneRun, projectionMetadata, etc.)
 *   - MemoryStore — ephemeral in-process store
 *   - FileStore — JSON-on-disk store at MEMORY/STATE/orchestrator/{id}.json
 *
 * Both stores implement the Store interface defined in types.ts and rely on
 * renderPrdProjection from prd-interop.ts to keep prdMarkdown in sync.
 *
 * The state helpers are intentionally NOT exported — they're store-internal
 * implementation details. Callers should use the Store interface methods.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  type Criterion,
  type Diagnostic,
  type EffortLevel,
  type OrchestrationRun,
  type PhaseId,
  type PhaseRecord,
  type RetryRecord,
  type Store,
} from "./types";
import { renderPrdProjection } from "./prd-interop";

export const DEFAULT_ORCHESTRATOR_STATE_DIR = join(
  process.env.DOS_ORCH_STATE_DIR ??
    join(process.env.DOS_DIR ?? join(process.env.HOME ?? "/tmp", ".claude"), "MEMORY", "STATE", "orchestrator"),
);

function initialRun(request: string, id: string): OrchestrationRun {
  return {
    id,
    request,
    effort: "standard",
    category: "action",
    activePhases: [],
    phaseRecords: [],
    criteria: [],
    retries: [],
    status: "paused",
    diagnostics: [],
    prdMarkdown: "",
    prdProjection: {
      renderedAt: "1970-01-01T00:00:00.000Z",
      criteriaCount: 0,
      phaseRecordCount: 0,
      source: "structured-criteria",
    },
  };
}

function cloneCriterion(c: Criterion): Criterion {
  return { ...c, verificationMethod: c.verificationMethod ? { ...c.verificationMethod } : undefined };
}

function cloneRun(run: OrchestrationRun): OrchestrationRun {
  return {
    ...run,
    activePhases: [...run.activePhases],
    phaseRecords: run.phaseRecords.map((r) => ({ ...r, slots: { ...r.slots }, diagnostics: [...r.diagnostics] })),
    criteria: run.criteria.map(cloneCriterion),
    retries: run.retries.map((r) => ({ ...r, gateResults: r.gateResults.map((g) => ({ ...g, diagnostics: g.diagnostics ? { ...g.diagnostics } : undefined })) })),
    diagnostics: run.diagnostics.map((d) => ({ ...d, details: d.details ? { ...d.details } : undefined })),
    prdProjection: run.prdProjection ? { ...run.prdProjection } : undefined,
  };
}

function projectionMetadata(criteria: readonly Criterion[], phaseRecords: readonly PhaseRecord[], legacyImportedAt?: string): OrchestrationRun["prdProjection"] {
  return {
    renderedAt: "1970-01-01T00:00:00.000Z",
    criteriaCount: criteria.length,
    phaseRecordCount: phaseRecords.length,
    source: "structured-criteria",
    legacyImportedAt,
  };
}

function allActivePhasesRecorded(run: OrchestrationRun, phaseRecords = run.phaseRecords): boolean {
  if (run.activePhases.length === 0) return true;
  const completed = new Set(phaseRecords.map((r) => r.phase));
  return run.activePhases.every((phase) => completed.has(phase));
}

function persistRun(path: string, run: OrchestrationRun): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(run, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

export class MemoryStore implements Store {
  private run: OrchestrationRun;

  constructor(request: string, id = "run") {
    this.run = initialRun(request, id);
  }

  getRun(): OrchestrationRun {
    return cloneRun(this.run);
  }

  setEffort(effort: EffortLevel, category: string, activePhases: PhaseId[]): void {
    this.run = { ...this.run, effort, category, activePhases: [...activePhases] };
  }

  appendPhaseRecord(record: PhaseRecord): void {
    const frozen = Object.freeze({
      ...record,
      slots: Object.freeze({ ...record.slots }),
      diagnostics: Object.freeze([...record.diagnostics]),
    }) as PhaseRecord;
    const phaseRecords = this.run.phaseRecords.concat(frozen);
    this.run = {
      ...this.run,
      phaseRecords,
      status: allActivePhasesRecorded(this.run, phaseRecords) ? "complete" : this.run.status,
      prdMarkdown: renderPrdProjection(this.run.request, this.run.effort, this.run.criteria, phaseRecords),
      prdProjection: projectionMetadata(this.run.criteria, phaseRecords, this.run.prdProjection?.legacyImportedAt),
    };
  }

  setCriteria(criteria: Criterion[]): void {
    const cloned = criteria.map((c) => ({ ...c, verificationMethod: c.verificationMethod ? { ...c.verificationMethod } : undefined }));
    this.run = {
      ...this.run,
      criteria: cloned,
      prdMarkdown: renderPrdProjection(this.run.request, this.run.effort, cloned, this.run.phaseRecords),
      prdProjection: projectionMetadata(cloned, this.run.phaseRecords, this.run.prdProjection?.legacyImportedAt),
    };
  }

  updateCriteria(updates: Array<Partial<Criterion> & { id: string }>, phase: PhaseId): void {
    const byId = new Map(updates.map((u) => [u.id, u]));
    const criteria = this.run.criteria.map((c) => {
      const u = byId.get(c.id);
      if (!u) return c;
      return { ...c, ...u, id: c.id, createdInPhase: c.createdInPhase, updatedInPhase: phase };
    });
    this.setCriteria(criteria);
  }

  appendRetry(record: RetryRecord): void {
    this.run = { ...this.run, retries: [...this.run.retries, Object.freeze({ ...record }) as RetryRecord] };
  }

  appendDiagnostic(diagnostic: Diagnostic): void {
    this.run = { ...this.run, diagnostics: [...this.run.diagnostics, diagnostic] };
  }

  setStatus(status: OrchestrationRun["status"]): void {
    this.run = { ...this.run, status };
  }
}

export class FileStore implements Store {
  private run: OrchestrationRun;
  readonly path: string;

  constructor(request: string, id = "run", stateDir = DEFAULT_ORCHESTRATOR_STATE_DIR) {
    this.path = join(stateDir, `${id}.json`);
    if (existsSync(this.path)) {
      const parsed = JSON.parse(readFileSync(this.path, "utf8")) as OrchestrationRun;
      this.run = {
        ...initialRun(parsed.request ?? request, parsed.id ?? id),
        ...parsed,
        prdProjection: parsed.prdProjection ?? projectionMetadata(parsed.criteria ?? [], parsed.phaseRecords ?? []),
      };
    } else {
      this.run = initialRun(request, id);
      this.save();
    }
  }

  getRun(): OrchestrationRun {
    return cloneRun(this.run);
  }

  setEffort(effort: EffortLevel, category: string, activePhases: PhaseId[]): void {
    this.run = { ...this.run, effort, category, activePhases: [...activePhases], status: activePhases.length > 0 ? "paused" : "complete" };
    this.save();
  }

  appendPhaseRecord(record: PhaseRecord): void {
    if (this.run.phaseRecords.some((r) => r.id === record.id)) {
      throw new Error(`phase record already exists: ${record.id}`);
    }
    const phaseRecords = [...this.run.phaseRecords, { ...record, slots: { ...record.slots }, diagnostics: [...record.diagnostics] }];
    this.run = {
      ...this.run,
      phaseRecords,
      status: allActivePhasesRecorded(this.run, phaseRecords) ? "complete" : this.run.status,
      prdMarkdown: renderPrdProjection(this.run.request, this.run.effort, this.run.criteria, phaseRecords),
      prdProjection: projectionMetadata(this.run.criteria, phaseRecords, this.run.prdProjection?.legacyImportedAt),
    };
    this.save();
  }

  setCriteria(criteria: Criterion[]): void {
    const cloned = criteria.map(cloneCriterion);
    this.run = {
      ...this.run,
      criteria: cloned,
      prdMarkdown: renderPrdProjection(this.run.request, this.run.effort, cloned, this.run.phaseRecords),
      prdProjection: projectionMetadata(cloned, this.run.phaseRecords, this.run.prdProjection?.legacyImportedAt),
    };
    this.save();
  }

  updateCriteria(updates: Array<Partial<Criterion> & { id: string }>, phase: PhaseId): void {
    const byId = new Map(updates.map((u) => [u.id, u]));
    this.setCriteria(
      this.run.criteria.map((c) => {
        const u = byId.get(c.id);
        return u ? { ...c, ...u, id: c.id, createdInPhase: c.createdInPhase, updatedInPhase: phase } : c;
      }),
    );
  }

  appendRetry(record: RetryRecord): void {
    if (this.run.retries.some((r) => r.id === record.id)) {
      throw new Error(`retry record already exists: ${record.id}`);
    }
    this.run = { ...this.run, retries: [...this.run.retries, { ...record }] };
    this.save();
  }

  appendDiagnostic(diagnostic: Diagnostic): void {
    this.run = { ...this.run, diagnostics: [...this.run.diagnostics, { ...diagnostic }] };
    this.save();
  }

  setStatus(status: OrchestrationRun["status"]): void {
    this.run = { ...this.run, status };
    this.save();
  }

  markLegacyImported(at = "1970-01-01T00:00:00.000Z"): void {
    this.run = {
      ...this.run,
      prdProjection: projectionMetadata(this.run.criteria, this.run.phaseRecords, at),
    };
    this.save();
  }

  private save(): void {
    persistRun(this.path, this.run);
  }
}
