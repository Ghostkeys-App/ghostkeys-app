import {
    Notes
} from "../../../../declarations/shared-vault-canister-backend/shared-vault-canister-backend.did";
import { aesDecrypt, aesEncrypt } from "../crypto/encdcrpt";
import { SecurityNote } from "./types";
import { Buffer } from "buffer";
import { SecureNotesMap, serializeSecureNotes } from "@ghostkeys/ghostkeys-sdk";

export async function decrypt_and_adapt_notes(notes: Notes, fnKD: Uint8Array<ArrayBufferLike>): Promise<SecurityNote[]> {
    const secure_notes: SecurityNote[] = [];
    console.log("SECURE NOTES DEBUG");
    for (const [x, note] of notes.notes) {
        console.log('x', x);
        const labelStr = Buffer.from(note.label).toString();
        console.log('labelStr', labelStr);
        const noteStr = Buffer.from(note.note).toString();
        console.log('noteStr', noteStr);
        try {
            const labelDcrp = await aesDecrypt(labelStr, fnKD);
            console.log('labelDcrp', labelDcrp);
            const noteDcrp = await aesDecrypt(noteStr, fnKD);
            console.log('noteDcrp', noteDcrp);
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