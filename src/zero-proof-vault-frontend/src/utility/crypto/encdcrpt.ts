// vaultCrypto.ts
import { sha256 } from "@noble/hashes/sha2";
import { hkdf } from "@noble/hashes/hkdf";
import { english, generateMnemonic } from 'viem/accounts';
import { Principal } from "@dfinity/principal";
import { mnemonicToSeed } from "@scure/bip39";
import { Ed25519KeyIdentity } from "@dfinity/identity";
import { derivePath } from "ed25519-hd-key";

/*
    Module for all encryption-related operations on frontend
*/

const VAULT_KDF_MSG = "vault-key-derivation-v1";

// Derive principal
export const derivePrincipalFromSeed = async (seed: string): Promise<Principal> => {
    const keySpecificSeed64 = (await mnemonicToSeed(seed)).toString();
    const { key: sk } = derivePath(`m/44'/223'/0'/0'/0'`, keySpecificSeed64); // 32-byte Ed25519 secret
    const identity = Ed25519KeyIdentity.fromSecretKey(sk);
    const principal = identity.getPrincipal(); 
    return principal;
}

// Generate seed + derive ICP principal from it
export const generateSeedAndPrincipal = async (): Promise<{ seed: string, principal: Principal }> => {
    const seed = generateMnemonic(english, 128); // 12 words (128-bit entropy)
    const principal = await derivePrincipalFromSeed(seed);
    return { seed, principal };
};

export const deriveVaultKey = async () => {
    const provider = (window as any).solana;
    const msg = new TextEncoder().encode(VAULT_KDF_MSG);
    const { signature } = await provider.signMessage(msg, "utf8");

    return hkdf(sha256, signature, msg, msg, 32); // AES key: 32 bytes
};

const aesEncrypt = async (data: string, key: Uint8Array) => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(data);

    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        key,
        { name: "AES-GCM" },
        false,
        ["encrypt"]
    );

    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, encoded);
    const encryptedData = new Uint8Array(iv.length + ciphertext.byteLength);
    encryptedData.set(iv);
    encryptedData.set(new Uint8Array(ciphertext), iv.length);

    return btoa(String.fromCharCode(...encryptedData));
};

const aesDecrypt = async (blob: string, key: Uint8Array) => {
    const raw = Uint8Array.from(atob(blob), c => c.charCodeAt(0));
    const iv = raw.slice(0, 12);
    const ciphertext = raw.slice(12);

    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        key,
        { name: "AES-GCM" },
        false,
        ["decrypt"]
    );

    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, ciphertext);
    return new TextDecoder().decode(decrypted);
};

export const encryptMetaBlob = async (url: string, username: string, key: Uint8Array) => {
    const composite = JSON.stringify({ url, username });
    return aesEncrypt(composite, key);
};

export const decryptMetaBlob = async (blob: string, key: Uint8Array) => {
    const decrypted = await aesDecrypt(blob, key);
    return JSON.parse(decrypted);
};

export const encryptPasswordBlob = async (password: string, key: Uint8Array) => {
    return aesEncrypt(password, key);
};

export const decryptPasswordBlob = async (blob: string, key: Uint8Array) => {
    return aesDecrypt(blob, key);
};