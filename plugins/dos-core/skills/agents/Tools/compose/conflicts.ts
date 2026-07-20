export const CONFLICTS: ReadonlyArray<readonly [string, string, string]> = [
  ["rapid", "thorough", "CONFLICT: rapid + thorough are mutually exclusive work patterns"],
  ["cautious", "bold", "CONFLICT: cautious + bold have opposing risk profiles"],
  ["meticulous", "rapid", "CONFLICT: meticulous + rapid tension between speed and detail"],
];

export const TENSIONS: ReadonlyArray<readonly [string, string, string]> = [
  ["skeptical", "enthusiastic", "TENSION: unusual but can work — skeptic excited about findings"],
  ["adversarial", "empathetic", "TENSION: unusual — attacks ideas while understanding stakeholders"],
];

export function checkTraitConflicts(traitKeys: string[]): void {
  for (const [a, b, msg] of CONFLICTS) {
    if (traitKeys.includes(a) && traitKeys.includes(b)) {
      console.error(`WARNING: ${msg}. Consider replacing one.`);
    }
  }
  for (const [a, b, msg] of TENSIONS) {
    if (traitKeys.includes(a) && traitKeys.includes(b)) {
      console.error(`NOTE: ${msg}`);
    }
  }
}
