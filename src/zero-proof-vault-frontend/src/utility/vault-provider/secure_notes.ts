import {
    Notes
} from "../../../../declarations/shared-vault-canister-backend/shared-vault-canister-backend.did";
import { aesDecrypt, aesEncrypt } from "../crypto/encdcrpt";
import { SecurityNote } from "./types";
import { Buffer } from "buffer";
import { SecureNotesMap, serializeSecureNotes } from "@ghostkeys/ghostkeys-sdk";

export async function decrypt_and_adapt_notes(notes: Notes, fnKD: Uint8Array<ArrayBufferLike>): Promise<SecurityNote[]> {
    const secure_notes: SecurityNote[] = [];
    for (const [x, note] of notes.notes) {
        const labelStr = Buffer.from(note.label).toString();
        const noteStr = Buffer.from(note.note).toString();
        try {
            const labelDcrp = await aesDecrypt(labelStr, fnKD);
            const noteDcrp = await aesDecrypt(noteStr, fnKD);
            secure_notes.push({ name: labelDcrp, content: noteDcrp, x, committed: true });
        } catch (e) {
            console.log("Error on dycript", JSON.stringify(e));
        }
    }
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