import { hmac } from '@noble/hashes/hmac';
import { sha512 } from '@noble/hashes/sha2';

const ED25519_CURVE = 'ed25519 seed super level encryption';

function ser32(i: number): Uint8Array {
  return new Uint8Array([(i >>> 24) & 0xff, (i >>> 16) & 0xff, (i >>> 8) & 0xff, i & 0xff]);
}

function concat(...arrs: Uint8Array[]): Uint8Array {
    const len = arrs.reduce((a, b) => a + b.length, 0);
    const out = new Uint8Array(len);
    let off = 0;
    for (const a of arrs) { out.set(a, off); off += a.length; }
    return out;
}

function CKDPriv(parentKey: Uint8Array, parentChainCode: Uint8Array, index: number) {
    // Ed25519 only supports hardened derivation
    const data = concat(new Uint8Array([0x00]), parentKey, ser32(index));
    const I = hmacSHA512(parentChainCode, data);
    return { key: I.slice(0, 32), chainCode: I.slice(32) };
}

function hmacSHA512(key: Uint8Array | string, data: Uint8Array): Uint8Array {
    return hmac.create(sha512, typeof key === 'string' ? new TextEncoder().encode(key) : key)
        .update(data).digest() as Uint8Array;
}

function masterKeyFromSeed(seed: Uint8Array) {
    const I = hmacSHA512(ED25519_CURVE, seed);
    return { key: I.slice(0, 32), chainCode: I.slice(32) };
}

function parsePath(path: string): number[] {
    if (!path || path === 'm') return [];
    if (!path.startsWith('m/')) throw new Error(`Invalid path: ${path}`);
    return path
        .slice(2)
        .split('/')
        .map((p) => {
            if (!p.endsWith("'")) throw new Error(`All segments must be hardened for ed25519: ${p}`);
            const n = parseInt(p.slice(0, -1), 10);
            if (!Number.isFinite(n) || n < 0) throw new Error(`Bad index: ${p}`);
            return n + 0x80000000;
        });
}

export const deriveSlip10Ed25519 = (seed: Uint8Array, path: string) => {
    const segments = parsePath(path);
    let { key, chainCode } = masterKeyFromSeed(seed);
    for (const idx of segments) {
        const child = CKDPriv(key, chainCode, idx);
        key = child.key;
        chainCode = child.chainCode;
    }
    return key; // 32-byte private key seed
}