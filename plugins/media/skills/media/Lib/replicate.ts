/**
 * Shared Replicate SDK response handling for Media CLI tools.
 *
 * replicate.run() returns FileOutput objects (ReadableStream with .url()/.blob()),
 * URL strings, or arrays of FileOutput. This normalizes any response to a Buffer.
 */

export async function replicateResultToBuffer(result: unknown): Promise<Buffer> {
  // FileOutput is a ReadableStream with .url() and .blob() methods.
  if (result && typeof (result as any).url === "function") {
    // Prefer .blob(): gateway-wrapped outputs authenticate same-origin Studio
    // downloads inside blob(). A bare fetch(url()) omits the bearer and 401s on
    // auth-gated Studio storage paths (the recurring "Failed to fetch" bug).
    if (typeof (result as any).blob === "function") {
      const blob = await (result as any).blob();
      return Buffer.from(await blob.arrayBuffer());
    }
    const url = (result as any).url();
    if (typeof url === "string" && url.startsWith("http")) {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch from Replicate: ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    }
  }

  // ReadableStream without .url() (legacy)
  if (result instanceof ReadableStream || (result && typeof (result as any).getReader === "function")) {
    const reader = (result as ReadableStream).getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    return Buffer.concat(chunks);
  }

  // Direct URL string
  if (typeof result === "string" && result.startsWith("http")) {
    const response = await fetch(result);
    if (!response.ok) throw new Error(`Failed to fetch from Replicate URL: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }

  if (Buffer.isBuffer(result)) return result;
  if (result instanceof Uint8Array) return Buffer.from(result);

  // Array of FileOutput or URLs — take first element
  if (Array.isArray(result) && result.length > 0) {
    return replicateResultToBuffer(result[0]);
  }

  // Object with known URL fields
  if (result && typeof result === "object") {
    const obj = result as any;
    const url = obj.output || obj.url || obj.image;
    if (typeof url === "string" && url.startsWith("http")) {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch from Replicate URL: ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    }
  }

  throw new Error(`Unexpected Replicate response type: ${typeof result} — ${JSON.stringify(result).slice(0, 200)}`);
}
