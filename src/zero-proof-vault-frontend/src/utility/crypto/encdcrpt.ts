import { sha256 } from "@noble/hashes/sha2";
import { hkdf } from "@noble/hashes/hkdf";
import { english, generateMnemonic } from 'viem/accounts';
import { Principal } from "@dfinity/principal";
import { mnemonicToSeed } from "@scure/bip39";
import { Ed25519KeyIdentity } from "@dfinity/identity";
import { TransportSecretKey } from '@dfinity/vetkeys';
import { deriveSlip10Ed25519 } from "./SLIP_0010";
import { concatBytes } from "@noble/hashes/utils";
import { GhostkeysVetKdArgs } from "../../../../declarations/shared-vault-canister-backend/shared-vault-canister-backend.did";

/*
    Module for all encryption-related operations on frontend
*/

// Using this for extra layer of protection
const VAULT_SALT = "ghostkeys:client:v1|";
const USER_SALT = "ghostkeys:kdf:v1";
const DEFAULT_PURPOSE = "encrypt-vault";
const DEFAULT_ROTATION = 0;

// Derive principal
export const derivePrincipalAndIdentityFromSeed = async (seed: string): Promise<{ identity: Ed25519KeyIdentity, principal: Principal }> => {
    const keySpecificSeed64 = await mnemonicToSeed(seed);
    const secret = deriveSlip10Ed25519(keySpecificSeed64, "m/44'/223'/0'/0'/0'");
    const identity = Ed25519KeyIdentity.fromSecretKey(secret.buffer);
    const principal = identity.getPrincipal();
    return { identity, principal };
}

// Generate seed + derive ICP principal from it
export const generateSeedAndIdentityPrincipal = async (): Promise<{ seed: string, identity: Ed25519KeyIdentity, principal: Principal }> => {
    const seed = generateMnemonic(english, 128); // 12 words (128-bit entropy)
    const { identity, principal } = await derivePrincipalAndIdentityFromSeed(seed);
    return { seed, identity, principal };
};

export const deriveSignatureFromPublicKey = async (publicKey: string, identity: Ed25519KeyIdentity): Promise<Uint8Array> => {
    const signature = await identity.sign(new TextEncoder().encode(VAULT_SALT + publicKey).buffer);
    const keyMaterial = await crypto.subtle.digest("SHA-256", signature);
    const derivedKey = new Uint8Array(keyMaterial).slice(0, 32);
    return derivedKey;
};

export const deriveFinalKey = async (keyVault: Uint8Array, vetKD: Uint8Array): Promise<Uint8Array> => {
    const salt = sha256(VAULT_SALT + USER_SALT);
    const finalKey = hkdf(sha256, concatBytes(keyVault, vetKD), salt, DEFAULT_PURPOSE, 32);
    return finalKey;
}

const deriveInputFromUser = async (userId: string, purpose?: string, rotateCtr?: number): Promise<Uint8Array> => {
    const enc = new TextEncoder();
    const label = enc.encode(`${USER_SALT}|${userId}|${purpose ?? DEFAULT_PURPOSE}|${rotateCtr ?? DEFAULT_ROTATION}`);
    const h = await crypto.subtle.digest("SHA-256", label);
    return new Uint8Array(h).slice(0, 32);
}

export const generateGhostKeysArgs = async (userId: Principal): Promise<GhostkeysVetKdArgs> => {
    const scope = { PerUser: { user: userId } };
    const input = await deriveInputFromUser(userId.toString());
    const randomEntropy = TransportSecretKey.random();
    const transport_public_key = randomEntropy.publicKeyBytes();
    return { scope, input, transport_public_key }
}

export const aesEncrypt = async (data: string, key: Uint8Array) => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(data);

    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        new Uint8Array(key),
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

export const aesDecrypt = async (blob: string, key: Uint8Array) => {
    const raw = Uint8Array.from(atob(blob), c => c.charCodeAt(0));
    const iv = raw.slice(0, 12);
    const ciphertext = raw.slice(12);

    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        new Uint8Array(key),
        { name: "AES-GCM" },
        false,
        ["decrypt"]
    );

    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, ciphertext);
    return new TextDecoder().decode(decrypted);
};
