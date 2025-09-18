import { X } from "lucide-react";
import {
    Notes
} from "../../../../declarations/shared-vault-canister-backend/shared-vault-canister-backend.did";
import { aesDecrypt, aesEncrypt } from "../crypto/encdcrpt";
import { SecurityNote } from "./types";
import { SecureNotesMap, serializeSecureNotes } from "@ghostkeys/ghostkeys-sdk";

export async function decrypt_and_adapt_notes(notes: Notes, fnKD: Uint8Array<ArrayBufferLike>) {
    const secure_notes : SecurityNote[] =  (
        await Promise.all(notes.notes.map(async ([x, entry]) => {
            const [name, content] = await Promise.all([
                aesDecrypt(Buffer.from(entry.label).toString(), fnKD),
                aesDecrypt(Buffer.from(entry.note).toString(), fnKD)
            ]);
            return {name, content, x};
        }))
    );
    return secure_notes;
}


export async function encryptSecureNotes(secureNotes: SecurityNote[], fnKD: Uint8Array): Promise<SecureNotesMap> {
   const secureNotesBeforeSer: SecureNotesMap = {};
    for (const entry of secureNotes) {
        const encryptedName = await aesEncrypt(entry.name, fnKD);
        const encryptedContent = await aesEncrypt(entry.content, fnKD);
        const index = entry.x;
        secureNotesBeforeSer[index] = { label: encryptedName, note: encryptedContent };
    }
    return secureNotesBeforeSer;
}

export async function encryptAndSerializeSecureNotes(secureNotes: SecurityNote[], fnKD: Uint8Array): Promise<Uint8Array<ArrayBufferLike>> {
    const secureNotesBeforeSer = await encryptSecureNotes(secureNotes, fnKD);
    const serializedSN = serializeSecureNotes(secureNotesBeforeSer);
    return serializedSN;
}