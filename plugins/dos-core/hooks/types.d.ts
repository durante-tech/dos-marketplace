/**
 * Ambient declarations for DOS hooks running under Bun.
 *
 * Hooks are standalone Bun scripts without a package.json, so @types/node is
 * not reachable via node_modules. These declarations give the TS LSP just
 * enough to type-check the Node APIs that hooks actually use. Bun provides
 * the real implementations at runtime; this file is IDE-only.
 */

declare const process: {
  env: Record<string, string | undefined>;
  argv: string[];
  cwd(): string;
  exit(code?: number): never;
  on(event: string, listener: (...args: unknown[]) => void): void;
  off(event: string, listener: (...args: unknown[]) => void): void;
  once(event: string, listener: (...args: unknown[]) => void): void;
  stdin: {
    on(event: 'data', listener: (chunk: Buffer | string) => void): void;
    on(event: 'end', listener: () => void): void;
    on(event: 'error', listener: (err: Error) => void): void;
    on(event: string, listener: (...args: unknown[]) => void): void;
    setEncoding(encoding: string): void;
    isTTY: boolean;
  };
  stdout: { write(chunk: string): boolean };
  stderr: { write(chunk: string): boolean };
  pid: number;
  ppid: number;
  execPath: string;
  platform: 'darwin' | 'linux' | 'win32' | string;
  arch: string;
  version: string;
  versions: Record<string, string>;
  uptime(): number;
  hrtime(time?: [number, number]): [number, number];
  memoryUsage(): { rss: number; heapTotal: number; heapUsed: number; external: number };
  kill(pid: number, signal?: string | number): boolean;
  nextTick(callback: () => void): void;
  getuid?(): number;
  getgid?(): number;
  setMaxListeners(n: number): void;
  chdir(dir: string): void;
};

interface FsDirent {
  name: string;
  isDirectory(): boolean;
  isFile(): boolean;
  isSymbolicLink(): boolean;
  isBlockDevice(): boolean;
  isCharacterDevice(): boolean;
  isFIFO(): boolean;
  isSocket(): boolean;
}

interface BunSubprocess {
  stdout: ReadableStream<Uint8Array>;
  stderr: ReadableStream<Uint8Array>;
  stdin: { write(data: string | Uint8Array): number; end(): void };
  exited: Promise<number>;
  exitCode: number | null;
  pid: number;
  kill(): void;
  unref(): void;
}

interface BunSpawnSyncResult {
  exitCode: number | null;
  stdout: { toString(): string } & Uint8Array;
  stderr: Uint8Array | null;
}

/**
 * Minimal Bun shim — hooks use a narrow slice of the Bun API. Extend as
 * needed rather than pulling in @types/bun (adds node_modules, untracked in
 * git context).
 */
interface BunFile {
  text(): Promise<string>;
  exists(): Promise<boolean>;
  arrayBuffer(): Promise<ArrayBuffer>;
  stream(): ReadableStream<Uint8Array>;
  json(): Promise<unknown>;
  size: number;
  type: string;
  lastModified: number;
  writer(): {
    write(data: string | Uint8Array): number;
    flush(): Promise<number>;
    end(): Promise<number>;
  };
}

declare const Bun: {
  spawn(
    cmd: string[],
    options?: {
      stdout?: 'pipe' | 'ignore' | 'inherit';
      stderr?: 'pipe' | 'ignore' | 'inherit' | number;
      stdin?: 'pipe' | 'ignore' | 'inherit';
      detached?: boolean;
      env?: Record<string, string | undefined>;
      cwd?: string;
    },
  ): BunSubprocess;
  spawnSync(
    cmd: string[],
    options?: {
      timeout?: number;
      cwd?: string;
      env?: Record<string, string | undefined>;
      stdout?: 'pipe' | 'ignore' | 'inherit';
      stderr?: 'pipe' | 'ignore' | 'inherit';
      stdin?: 'pipe' | 'ignore' | 'inherit' | string | Uint8Array;
    },
  ): BunSpawnSyncResult;
  stdin: { stream(): ReadableStream<Uint8Array>; text(): Promise<string> };
  stdout: { write(data: string | Uint8Array): number };
  stderr: { write(data: string | Uint8Array): number };
  file(path: string): BunFile;
  write(path: string, data: string | Uint8Array): Promise<number>;
  sleepSync(ms: number): void;
  sleep(ms: number): Promise<void>;
  gc(force?: boolean): void;
  version: string;
  revision: string;
};

