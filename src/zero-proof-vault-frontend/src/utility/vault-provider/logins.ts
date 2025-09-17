import { X } from "lucide-react";
import {
    Logins
} from "../../../../declarations/shared-vault-canister-backend/shared-vault-canister-backend.did";
import {
    WebsiteLogin
} from "./types"

export async function decrypt_and_adapt_logins(logins: Logins, fnKD: Uint8Array<ArrayBufferLike>) {
    return await Promise.all(logins.columns.map(async ([x, column]) => {
        const label = column.label;
        
    }));
}