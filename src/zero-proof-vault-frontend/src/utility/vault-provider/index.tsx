import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Loader from "../loader/Loader.tsx";
import { useIdentitySystem } from "../identity";
import {
    aesDecrypt,
    aesEncrypt,
    deriveFinalKey,
    deriveSignatureFromPublicKey,
    generateSeedAndIdentityPrincipal
} from "../crypto/encdcrpt.ts";
import { useAPIContext } from "../api/APIContext.tsx";
import {
    Spreadsheet as ICSpreadsheet,
} from "../../../../declarations/shared-vault-canister-backend/shared-vault-canister-backend.did";

import {
    VaultData
} from './types.ts'

import { SpreadsheetMap } from "@ghostkeys/ghostkeys-sdk";
import { decrypt_and_adapt_spreadsheet } from "./spreadsheet.ts";

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

    saveCurrentVaultDataToIDB(data: VaultData, syncedFromIC?: boolean, vaultName?: string): Promise<Vault>;
    syncCurrentVaultWithBackend(): Promise<void>;
    getICVault(vaultIcpPublicAddress: string): Promise<{ data: VaultData, vaultName: string } | null>;
    getAllICVaults(userPrincipalId: string): Promise<Array<{ data: VaultData; vaultName: string; icpPublicAddress: string; }> | null>
    validateAndImportIdentityWithVaultFromSeed(potentialUserSeed: string): Promise<boolean>;
    deleteVaultFromIC(vaultPublicAddress: string): Promise<boolean>;
}

const VaultStateContext = createContext<State | null>(null);
const VaultActionsContext = createContext<Actions | null>(null);

