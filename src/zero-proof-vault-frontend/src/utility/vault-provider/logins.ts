import { X } from "lucide-react";
import {
    Logins
} from "../../../../declarations/shared-vault-canister-backend/shared-vault-canister-backend.did";
import {
    EnctypedWebsiteLoginsObj,
    SerializedWebsiteLoginsObj,
    WebsiteLogin,
    WebsiteLoginEntry
} from "./types"
import { aesDecrypt, aesEncrypt } from "../crypto/encdcrpt";
import { LoginsMetadataMap, serializeLoginsMetadata, serializeSpreadsheet, SpreadsheetMap } from "@ghostkeys/ghostkeys-sdk";

export async function decrypt_and_adapt_logins(logins: Logins, fnKD: Uint8Array<ArrayBufferLike>): Promise<WebsiteLogin[]> {
    const website_logins: WebsiteLogin[] = [];
    for (const [loginIndex, loginColumn] of logins.columns) {
        const labelStr = Buffer.from(loginColumn.label).toString();
        const labelDcrp = await aesDecrypt(labelStr, fnKD);
        const entries: WebsiteLoginEntry[] = [];
        for (const [loginEntryIndex, userPassCell] of loginColumn.rows) {
            const userPassStr = Buffer.from(userPassCell).toString();
            const userPassDecrpt = await aesDecrypt(userPassStr, fnKD);
            const breakIndex = parseInt(userPassDecrpt[0]);
            const user = userPassDecrpt.slice(1, breakIndex);
            const pass = userPassDecrpt.slice(breakIndex);
            entries[loginEntryIndex] = {login: user, password: pass};
        }
        website_logins[loginIndex] = {name: labelDcrp, entries};
    }
    return website_logins;
}

export const concatUserPass = (user: string, pass: string): string => `${user.length}${user}${pass}`;

export async function encryptWebsiteLoginsAndMetadata(loginsData: WebsiteLogin[], fnKD: Uint8Array): Promise<EnctypedWebsiteLoginsObj> {
    const loginsMeta: LoginsMetadataMap = {};
    const loginsCells: SpreadsheetMap = {};
    let entry: WebsiteLogin;
    for (let i = 0; i < loginsData.length; i++) {
        entry = loginsData[i];
        const encryptedName = await aesEncrypt(entry.name, fnKD);
        loginsMeta[i] = encryptedName;
        let tempFlexCell: { [y: number]: string } = {};
        for (let j = 0; j < entry.entries.length; j++) {
            const userPass = concatUserPass(entry.entries[j].login, entry.entries[j].password);
            const encryptedUserPass = await aesEncrypt(userPass, fnKD);
            tempFlexCell[j] = encryptedUserPass;
        }
        loginsCells[i] = tempFlexCell;
        tempFlexCell = {};
    }
    return { meta: loginsMeta, logins: loginsCells };
}

export async function encryptAndSerializeWebsiteLoginsAndMetadata(loginsData: WebsiteLogin[], fnKD: Uint8Array): Promise<SerializedWebsiteLoginsObj> {
    const { meta, logins } = await encryptWebsiteLoginsAndMetadata(loginsData, fnKD);
    const serializedMeta = serializeLoginsMetadata(meta);
    const serializedLogins = serializeSpreadsheet(logins);
    return { meta: serializedMeta, logins: serializedLogins };
}