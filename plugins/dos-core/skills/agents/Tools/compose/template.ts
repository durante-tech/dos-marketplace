export type TemplateDelegate = (context: Record<string, unknown>) => string;

export function compileTemplate(source: string): TemplateDelegate {
  assertSupportedTemplate(source);
  return (context) => renderTemplate(source, context);
}

function assertSupportedTemplate(source: string): void {
  const tagPattern = /{{{?\s*([^{}]+?)\s*}?}}/g;
  for (const match of source.matchAll(tagPattern)) {
    const tag = match[1]?.trim() ?? "";
    const supported =
      /^#each\s+[\w.]+$/.test(tag) ||
      tag === "/each" ||
      /^#if\s+[\w.]+$/.test(tag) ||
      tag === "/if" ||
      /^[\w.]+$/.test(tag);

    if (!supported || tag === "else") {
      throw new Error(`Unsupported template syntax: {{${tag}}}`);
    }
  }
}

function renderTemplate(source: string, context: Record<string, unknown>): string {
  let output = source;

  output = output.replace(
    /{{#each\s+([\w.]+)}}([\s\S]*?){{\/each}}/g,
    (_match, path: string, body: string) => {
      const value = resolvePath(context, path);
      if (!Array.isArray(value) || value.length === 0) return "";
      return value
        .map((item) =>
          renderTemplate(body, {
            ...context,
            ...(isRecord(item) ? item : {}),
            this: item,
          }),
        )
        .join("");
    },
  );

  let changed = true;
  while (changed) {
    changed = false;
    output = output.replace(
      /{{#if\s+([\w.]+)}}((?:(?!{{#if\s).)*?){{\/if}}/gs,
      (_match, path: string, body: string) => {
        changed = true;
        return isTruthy(resolvePath(context, path))
          ? renderTemplate(body, context)
          : "";
      },
    );
  }

  output = output.replace(
    /{{{\s*([\w.]+)\s*}}}|{{\s*([\w.]+)\s*}}/g,
    (_match, triplePath: string | undefined, path: string | undefined) => {
      const value = resolvePath(context, triplePath ?? path ?? "");
      return value == null ? "" : String(value);
    },
  );

  return output;
}

function resolvePath(context: Record<string, unknown>, path: string): unknown {
  if (path === "this") return context.this;
  return path.split(".").reduce<unknown>((current, key) => {
    if (!isRecord(current)) return undefined;
    return current[key];
  }, context);
}

function isTruthy(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
