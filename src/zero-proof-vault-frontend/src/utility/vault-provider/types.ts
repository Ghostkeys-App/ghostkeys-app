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