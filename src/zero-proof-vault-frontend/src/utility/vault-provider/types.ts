import { LoginsMetadataMap, SpreadsheetMap } from "@ghostkeys/ghostkeys-sdk";

export type WebsiteLogin = {
    name: string;
    entries: WebsiteLoginEntry[];
}

export type WebsiteLoginEntry = {
    login: string;
    password: string;
}

export type SecurityNote = {
    name: string;
    content: string;
    x: number;
}

export type FlexibleGridCell = {
    key: FlexGridDataKey;
    value: string
}

export type FlexibleGridColumn = {
    name: string;
    meta: {
        index: number;
        hidden: boolean
    };
}

export type ICGridColumns = [number, [number[] | Uint8Array<ArrayBufferLike>, boolean]]
export type ICGridColumnsArray = Array<[number, [number[] | Uint8Array<ArrayBufferLike>, boolean]]>

export type FlexGridDataKey = { col: number; row: number };

export type VaultData = {
    flexible_grid_columns: FlexibleGridColumn[];
    secure_notes: SecurityNote[];
    flexible_grid: FlexibleGridCell[];
    website_logins: WebsiteLogin[];
};

export type Vault = {
    vaultID: string;
    vaultName: string;
    icpPublicAddress: string;
    synced: boolean;
    data: VaultData;
    existsOnIc: boolean
};

// IC Specific types
export type ICVaultDataGlobalSync = Uint8Array; // has information of the whole current vault

// SDK types
export type EnctypedWebsiteLoginsObj = { meta: LoginsMetadataMap, logins: SpreadsheetMap };
export type SerializedWebsiteLoginsObj = {meta: Uint8Array<ArrayBufferLike>, logins: Uint8Array<ArrayBufferLike>};