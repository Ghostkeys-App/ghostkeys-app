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

export type FlexGridDataKey = { col: number; row: number };

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

export type ICGridColumns = Array<[number, [Uint8Array | number[], boolean]]>


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


// SERIALIZER inside TYPES, I KNOW, SORRY
export type VaultNames = Array<{ vault_id: Uint8Array, vault_name: string }>;

export function serializeVaultNames(names: VaultNames) : Uint8Array {
  const chunks: number[] = [];
  
  for ( const x in names ) {
    if (!names[x]) continue;

    const vault_id = names[x].vault_id;
    const vault_name = names[x].vault_name;
    const name = new TextEncoder().encode(vault_name);
    const id_len = vault_id.length;
    const name_len = name.length;

    chunks.push(id_len & 0xff);
    chunks.push((name_len >> 8) & 0xff);
    chunks.push(name_len & 0xff);
    chunks.push(...vault_id);
    chunks.push(...name);
  }

  return new Uint8Array(chunks);
}