import {createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState} from "react";
import LoadingAnimation from "../../components/NotFound/LoadingAnimation";
import { useIdentitySystem } from "../identity";
import {deriveSignatureFromPublicKey, generateSeedAndIdentityPrincipal} from "../crypto/encdcrpt.ts";
import {useAPIContext} from "../api/APIContext.tsx";
import {
    VaultData as BEVaultData
} from "../../../../declarations/shared-vault-canister-backend/shared-vault-canister-backend.did";
// import { decryptPasswordBlob, encryptPasswordBlob } from "../crypto/encdcrpt";

export type WebsiteLogin = {
    name: string;
    entries: WebsiteLoginEntry[];
}

export type WebsiteLoginEntry = {
    login: string;
    password: string;
}

export type FlexGridDataKey = { col: number; row: number };

export type VaultData = {
    flexible_grid_columns: Array<{ name: string; meta: { index: number; hidden: boolean } }>;
    secure_notes: Array<{ id: string; content: string }>;
    flexible_grid: Array<{ key: FlexGridDataKey; value: string }>;
    website_logins: WebsiteLogin[];
};

export type Vault = {
    vaultID: string;
    vaultName: string;
    icpPublicAddress: string;
    synced: boolean;
    data: VaultData;
};

export const DB_NAME_VAULTS = "Ghostkeys-persistent-vaults";
export const DB_VERSION_VAULTS = 1;
export const VAULTS_STORE_VAULTS = "vaults";

export type State = Readonly<{
    syncedWithStable: boolean;
    currentVaultId: string | null;
    currentVault: Vault | null;
    vaults: Vault[];
}>;

export type Actions = {
    createVault(vaultName: string): Promise<Vault>;
    switchVault(vaultID: string): void;
    renameVault(vaultID: string, newName: string): Promise<Vault | undefined>;
    deleteVault(vaultID: string): Promise<void>;

    saveLoginsToIDB(website_logins: WebsiteLogin[]): Promise<Vault>;
    syncVaultWithBackend(): Promise<void>;
}

const VaultStateContext = createContext<State | null>(null);
const VaultActionsContext = createContext<Actions | null>(null);

