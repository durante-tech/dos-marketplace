/**
 * identity.ts — Private-key read + sign. Server-independent for Phase 5a.
 *
 * Directory layout (per moat-relocation-2026-04-17.md §2.2):
 *
 *   ~/.claude/.dos-identity/
 *     ed25519.key     # raw 32-byte private key, 0600 REQUIRED
 *     public.key      # raw 32-byte public key, 0644
 *     key-id.txt      # UUID (Studio-issued in 5b; bootstrap-generated for now)
 *     metadata.json   # { createdAt, algorithm, rotatedFromKeyId? }
 *
 * Security posture:
 *   - Hard fail if private key file perms are wider than 0600 (security over convenience)
 *   - Use Node built-in `crypto` (no external dep)
 *   - Signature is raw 64-byte ed25519, emitted as base64url (no padding)
 */

import {
  createPrivateKey,
  createPublicKey,
  sign as nodeSign,
  verify as nodeVerify,
  KeyObject,
} from 'node:crypto';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { canonicalize } from './canonical-json';
import type { ReceiptPayloadV1, SignedReceiptV1 } from './receipt-types';

export const IDENTITY_DIR = join(homedir(), '.claude', '.dos-identity');
export const PRIVATE_KEY_PATH = join(IDENTITY_DIR, 'ed25519.key');
export const PUBLIC_KEY_PATH = join(IDENTITY_DIR, 'public.key');
export const KEY_ID_PATH = join(IDENTITY_DIR, 'key-id.txt');

export interface Identity {
  keyId: string;
  privateKey: KeyObject;
  publicKey: KeyObject;
}

export class IdentityPermissionError extends Error {
  constructor(path: string, mode: number) {
    super(
      `Identity key at ${path} has permissions 0${(mode & 0o777).toString(8)}; ` +
        `required 0600. Fix with: chmod 600 ${path}`,
    );
    this.name = 'IdentityPermissionError';
  }
}

function assertTightPerms(path: string): void {
  const st = statSync(path);
  const mode = st.mode & 0o777;
  if (mode !== 0o600) {
    throw new IdentityPermissionError(path, mode);
  }
}

function rawToPkcs8(raw32: Buffer): Buffer {
  // ed25519 PKCS#8 DER prefix for a raw 32-byte seed.
  // DER: SEQUENCE { INTEGER 0, SEQUENCE { OID 1.3.101.112 }, OCTET STRING { OCTET STRING raw32 } }
  const prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
  return Buffer.concat([prefix, raw32]);
}

function rawToSpki(raw32: Buffer): Buffer {
  // ed25519 SubjectPublicKeyInfo DER prefix for a raw 32-byte public key.
  const prefix = Buffer.from('302a300506032b6570032100', 'hex');
  return Buffer.concat([prefix, raw32]);
}

/** Load identity from disk. Returns null if no key file exists (onboarding not done). */
export function readIdentity(): Identity | null {
  if (!existsSync(PRIVATE_KEY_PATH)) return null;
  assertTightPerms(PRIVATE_KEY_PATH);

  const rawPriv = readFileSync(PRIVATE_KEY_PATH);
  if (rawPriv.length !== 32) {
    throw new Error(
      `ed25519 private key must be 32 bytes raw; got ${rawPriv.length} bytes at ${PRIVATE_KEY_PATH}`,
    );
  }
  const privateKey = createPrivateKey({
    key: rawToPkcs8(rawPriv),
    format: 'der',
    type: 'pkcs8',
  });

  if (!existsSync(PUBLIC_KEY_PATH)) {
    throw new Error(`Public key missing at ${PUBLIC_KEY_PATH}; run identity-bootstrap.ts`);
  }
  const rawPub = readFileSync(PUBLIC_KEY_PATH);
  if (rawPub.length !== 32) {
    throw new Error(
      `ed25519 public key must be 32 bytes raw; got ${rawPub.length} bytes at ${PUBLIC_KEY_PATH}`,
    );
  }
  const publicKey = createPublicKey({
    key: rawToSpki(rawPub),
    format: 'der',
    type: 'spki',
  });

  if (!existsSync(KEY_ID_PATH)) {
    throw new Error(`key-id.txt missing at ${KEY_ID_PATH}; run identity-bootstrap.ts`);
  }
  const keyId = readFileSync(KEY_ID_PATH, 'utf8').trim();
  if (keyId.length === 0) {
    throw new Error(`key-id.txt at ${KEY_ID_PATH} is empty`);
  }

  return { keyId, privateKey, publicKey };
}

/** Base64url encode a Buffer (RFC 4648 §5, no padding). */
export function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Sign a canonical payload with the identity's private key. */
export function sign(payload: ReceiptPayloadV1, identity: Identity): SignedReceiptV1 {
  const canonical = canonicalize(payload);
  const sigBuf = nodeSign(null, Buffer.from(canonical, 'utf8'), identity.privateKey);
  return { payload, signature: base64url(sigBuf) };
}

/**
 * Sign arbitrary bytes with the identity's private key. Returns base64url (no padding).
 * Used by RFC-0007 §5.7: executor signs `receipt_sha256` and each attestation signs
 * `receipt_sha256 || attestation_type || validator_role`.
 */
export function signBytes(bytes: Buffer, identity: Identity): string {
  const sigBuf = nodeSign(null, bytes, identity.privateKey);
  return base64url(sigBuf);
}

/** Verify a base64url ed25519 signature over arbitrary bytes. */
export function verifyBytes(
  signature: string,
  bytes: Buffer,
  publicKey: KeyObject,
): boolean {
  const padded = signature + '='.repeat((4 - (signature.length % 4)) % 4);
  const sigBuf = Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  return nodeVerify(null, bytes, publicKey, sigBuf);
}

/** Verify helper (used by tests and Phase 5b Studio-side verification). */
export function verify(
  signed: SignedReceiptV1,
  publicKey: KeyObject,
): boolean {
  const { verify: nodeVerify } = require('node:crypto') as typeof import('node:crypto');
  const canonical = canonicalize(signed.payload);
  // base64url -> base64 -> Buffer
  const padded = signed.signature + '='.repeat((4 - (signed.signature.length % 4)) % 4);
  const sigBuf = Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  return nodeVerify(null, Buffer.from(canonical, 'utf8'), publicKey, sigBuf);
}
