import { X } from "lucide-react";
import {
    Logins
} from "../../../../declarations/shared-vault-canister-backend/shared-vault-canister-backend.did";
import {
    WebsiteLogin,
    WebsiteLoginEntry
} from "./types"
import { aesDecrypt } from "../crypto/encdcrpt";

export async function decrypt_and_adapt_logins(logins: Logins, fnKD: Uint8Array<ArrayBufferLike>) {
    return await Promise.all(logins.columns.map(async ([x, column]) => {
        const name = await aesDecrypt(Buffer.from(column.label).toString(), fnKD);
        const entries = await Promise.all(column.rows.map(async ([y, details]) => {
            const [login, password] = await Promise.all([
                aesDecrypt(Buffer.from(details.username).toString(), fnKD),
                aesDecrypt(Buffer.from(details.password).toString(), fnKD)
            ]);
            return {login, password} as WebsiteLoginEntry
        }));
        return {name, entries} as WebsiteLogin
    }));
}