export function VaultContextProvider({ children }: { children: ReactNode }) {
    const db = useRef<IDBDatabase | null>(null);
    const { currentProfile } = useIdentitySystem();
    const { getSharedVaultCanisterAPI } = useAPIContext();

    const [isReady, setIsReady] = useState(false);
    const [syncedWithStable, setSyncedWithStable] = useState(false);
    const [currentVaultId, setCurrentVaultId] = useState<string | null>(null);
    const [vaults, setVaults] = useState<Vault[]>([]);

    const currentVault = useMemo(
        () => vaults.find(v => v.vaultID === currentVaultId) ?? null,
        [vaults, currentVaultId]
    );

    useEffect(() => {
        const synced = vaults.every((v) => v.synced);
        setSyncedWithStable(synced)
    }, [vaults]);

    useEffect(() => {
        const initIDB = async () => {
            const request = indexedDB.open(DB_NAME_VAULTS, DB_VERSION_VAULTS);

            request.onupgradeneeded = (e) => {
                const db = (e.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(VAULTS_STORE_VAULTS)) {
                    db.createObjectStore(VAULTS_STORE_VAULTS, { keyPath: "vaultID" });
                }
            };

            request.onsuccess = async (e) => {
                db.current = (e.target as IDBOpenDBRequest).result;
                await bootstrap();
                setIsReady(true);
            };
        };
        initIDB();
    }, []);

    const bootstrap = async () => {
        if (!db.current) throw new Error("DB not initialized");

        const tx = db.current.transaction(VAULTS_STORE_VAULTS, "readonly");
        const store = tx.objectStore(VAULTS_STORE_VAULTS);
        const req = store.getAll();
        const allVaults: Vault[] = await new Promise((res, rej) => {
            req.onsuccess = () => res(req.result as Vault[]);
            req.onerror = () => rej("Failed to list vaults");
        });

        if (allVaults.length > 0) {
            setVaults(allVaults);
            setCurrentVaultId(allVaults[0].vaultID);
            setSyncedWithStable(true);

            // TEST
            setTimeout(async () => {
                console.log('START test');
                const req = await getSharedVaultCanisterAPI();
                const response = await req.get_all_vaults_for_user(currentProfile.principal.toString());
                console.log('SUCCESS! test', response);
            }, 3000)
        } else {
            if (!currentProfile) {
                console.error("No current profile or ICP public address found");
                return;
            }
            try {
                await createVault('Personal Vault');
            } catch (error) {
                console.error(error);
                return;
            }
        }
    };

    // Actions callbacks
    const createVault = useCallback(async (vaultName: string): Promise<Vault> => {
        if (!currentProfile) throw new Error("No profile set");

        const { principal } = await generateSeedAndIdentityPrincipal();
        const vaultID = `Vault_${principal.toString()}`;
        const newVault: Vault = {
            vaultID,
            vaultName,
            icpPublicAddress: principal.toString(),
            synced: false,
            data: {
                flexible_grid_columns: [],
                secure_notes: [],
                flexible_grid: [],
                website_logins: [],
            }
        };
        if (!db.current) throw new Error("DB not initialized");
        await new Promise<void>((res, rej) => {
            const tx = db.current!.transaction(VAULTS_STORE_VAULTS, "readwrite");
            const store = tx.objectStore(VAULTS_STORE_VAULTS);
            const req = store.put(newVault);

            req.onerror = () => rej(req.error);
            tx.onabort = () => rej(tx.error ?? new Error("IDB tx aborted"));
            tx.onerror = () => rej(tx.error ?? new Error("IDB tx error"));
            tx.oncomplete = () => res();
        });

        setVaults((vaults) => [...vaults, newVault]);
        setCurrentVaultId(newVault.vaultID);
        return newVault;
    }, []);

    const deleteVault = useCallback(async (vaultID: string): Promise<void> => {
        if (!currentProfile) throw new Error("No profile set");
        if (!db.current) throw new Error("DB not initialized");

        await new Promise<void>((res, rej) => {
            const tx = db.current!.transaction(VAULTS_STORE_VAULTS, "readwrite");
            const store = tx.objectStore(VAULTS_STORE_VAULTS);
            const req = store.delete(vaultID);

            req.onerror = () => rej(req.error);
            tx.onabort = () => rej(tx.error ?? new Error("IDB tx aborted"));
            tx.onerror = () => rej(tx.error ?? new Error("IDB tx error"));
            tx.oncomplete = () => res();
        });

        // TODO: handle removing last vault
        setVaults((vaults) => vaults.filter((v) => v.vaultID != vaultID));
        setCurrentVaultId(vaults.filter((v) => v.vaultID != vaultID)[0].vaultID);
    }, []);

    const renameVault = useCallback(async (vaultID: string, newName: string): Promise<Vault | undefined> => {
        if (!currentProfile) throw new Error("No profile set");
        if (!db.current) throw new Error("DB not initialized");

        const updatedVault = await new Promise<Vault | undefined>((resolve, reject) => {
            const tx = db.current!.transaction(VAULTS_STORE_VAULTS, "readwrite");
            const store = tx.objectStore(VAULTS_STORE_VAULTS);

            let result: Vault | undefined;

            tx.oncomplete = () => resolve(result);
            tx.onabort = () => reject(tx.error ?? new Error("IDB tx aborted"));
            tx.onerror = () => reject(tx.error ?? new Error("IDB tx error"));

            const getReq = store.get(vaultID);
            getReq.onerror = () => reject(getReq.error);
            getReq.onsuccess = () => {
                const row = getReq.result as Vault | undefined;
                if (!row) { result = undefined; return; }

                const next: Vault = { ...row, vaultName: newName, synced: false };
                result = next;

                const putReq = store.put(next);
                putReq.onerror = () => reject(putReq.error);
            };
        });

        if (updatedVault) {
            setVaults((vaults) => [...vaults, updatedVault]);
        }

        return updatedVault;
    }, []);

    const switchVault = useCallback((vaultID: string) => {
        setCurrentVaultId(vaultID);
    }, []);

    const saveLoginsToIDB = useCallback(async (website_logins: WebsiteLogin[]): Promise<Vault> => {
        if (!currentProfile) throw new Error("No profile set");
        if (!currentVault) throw new Error("No current vault set");

        const updatedVault: Vault = {
            vaultID: currentVaultId!,
            vaultName: currentVault.vaultName!,
            icpPublicAddress: currentVault.icpPublicAddress,
            synced: false,
            data: {
                ...currentVault.data,
                website_logins
            }
        };

        if (!db.current) throw new Error("DB not initialized");
        await new Promise<void>((res, rej) => {
            const tx = db.current!.transaction(VAULTS_STORE_VAULTS, "readwrite");
            const store = tx.objectStore(VAULTS_STORE_VAULTS);
            const req = store.put(updatedVault);

            req.onerror = () => rej(req.error);
            tx.onabort = () => rej(tx.error ?? new Error("IDB tx aborted"));
            tx.onerror = () => rej(tx.error ?? new Error("IDB tx error"));
            tx.oncomplete = () => res();
        });

        setVaults((vaults) => vaults.map((v) => v.vaultID == currentVaultId ? updatedVault : v));
        return updatedVault;
    }, [currentProfile, currentVault]);

    function toBEVaultData(data: VaultData, vault_name: string): BEVaultData {
        const flexible_grid_columns: Array<[string, [number, boolean]]> =
            (data.flexible_grid_columns ?? []).map((c, i) => {
                const name = c?.name ?? `Col ${i + 1}`;
                const index = typeof c?.meta?.index === "number" ? c.meta.index : i;
                const hidden = !!c?.meta?.hidden;
                return [String(name), [index >>> 0, hidden]];
            });

        const secure_notes: Array<[string, string]> =
            (data.secure_notes ?? []).map(n => [
                String(n?.id ?? crypto.randomUUID()),
                String(n?.content ?? ""),
            ]);

        const flexible_grid: Array<[FlexGridDataKey, string]> =
            (data.flexible_grid ?? []).map(cell => [
                { col: (cell?.key?.col ?? 0) >>> 0, row: (cell?.key?.row ?? 0) >>> 0 },
                String(cell?.value ?? ""),
            ]);

        const website_logins: Array<[string, Array<[string, string]>]> =
            (data.website_logins ?? []).map(site => [
                String(site?.name ?? ""),
                (site?.entries ?? []).map(e => [String(e?.login ?? ""), String(e?.password ?? "")]),
            ]);

        return { flexible_grid_columns, secure_notes, flexible_grid, website_logins, vault_name };
    }

    const syncVaultWithBackend = useCallback(async (): Promise<void> => {
        if (!currentProfile) throw new Error("No profile set");
        if (!currentVault) throw new Error("No current vault set");

        const payload = toBEVaultData(currentVault.data, currentVault.vaultName);
        console.log('START', payload);
        const req = await getSharedVaultCanisterAPI();
        const response = await req.add_or_update_vault(currentProfile.principal.toString(), currentVault.vaultID, payload);
        console.log('SUCCESS!', response);
    }, [currentProfile, currentVault]);

    const state = useMemo<State>(
        () => ({ vaults, syncedWithStable, currentVault, currentVaultId }),
        [vaults, syncedWithStable, currentVault, currentVaultId]
    );

    const actions = useMemo<Actions>(
        () => ({ createVault, deleteVault, renameVault, switchVault, saveLoginsToIDB, syncVaultWithBackend }),
        [createVault, deleteVault, renameVault, switchVault, saveLoginsToIDB, syncVaultWithBackend]
    );

    if (!isReady) return <LoadingAnimation />;
    return (
        <VaultStateContext.Provider value={state}>
            <VaultActionsContext.Provider value={actions}>
                {children}
            </VaultActionsContext.Provider>
        </VaultStateContext.Provider>
    );
};

export function useVaultProviderState() {
    const ctx = useContext(VaultStateContext);
    if (!ctx) throw new Error("useVaultProvider must be inside provider");
    return ctx;
}
export function useVaultProviderActions() {
    const ctx = useContext(VaultActionsContext);
    if (!ctx) throw new Error("useVaultActions must be inside provider");
    return ctx;
}