export function VaultContextProvider({ children }: { children: ReactNode }) {
    const db = useRef<IDBDatabase | null>(null);
    const { currentProfile, switchProfile, createProfileFromSeed } = useIdentitySystem();
    const { getSharedVaultCanisterAPI, getVetKDDerivedKey, userExistsWithVetKD } = useAPIContext();

    const [isReady, setIsReady] = useState(false);
    const [syncedWithStable, setSyncedWithStable] = useState(false);
    const [currentVaultId, setCurrentVaultId] = useState<string | null>(null);
    const [vaults, setVaults] = useState<Vault[]>([]);
    const [isSeedPhraseImport, setIsSeedPhraseImport] = useState(false);

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

    useEffect(() => {
        if (isSeedPhraseImport) getAllDataAfterSeedImport();
    }, [currentProfile, isSeedPhraseImport]);

    const getAllDataAfterSeedImport = useCallback((async () => {
        const icUserVaults = await getAllICVaults(currentProfile.principal.toString());
        if (icUserVaults === null) {
            // No vaults returned per existing user --> create new one and store in index DB
            if (!currentProfile) throw new Error("No profile set");
            await createVault('Personal Vault');
        } else {
            await saveAllUserVaults(icUserVaults, true);
        }
        setIsSeedPhraseImport(false);
    }), [currentProfile]);

    const bootstrap = async () => {
        if (!db.current) throw new Error("DB not initialized");

        // Try getting from IndexDB
        const tx = db.current.transaction(VAULTS_STORE_VAULTS, "readonly");
        const store = tx.objectStore(VAULTS_STORE_VAULTS);
        const req = store.getAll();
        const allVaults: Vault[] = await new Promise((res, rej) => {
            req.onsuccess = () => res(req.result as Vault[]);
            req.onerror = () => rej("Failed to list vaults");
        });
        // Try getting from IC
        if (allVaults.length === 0) {
            const userExists = await userExistsWithVetKD(currentProfile.principal.toString());
            const icUserVaults = userExists ? await getAllICVaults(currentProfile.principal.toString()) : null;
            if (icUserVaults === null) {
                // No vaults returned per existing user --> create new one and store in index DB
                if (!currentProfile) throw new Error("No profile set");
                await createVault('Personal Vault');
            } else {
                await saveAllUserVaults(icUserVaults, true); // since we got them from query call
            }
        }
        if (allVaults.length > 0) {
            setVaults(allVaults);
            setCurrentVaultId(allVaults[0].vaultID);
        }
    };

    // Actions callbacks
    const saveAllUserVaults = useCallback(async (userVaults: Array<{
        data: VaultData;
        vaultName: string;
        icpPublicAddress: string;
    }>, fromIc: boolean) => {
        const newVaults: Vault[] = [];
        for (const { data, vaultName, icpPublicAddress } of userVaults) {
            const vaultID = `Vault_${icpPublicAddress}`;
            const newVault: Vault = {
                vaultID,
                vaultName,
                icpPublicAddress: icpPublicAddress,
                synced: true,
                data: data,
                existsOnIc: fromIc
            };
            await saveVaultToIDB(newVault);
            newVaults.push(newVault);
        }
        setCurrentVaultId(newVaults?.[0]?.vaultID || null);
        setVaults(newVaults);
    }, []);
    const saveVaultToIDB = useCallback(async (vault: Vault): Promise<void> => {
        if (!db.current) throw new Error("DB not initialized");
        await new Promise<void>((res, rej) => {
            const tx = db.current!.transaction(VAULTS_STORE_VAULTS, "readwrite");
            const store = tx.objectStore(VAULTS_STORE_VAULTS);
            const req = store.put(vault);

            req.onerror = () => rej(req.error);
            tx.onabort = () => rej(tx.error ?? new Error("IDB tx aborted"));
            tx.onerror = () => rej(tx.error ?? new Error("IDB tx error"));
            tx.oncomplete = () => res();
        });
    }, []);
    const createVault = useCallback(async (vaultName: string): Promise<Vault> => {
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
            },
            existsOnIc: false
        };
        await saveVaultToIDB(newVault);
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

        if (vaults.length === 1 && vaults[0].vaultID === vaultID) {
            await createVault("Personal Vault");
        } else {
            setVaults((prev) => {
                const next = prev.filter((v) => v.vaultID !== vaultID);
                setCurrentVaultId(next[0]?.vaultID ?? null);
                return next;
            });
        }
    }, [currentProfile, vaults]);

    const deleteVaultFromIC = useCallback(async (vaultPublicAddress: string): Promise<boolean> => {
        const api = await getSharedVaultCanisterAPI();
        try {
            await api.delete_vault(currentProfile.principal.toString(), vaultPublicAddress);
            return true;
        } catch (e) {
            console.warn("Error on delete vault: ", e);
            return false
        }

    }, [currentProfile, getSharedVaultCanisterAPI]);

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
            setVaults((prev) => prev.map(v => v.vaultID === vaultID ? updatedVault : v));
        }

        return updatedVault;
    }, [currentProfile]);

    const switchVault = useCallback((vaultID: string) => {
        setCurrentVaultId(vaultID);
    }, []);

    const saveCurrentVaultDataToIDB = useCallback(async (data: VaultData, syncedFromIC?: boolean, vaultName?: string): Promise<Vault> => {
        if (!currentProfile) throw new Error("No profile set");
        if (!currentVault) throw new Error("No current vault set");

        const updatedVault: Vault = {
            vaultID: currentVaultId!,
            vaultName: syncedFromIC && vaultName ? vaultName : currentVault.vaultName!,
            icpPublicAddress: currentVault.icpPublicAddress,
            synced: syncedFromIC || false, // if we called to save from outside
            data,
            existsOnIc: currentVault.existsOnIc
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

    const setCurrentVaultSyncStatusIdb = useCallback(async (synced: boolean, existsOnIc: boolean): Promise<void> => {
        if (!currentProfile) throw new Error("No profile set");
        if (!currentVault) throw new Error("No current vault set");

        const updatedVault: Vault = {
            ...currentVault,
            synced,
            existsOnIc
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
    }, [currentProfile, currentVault]);

    const prepareEncryptedVaultPayload = useCallback(async (vault: Vault): Promise<ICVaultData> => {
        if (!currentProfile) throw new Error("No profile set");

        const vetKD = await getVetKDDerivedKey();
        const vaultKD = await deriveSignatureFromPublicKey(vault.icpPublicAddress, currentProfile.identity);
        const fnKD = await deriveFinalKey(vaultKD, vetKD);
        const encryptedVaultName: string = await aesEncrypt(vault.vaultName, fnKD);

        const flexible_grid_columns: Array<[string, [number, boolean]]> =
            await Promise.all(vault.data.flexible_grid_columns.map(async (c) => {
                const encryptedName = await aesEncrypt(c.name, fnKD);
                const index = c.meta.index;
                const hidden = !!c?.meta?.hidden;
                return [encryptedName, [index >>> 0, hidden]];
            }));

        const secure_notes: Array<[string, string]> =
            await Promise.all(vault.data.secure_notes.map(async (n) => {
                const encryptedName = await aesEncrypt(n.name, fnKD);
                const encryptedContent = await aesEncrypt(n.content, fnKD);
                return [encryptedName, encryptedContent]
            }));

        const flexible_grid: Array<[FlexGridDataKey, string]> =
            await Promise.all(vault.data.flexible_grid.map(async (cell) => {
                const encryptedName = await aesEncrypt(cell.value, fnKD);
                return [
                    { col: cell.key.col, row: cell.key.row },
                    encryptedName,
                ]
            }));

        const website_logins: Array<[string, Array<[string, string]>]> =
            await Promise.all((vault.data.website_logins ?? []).map(async (site) => {
                const encryptedName = await aesEncrypt(site.name, fnKD);
                const encryptedEntries = await Promise.all(site.entries.map(async (e) => {
                    const [encLogin, encPassword] = await Promise.all([
                        aesEncrypt(e.login, fnKD),
                        aesEncrypt(e.password, fnKD),
                    ]);
                    return [encLogin, encPassword];
                }));

                return [encryptedName, encryptedEntries] as [string, Array<[string, string]>];
            }));

        return { flexible_grid_columns, secure_notes, flexible_grid, website_logins, vault_name: encryptedVaultName };
    }, [currentProfile, currentVault]);

    const decryptAndAdaptVaultData = useCallback(async (vaultIcpPublicAddress: string, spreadsheet: ICSpreadsheet): Promise<{ data: VaultData; vaultName: string }> => {
        if (!currentProfile) throw new Error("No profile set");

        const vetKD = await getVetKDDerivedKey();
        const vaultKD = await deriveSignatureFromPublicKey(vaultIcpPublicAddress, currentProfile.identity);
        const fnKD = await deriveFinalKey(vaultKD, vetKD);

        // 
        const flexible_grid_columns =
            await decrypt_and_adapt_spreadsheet(spreadsheet, fnKD);

        const secure_notes =
            await Promise.all(icVaultData.secure_notes.map(async ([encName, encContent]) => {
                const [name, content] = await Promise.all([
                    aesDecrypt(encName, fnKD),
                    aesDecrypt(encContent, fnKD),
                ]);
                return { name, content };
            }));
        const flexible_grid =
            await Promise.all(icVaultData.flexible_grid.map(async ([key, encValue]) => {
                const value = await aesDecrypt(encValue, fnKD);
                return { key: { col: key.col, row: key.row }, value };
            }));
        const website_logins =
            await Promise.all(icVaultData.website_logins.map(async ([encSiteName, encEntries]) => {
                const name = await aesDecrypt(encSiteName, fnKD);
                const entries = await Promise.all(encEntries.map(async ([encLogin, encPassword]) => {
                    const [login, password] = await Promise.all([
                        aesDecrypt(encLogin, fnKD),
                        aesDecrypt(encPassword, fnKD),
                    ]);
                    return { login, password } as WebsiteLoginEntry;
                }));
                return { name, entries } as WebsiteLogin;
            }));

        const vaultName = await aesDecrypt(icVaultData.vault_name, fnKD);

        return {
            data: { flexible_grid_columns, secure_notes, flexible_grid, website_logins },
            vaultName,
        };
    }, [currentProfile, currentVault, getVetKDDerivedKey]);

    const getICVault = useCallback(async (vaultIcpPublicAddress: string): Promise<{ data: VaultData, vaultName: string } | null> => {
        if (!currentProfile) throw new Error("No profile set");

        const api = await getSharedVaultCanisterAPI();
        const response = await api.get_vault(currentProfile.principal.toString(), vaultIcpPublicAddress);

        if (response?.length) {
            return await decryptAndAdaptVaultData(vaultIcpPublicAddress, response[0]);
        }
        return null;

    }, [currentProfile, getSharedVaultCanisterAPI]);


    const getAllICVaults = useCallback(async (userPrincipalId: string): Promise<Array<{
        data: VaultData;
        vaultName: string;
        icpPublicAddress: string;
    }> | null> => {
        if (!currentProfile) throw new Error("No profile set");
        const api = await getSharedVaultCanisterAPI();
        const allVaults = await api.get_all_vaults_for_user(userPrincipalId ?? currentProfile.principal.toString());
        if (allVaults.length > 0) {
            const allDecryptedVaultsData = [];
            for (let [principalVaultId, vaultData] of allVaults) {
                const decryptedVaultData = await decryptAndAdaptVaultData(principalVaultId, vaultData);
                allDecryptedVaultsData.push({ icpPublicAddress: principalVaultId, ...decryptedVaultData });
            }
            return allDecryptedVaultsData;
        }
        return null;
    }, [currentProfile, getSharedVaultCanisterAPI])

    const dropPersistanceStorageForAllVaults = useCallback(async () => {
        if (!currentProfile) throw new Error("No profile set");
        if (!db.current) throw new Error("DB not initialized");

        await new Promise<void>((res, rej) => {
            const tx = db.current!.transaction(VAULTS_STORE_VAULTS, "readwrite");
            const store = tx.objectStore(VAULTS_STORE_VAULTS);
            const req = store.clear();

            req.onerror = () => rej(req.error);
            tx.onabort = () => rej(tx.error ?? new Error("IDB tx aborted"));
            tx.onerror = () => rej(tx.error ?? new Error("IDB tx error"));
            tx.oncomplete = () => res();
        });
    }, [])

    const validateAndImportIdentityWithVaultFromSeed = useCallback(async (potentialUserSeed: string): Promise<boolean> => {
        const existingProfile = await createProfileFromSeed(potentialUserSeed);
        const userExists = await userExistsWithVetKD(existingProfile.principal.toString());
        if (userExists) {
            await dropPersistanceStorageForAllVaults();
            await switchProfile(existingProfile);
            setIsSeedPhraseImport(true);
            return true;
        } else return false;
    }, [userExistsWithVetKD, currentProfile]);

    const syncCurrentVaultWithBackend = useCallback(async (): Promise<void> => {
        if (!currentProfile) throw new Error("No profile set");
        if (!currentVault) throw new Error("No current vault set");

        const payload = await prepareEncryptedVaultPayload(currentVault);
        const api = await getSharedVaultCanisterAPI();
        await api.add_or_update_vault(currentProfile.principal.toString(), currentVault.icpPublicAddress, payload);
        await setCurrentVaultSyncStatusIdb(true, true);
        setVaults((prevState) => prevState.map((v) => v.vaultID == currentVaultId ? { ...currentVault, synced: true, existsOnIc: true } : v));

    }, [currentProfile, currentVault, getSharedVaultCanisterAPI]);

    const state = useMemo<State>(
        () => ({ vaults, syncedWithStable, currentVault, currentVaultId }),
        [vaults, syncedWithStable, currentVault, currentVaultId]
    );

    const actions = useMemo<Actions>(
        () => ({ createVault, deleteVault, renameVault, switchVault, saveCurrentVaultDataToIDB, syncCurrentVaultWithBackend, getICVault, getAllICVaults, validateAndImportIdentityWithVaultFromSeed, deleteVaultFromIC }),
        [createVault, deleteVault, renameVault, switchVault, saveCurrentVaultDataToIDB, syncCurrentVaultWithBackend, getICVault, getAllICVaults, validateAndImportIdentityWithVaultFromSeed, deleteVaultFromIC]
    );

    if (!isReady) return <Loader />;
    return (
        <VaultStateContext.Provider value={state}>
            <VaultActionsContext.Provider value={actions}>
                {children}
            </VaultActionsContext.Provider>
        </VaultStateContext.Provider>
    );
}

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
