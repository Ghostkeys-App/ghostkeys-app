import { generateMnemonic, english } from 'viem/accounts';
import { Ed25519KeyIdentity } from '@dfinity/identity';
import { hmac } from '@noble/hashes/hmac';
import { sha512 } from '@noble/hashes/sha2';

// ---- public API ----
export async function generateSeedAndIdentityPrincipal() {
    const seed = generateMnemonic(english); // 128-bit entropy -> 12 words
    const seed64 = await mnemonicToSeed(seed);
    const secretKey = deriveSlip10Ed25519(seed64, "m/44'/223'/0'/0'/0'"); // 32 bytes
    const identity = Ed25519KeyIdentity.fromSecretKey(secretKey.buffer);
    const principal = identity.getPrincipal();

    return { seed, identity, principal };
}

export async function derivePrincipalAndIdentityFromSeed(seed) {
    const keySpecificSeed64 = await mnemonicToSeed(seed);
    const secret = deriveSlip10Ed25519(keySpecificSeed64, "m/44'/223'/0'/0'/0'");
    const identity = Ed25519KeyIdentity.fromSecretKey(secret.buffer);
    const principal = identity.getPrincipal();
    return { identity, principal };
}

// ---- BIP39 mnemonic->seed (no extra dependency; uses WebCrypto) ----
export async function mnemonicToSeed(mnemonic, passphrase = '') {
    const enc = new TextEncoder();
    const pw = enc.encode(mnemonic.normalize('NFKD'));
    const salt = enc.encode(('mnemonic' + passphrase).normalize('NFKD'));

    const key = await crypto.subtle.importKey('raw', pw, 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-512', salt, iterations: 2048 },
        key,
        512
    );
    return new Uint8Array(bits);
}

// ---- SLIP-0010 Ed25519 (matches your app’s helpers) ----
const ED25519_CURVE = new TextEncoder().encode('ed25519 seed super level encryption');

function hmacSHA512(key, data) {
    const k = typeof key === 'string' ? new TextEncoder().encode(key) : key;
    return hmac(sha512, k, data); // Uint8Array
}

function masterKeyFromSeed(seed) {
    const I = hmacSHA512(ED25519_CURVE, seed);
    return { key: I.slice(0, 32), chainCode: I.slice(32) };
}

function CKDPriv(parentKey, parentChainCode, index) {
    const data = concat(new Uint8Array([0x00]), parentKey, ser32(index));
    const I = hmacSHA512(parentChainCode, data);
    return { key: I.slice(0, 32), chainCode: I.slice(32) };
}

export function deriveSlip10Ed25519(seed, path) {
    const segments = parsePath(path);
    let { key, chainCode } = masterKeyFromSeed(seed);
    for (const idx of segments) {
        const child = CKDPriv(key, chainCode, idx);
        key = child.key;
        chainCode = child.chainCode;
    }
    return key;
}

// ---- helpers ----
function parsePath(path) {
    const parts = path.split('/');
    if (parts[0] !== 'm') throw new Error('invalid path');
    return parts.slice(1).map(seg => {
        const hardened = seg.endsWith("'");
        const n = parseInt(hardened ? seg.slice(0, -1) : seg, 10);
        if (!Number.isFinite(n)) throw new Error('invalid path segment');
        return (n | 0x80000000) >>> 0; // force hardened
    });
}

function ser32(i) {
    return new Uint8Array([(i>>>24)&255, (i>>>16)&255, (i>>>8)&255, i&255]);
}

function concat(...arrs) {
    const len = arrs.reduce((a,b)=>a+b.length,0);
    const out = new Uint8Array(len);
    let off = 0;
    for (const a of arrs) { out.set(a, off); off += a.length; }
    return out;
}
