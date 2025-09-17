import { X } from "lucide-react";
import {
    Notes
} from "../../../../declarations/shared-vault-canister-backend/shared-vault-canister-backend.did";
import { aesDecrypt } from "../crypto/encdcrpt";
import { SecurityNote } from "./types";

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