// TextDecoder / TextEncoder / Response / ReadableStream are provided by
// lib "DOM" (see tsconfig.json "lib": ["ES2024", "DOM"]). Previously
// declared ambiently here — the ambient declarations conflicted with
// DOM's parameterized generics (ReadableStream<R=any> vs ReadableStream<T=unknown>)
// which made `decoder.decode(value)` fail to narrow in ~11 callsites
// where `value` came from `reader.read()`. DOM's types handle these
// classes correctly; no local declaration needed.

declare const console: {
  log(...args: unknown[]): void;
  error(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  info(...args: unknown[]): void;
};

declare const Date: {
  new(): Date;
  new(value: number | string): Date;
  now(): number;
};
interface Date {
  toISOString(): string;
  getTime(): number;
  getDate(): number;
  getMonth(): number;
  getFullYear(): number;
  getHours(): number;
  getMinutes(): number;
  getSeconds(): number;
}

type FsPath = string;
type FsEncoding = 'utf-8' | 'utf8' | 'ascii' | 'base64' | 'hex';

interface FsStats {
  isDirectory(): boolean;
  isFile(): boolean;
  isSymbolicLink(): boolean;
  size: number;
  mtime: Date;
  mtimeMs: number;
  atime: Date;
  atimeMs: number;
  ctime: Date;
  ctimeMs: number;
  birthtime: Date;
  birthtimeMs: number;
  dev: number;
  ino: number;
  mode: number;
  nlink: number;
  uid: number;
  gid: number;
  rdev: number;
  blksize: number;
  blocks: number;
}

declare module 'fs' {
  export function readFileSync(path: FsPath, encoding: FsEncoding): string;
  export function readFileSync(path: FsPath | number): Buffer;
  export function readFileSync(path: FsPath | number, encoding: FsEncoding): string;
  export function writeFileSync(path: FsPath | number, data: string | Uint8Array, encoding?: FsEncoding | { encoding?: FsEncoding; mode?: number; flag?: string }): void;
  export function appendFileSync(path: FsPath | number, data: string | Uint8Array, encoding?: FsEncoding | { encoding?: FsEncoding; mode?: number; flag?: string }): void;
  export function existsSync(path: FsPath): boolean;
  export function mkdirSync(path: FsPath, options?: { recursive?: boolean; mode?: number }): string | undefined;
  export function readdirSync(path: FsPath): string[];
  export function readdirSync(path: FsPath, options: { withFileTypes: true }): FsDirent[];
  export function readdirSync(path: FsPath, options: { withFileTypes?: false }): string[];
  export function statSync(path: FsPath): FsStats;
  export function renameSync(oldPath: FsPath, newPath: FsPath): void;
  export function rmdirSync(path: FsPath, options?: { recursive?: boolean }): void;
  export function unlinkSync(path: FsPath): void;
  export function rmSync(path: FsPath, options?: { recursive?: boolean; force?: boolean; maxRetries?: number; retryDelay?: number }): void;
  export function copyFileSync(src: FsPath, dest: FsPath): void;
  export function chmodSync(path: FsPath, mode: number | string): void;
  export function openSync(path: FsPath, flags: string, mode?: number): number;
  export function closeSync(fd: number): void;
  export function writeSync(fd: number, data: string | Uint8Array): number;
  export function writeSync(
    fd: number,
    buffer: Uint8Array,
    offset: number | null,
    length: number | null,
    position: number | null,
  ): number;
  export function readSync(fd: number, buffer: Uint8Array, offset?: number, length?: number, position?: number | null): number;
  export function fsyncSync(fd: number): void;
  export function lstatSync(path: FsPath): FsStats;
  export function fstatSync(fd: number): FsStats;
  export function realpathSync(path: FsPath): string;
  export function symlinkSync(target: FsPath, path: FsPath): void;
  export function readlinkSync(path: FsPath): string;
  export function utimesSync(path: FsPath, atime: number | Date, mtime: number | Date): void;
  export const promises: {
    readFile(path: FsPath, encoding?: FsEncoding): Promise<string | Uint8Array>;
    writeFile(path: FsPath, data: string | Uint8Array): Promise<void>;
    appendFile(path: FsPath, data: string | Uint8Array): Promise<void>;
    mkdir(path: FsPath, options?: { recursive?: boolean; mode?: number }): Promise<string | undefined>;
    readdir(path: FsPath): Promise<string[]>;
    stat(path: FsPath): Promise<FsStats>;
    unlink(path: FsPath): Promise<void>;
    rename(oldPath: FsPath, newPath: FsPath): Promise<void>;
  };
}

declare module 'node:fs' {
  export * from 'fs';
}

declare module 'node:fs/promises' {
  export function readFile(path: FsPath, encoding?: FsEncoding): Promise<string | Buffer>;
  export function writeFile(path: FsPath, data: string | Uint8Array): Promise<void>;
  export function appendFile(path: FsPath, data: string | Uint8Array): Promise<void>;
  export function mkdir(path: FsPath, options?: { recursive?: boolean; mode?: number }): Promise<string | undefined>;
  export function readdir(path: FsPath): Promise<string[]>;
  export function stat(path: FsPath): Promise<FsStats>;
  export function lstat(path: FsPath): Promise<FsStats>;
  export function unlink(path: FsPath): Promise<void>;
  export function rename(oldPath: FsPath, newPath: FsPath): Promise<void>;
  export function rm(path: FsPath, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
  export function access(path: FsPath, mode?: number): Promise<void>;
  export function fsync(fd: number): Promise<void>;
  export function copyFile(src: FsPath, dest: FsPath, mode?: number): Promise<void>;
  export function chmod(path: FsPath, mode: number | string): Promise<void>;
}

declare module 'fs/promises' {
  export * from 'node:fs/promises';
}

declare module 'path' {
  export function join(...paths: string[]): string;
  export function dirname(path: string): string;
  export function basename(path: string, ext?: string): string;
  export function resolve(...paths: string[]): string;
  export function relative(from: string, to: string): string;
  export function extname(path: string): string;
  export const sep: string;
}

declare module 'node:path' {
  export * from 'path';
}

declare module 'os' {
  export function homedir(): string;
  export function tmpdir(): string;
  export function hostname(): string;
  export function platform(): string;
}

declare module 'node:os' {
  export * from 'os';
}

declare module 'child_process' {
  interface SpawnOptions {
    cwd?: string;
    encoding?: FsEncoding;
    stdio?: 'pipe' | 'ignore' | 'inherit' | ('pipe' | 'ignore' | 'inherit' | number)[];
    timeout?: number;
    env?: Record<string, string | undefined>;
    maxBuffer?: number;
    detached?: boolean;
    shell?: boolean | string;
    input?: string | Uint8Array;
  }
  export function execSync(command: string, options?: SpawnOptions): string;
  // Hooks always pass `{ encoding: 'utf-8' }`; narrowing the return to `string`
  // avoids 3 downstream `.trim()` errors. Callers that want Buffer can cast.
  export function execFileSync(file: string, args?: string[], options?: SpawnOptions): string;
  export function execFileSync(file: string, options?: SpawnOptions): string;
  export function spawnSync(
    command: string,
    args?: string[],
    options?: SpawnOptions,
  ): {
    status: number | null;
    stdout: string | Uint8Array;
    stderr: string | Uint8Array;
    pid: number;
    signal: string | null;
    error?: Error;
  };
  export function spawnSync(
    command: string,
    options?: SpawnOptions,
  ): {
    status: number | null;
    stdout: string | Uint8Array;
    stderr: string | Uint8Array;
    pid: number;
    signal: string | null;
    error?: Error;
  };
  interface ChildProcessStream {
    on(event: 'data', listener: (chunk: Buffer | string) => void): void;
    on(event: 'end', listener: () => void): void;
    on(event: 'error', listener: (err: Error) => void): void;
    on(event: string, listener: (...args: unknown[]) => void): void;
  }
  interface ChildProcessStdin {
    write(data: string | Uint8Array): boolean;
    end(data?: string | Uint8Array): void;
  }
  interface ChildProcess {
    pid: number;
    stdout: ChildProcessStream | null;
    stderr: ChildProcessStream | null;
    stdin: ChildProcessStdin | null;
    unref(): void;
    kill(signal?: string | number): boolean;
    on(event: 'close' | 'exit', listener: (code: number | null, signal: string | null) => void): void;
    on(event: 'error', listener: (err: Error) => void): void;
    on(event: string, listener: (...args: unknown[]) => void): void;
  }
  export function spawn(command: string, args?: string[], options?: SpawnOptions): ChildProcess;
  export function spawn(command: string, options?: SpawnOptions): ChildProcess;
}

declare module 'node:child_process' {
  export * from 'child_process';
}

// `require(id)`: Bun resolves the real module at runtime. The shape depends
// on the id arg so we can't narrow statically — `any` here matches the
// ambient-module semantics and defers typing to the inlined destructure
// at the callsite (e.g., `const { existsSync } = require('fs')`).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare function require(id: string): any;
declare const __dirname: string;
declare const __filename: string;

interface ImportMeta {
  /** True when this module is the entry point for the process. */
  main: boolean;
  url: string;
  dir: string;
  file: string;
  filename: string;
  path: string;
  resolve(specifier: string): string;
}

declare function setTimeout(handler: () => void, ms?: number): NodeJS.Timeout;
declare function setTimeout<TArgs extends unknown[]>(handler: (...args: TArgs) => void, ms?: number, ...args: TArgs): NodeJS.Timeout;
declare function clearTimeout(handle: NodeJS.Timeout | undefined): void;
declare function setInterval(handler: () => void, ms?: number): NodeJS.Timeout;
declare function clearInterval(handle: NodeJS.Timeout | undefined): void;
declare function setImmediate(handler: () => void): NodeJS.Immediate;
declare function clearImmediate(handle: NodeJS.Immediate | undefined): void;

// ─── Buffer (Node.js global) ──────────────────────────────
//
// Bun provides Buffer at runtime; hooks use it for ed25519 signing + base64
// encoding in identity / receipt paths. Minimal static + instance surface.

declare class Buffer extends Uint8Array {
  static from(data: string, encoding?: string): Buffer;
  static from(data: Uint8Array | ArrayBuffer | number[]): Buffer;
  static alloc(size: number, fill?: string | number, encoding?: string): Buffer;
  static allocUnsafe(size: number): Buffer;
  static isBuffer(obj: unknown): obj is Buffer;
  static concat(list: readonly Uint8Array[], totalLength?: number): Buffer;
  static byteLength(string: string, encoding?: string): number;
  toString(encoding?: string, start?: number, end?: number): string;
  equals(other: Uint8Array): boolean;
  slice(start?: number, end?: number): Buffer;
  readUInt32BE(offset?: number): number;
  writeUInt32BE(value: number, offset?: number): number;
  readBigUInt64BE(offset?: number): bigint;
  writeBigUInt64BE(value: bigint, offset?: number): number;
}

// ─── TextEncoder/TextDecoder constructor args ──────────────

// Redeclare to accept optional encoding arg (used across hooks).
interface TextDecoderOptions {
  fatal?: boolean;
  ignoreBOM?: boolean;
}

// ─── node:crypto ──────────────────────────────────────────

declare module 'node:crypto' {
  export interface Hash {
    update(data: string | Uint8Array, encoding?: string): Hash;
    digest(encoding: string): string;
    digest(): Buffer;
  }
  export interface Hmac extends Hash {}
  export interface KeyObject {
    type: 'public' | 'private' | 'secret';
    asymmetricKeyType?: string;
    symmetricKeySize?: number;
    export(options?: { format?: 'pem' | 'der'; type?: string; cipher?: string; passphrase?: string | Uint8Array }): string | Buffer;
  }
  export interface KeyInput {
    key: string | Uint8Array | KeyObject;
    format?: 'pem' | 'der' | 'jwk';
    type?: 'pkcs1' | 'pkcs8' | 'spki' | 'sec1';
    passphrase?: string | Uint8Array;
    encoding?: string;
  }
  export function createHash(algorithm: string): Hash;
  export function createHmac(algorithm: string, key: string | Uint8Array): Hmac;
  export function randomBytes(size: number): Buffer;
  export function randomUUID(): string;
  export function createPrivateKey(key: string | Uint8Array | KeyInput): KeyObject;
  export function createPublicKey(key: string | Uint8Array | KeyInput | KeyObject): KeyObject;
  export function createSecretKey(key: Uint8Array, encoding?: string): KeyObject;
  export function sign(algorithm: string | null, data: Uint8Array, key: KeyObject | KeyInput | string | Uint8Array): Buffer;
  export function verify(algorithm: string | null, data: Uint8Array, key: KeyObject | KeyInput | string | Uint8Array, signature: Uint8Array): boolean;
  export function generateKeyPairSync(
    type: 'ed25519' | 'rsa' | 'ec' | string,
    options?: Record<string, unknown>,
  ): { privateKey: KeyObject; publicKey: KeyObject };
  export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean;
  export const webcrypto: {
    subtle: unknown;
    getRandomValues<T extends Uint8Array>(array: T): T;
    randomUUID(): string;
  };
}

declare module 'crypto' {
  export * from 'node:crypto';
}

// ─── node:buffer ──────────────────────────────────────────
//
// Convenience re-export path for the Buffer class. Some code prefers the
// explicit `import { Buffer } from 'node:buffer'` over the global.

declare module 'node:buffer' {
  export { Buffer };
}

declare module 'buffer' {
  export * from 'node:buffer';
}

// ─── NodeJS namespace ─────────────────────────────────────
//
// Idiomatic Node typings live under `NodeJS.*`. Hooks reference
// `NodeJS.ErrnoException` (err.code narrowing in fs catch blocks),
// `NodeJS.Timeout` (setTimeout/setInterval return type), and
// `NodeJS.Signals` (process.kill signal arg). Minimal shim — extend as
// consumers demand.

declare namespace NodeJS {
  interface ErrnoException extends Error {
    code?: string;
    errno?: number;
    syscall?: string;
    path?: string;
  }

  interface Timeout {
    ref(): Timeout;
    unref(): Timeout;
    hasRef(): boolean;
    refresh(): Timeout;
  }

  interface Immediate {
    ref(): Immediate;
    unref(): Immediate;
    hasRef(): boolean;
  }

  type Signals =
    | 'SIGABRT' | 'SIGALRM' | 'SIGBUS' | 'SIGCHLD' | 'SIGCONT'
    | 'SIGFPE' | 'SIGHUP' | 'SIGILL' | 'SIGINT' | 'SIGIO' | 'SIGIOT'
    | 'SIGKILL' | 'SIGPIPE' | 'SIGPOLL' | 'SIGPROF' | 'SIGPWR'
    | 'SIGQUIT' | 'SIGSEGV' | 'SIGSTKFLT' | 'SIGSTOP' | 'SIGSYS'
    | 'SIGTERM' | 'SIGTRAP' | 'SIGTSTP' | 'SIGTTIN' | 'SIGTTOU'
    | 'SIGUNUSED' | 'SIGURG' | 'SIGUSR1' | 'SIGUSR2' | 'SIGVTALRM'
    | 'SIGWINCH' | 'SIGXCPU' | 'SIGXFSZ' | 'SIGBREAK' | 'SIGLOST' | 'SIGINFO';
}

// ─── node:url ─────────────────────────────────────────────

declare module 'node:url' {
  export class URL {
    constructor(input: string, base?: string);
    href: string;
    protocol: string;
    host: string;
    hostname: string;
    pathname: string;
    search: string;
    searchParams: URLSearchParams;
  }
  export function fileURLToPath(url: string | URL): string;
  export function pathToFileURL(path: string): URL;
}

declare module 'url' {
  export * from 'node:url';
}

// ─── yaml (npm package) ───────────────────────────────────
//
// Bun resolves `yaml` from the ambient module graph at runtime (Bun auto-
// installs transient deps for scripts). The LSP has no node_modules to
// look at, so we shim the minimal surface.

declare module 'yaml' {
  const yaml: {
    parse(source: string, options?: { uniqueKeys?: boolean | 'throw' }): unknown;
    stringify(value: unknown, options?: Record<string, unknown>): string;
  };
  export default yaml;
  export function parse(source: string, options?: { uniqueKeys?: boolean | 'throw' }): unknown;
  export function stringify(value: unknown, options?: Record<string, unknown>): string;
}

// ─── bun:test ─────────────────────────────────────────────
//
// Bun's test runner. Used by *.test.ts files.

declare module 'bun:test' {
  type TestFn = () => void | Promise<void>;
  export function describe(name: string, fn: () => void): void;
  export function test(name: string, fn: TestFn, timeoutMs?: number): void;
  export function it(name: string, fn: TestFn, timeoutMs?: number): void;
  export function beforeEach(fn: TestFn): void;
  export function afterEach(fn: TestFn): void;
  export function beforeAll(fn: TestFn): void;
  export function afterAll(fn: TestFn): void;
  interface Matchers {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toStrictEqual(expected: unknown): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toBeNull(): void;
    toBeUndefined(): void;
    toBeDefined(): void;
    toBeGreaterThan(n: number): void;
    toBeGreaterThanOrEqual(n: number): void;
    toBeLessThan(n: number): void;
    toBeLessThanOrEqual(n: number): void;
    toBeCloseTo(n: number, numDigits?: number): void;
    toBeInstanceOf(cls: unknown): void;
    toHaveProperty(key: string, value?: unknown): void;
    toMatchObject(obj: unknown): void;
    toHaveBeenCalled(): void;
    toHaveBeenCalledTimes(n: number): void;
    toHaveBeenCalledWith(...args: unknown[]): void;
    rejects: Matchers;
    resolves: Matchers;
    toContain(item: unknown): void;
    toHaveLength(n: number): void;
    toMatch(regex: RegExp | string): void;
    toThrow(error?: unknown): void;
    not: Matchers;
  }
  export function expect(value: unknown, hint?: string): Matchers;
  export const mock: {
    <T extends (...args: unknown[]) => unknown>(fn?: T): T & { mock: { calls: unknown[][]; results: unknown[] } };
  };
  interface Spy {
    mockImplementation(fn: (...args: unknown[]) => unknown): Spy;
    mockReturnValue(value: unknown): Spy;
    mockResolvedValue(value: unknown): Spy;
    mockRejectedValue(value: unknown): Spy;
    mockReset(): Spy;
    mockClear(): Spy;
    mockRestore(): void;
    mock: { calls: unknown[][]; results: unknown[] };
  }
  export const spyOn: <T, K extends keyof T>(obj: T, method: K) => Spy;
}
