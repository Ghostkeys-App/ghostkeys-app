// import { createContext, ReactNode, useContext, useEffect, useRef, useState } from "react";
// import LoadingAnimation from "../../components/NotFound/LoadingAnimation";
// import { useIdentitySystem } from "../identity";
// import { decryptPasswordBlob, encryptPasswordBlob } from "../crypto/encdcrpt";

// export type Column = {
//     id: string;
//     name: string;
//     hidden: boolean;
// };

// export type Row = {
//     id: string;
//     values: Array<string>;
// };

// export type VaultData = {
//     name: string,
//     columns: Array<Column>,
//     rows: Array<Row>
// }

// export type TableCoordinates = {
//     columnId: string;
//     rowId: number;
// };


// export type VaultColumns = Map<string, Column>;
// export type TableVaultData = Map<TableCoordinates, string>;

// export type VaultDataMap = Map<string, TableVaultData>;
// export type TableVaultColumnDataMap = Map<string, VaultColumns>;

// export type DataVaultColumn = { vaultDataMap: VaultDataMap, tableVaultColumnDataMap: TableVaultColumnDataMap };

// export const DB_NAME_VAULTS = "Ghostkeys-persistent-vaults";
// export const DB_VERSION_VAULTS = 1;
// export const VAULTS_STORE_VAULTS = "vaults";

// export type VaultProviderContext = {
//     setSyncedWithStable: (synced: boolean) => void;
//     // setVaultData: (vaultData: VaultData) => void;
//     // getVaultData: (userIcpPublicAddress: string, vaultIcpPublicAddress: string) => VaultData;
//     syncVaultsWithBackend: () => Promise<void>;
//     setAllVaultsData: (vaultData: VaultDataMap, vaultColumns: TableVaultColumnDataMap) => void;
//     getAllVaultsData: (userIcpPublicAddress: string) => Promise<{ vaultTableData: VaultDataMap, vaultColumns: TableVaultColumnDataMap }>;
//     syncedWithStable: boolean;
//     vaultsColumns: TableVaultColumnDataMap;
//     vaultsData: VaultDataMap;
// };

// const VaultContext = createContext<VaultProviderContext | undefined>(undefined);


// export function VaultContextProvider({ children }: { children: ReactNode }) {
//     const db = useRef<IDBDatabase | null>(null);

//     const [isReady, setIsReady] = useState(false);
//     const [syncedWithStable, setSyncedWithStable] = useState(false);
//     const [vaultsData, setVaultsData] = useState<VaultDataMap>(new Map());
//     const [vaultsColumns, setVaultsColumns] = useState<TableVaultColumnDataMap>(new Map());
//     const { currentProfile } = useIdentitySystem();

//     useEffect(() => {
//         const init = async () => {

//             const request = indexedDB.open(DB_NAME_VAULTS, DB_VERSION_VAULTS);

//             request.onupgradeneeded = (e) => {
//                 const db = (e.target as IDBOpenDBRequest).result;
//                 if (!db.objectStoreNames.contains(VAULTS_STORE_VAULTS)) {
//                     db.createObjectStore(VAULTS_STORE_VAULTS, { keyPath: "all_vaults" });
//                 }
//             };

//             request.onsuccess = async (e) => {
//                 db.current = (e.target as IDBOpenDBRequest).result;
//                 await bootstrap();
//                 setIsReady(true);
//             };
//         };
//         init();
//         setIsReady(true);
//     }, []);

//     const serializeVaultDataMap = (vaultDataMap: VaultDataMap) => {
//         const serialized: Record<string, [string, string][]> = {};
//         for (const [vaultId, map] of vaultDataMap.entries()) {
//             serialized[vaultId] = Array.from(map.entries()).map(([k, v]) => [JSON.stringify(k), v]);
//         }
//         return serialized;
//     };

//     const serializeVaultColumnsMap = (vaultColumns: TableVaultColumnDataMap) => {
//         const serialized: Record<string, Column[]> = {};
//         for (const [vaultId, columnMap] of vaultColumns.entries()) {
//             serialized[vaultId] = Array.from(columnMap.values());
//         }
//         return serialized;
//     };


//     const bootstrap = async () => {
//         if (!db.current) throw new Error("DB not initialized");

//         const tx = db.current.transaction(VAULTS_STORE_VAULTS, "readonly");
//         const store = tx.objectStore(VAULTS_STORE_VAULTS);
//         const req = store.getAll();
//         const allVaults: DataVaultColumn[] = await new Promise((res, rej) => {
//             req.onsuccess = () => res(req.result as DataVaultColumn[]);
//             req.onerror = () => rej("Failed to list vaults");
//         });

//         if (allVaults.length > 0) {
//             const vaultData = allVaults[0];
//             const reconstructedVaultDataMap: VaultDataMap = new Map();
//             const reconstructedVaultColumnsMap: TableVaultColumnDataMap = new Map();

//             for (const [vaultId, entries] of Object.entries(vaultData.vaultDataMap)) {
//                 const rowMap = new Map<TableCoordinates, string>();
//                 for (const [keyJSON, value] of entries as [string, string][]) {
//                     const key: TableCoordinates = JSON.parse(keyJSON);
//                     rowMap.set(key, value);
//                 }
//                 reconstructedVaultDataMap.set(vaultId, rowMap);
//             }
//             for (const [vaultId, colArray] of Object.entries(vaultData.tableVaultColumnDataMap)) {
//                 const colMap = new Map<string, Column>();
//                 for (const col of colArray as Column[]) {
//                     colMap.set(col.id, col);
//                 }
//                 reconstructedVaultColumnsMap.set(vaultId, colMap);
//             }
//             setVaultsData(reconstructedVaultDataMap);
//             setVaultsColumns(reconstructedVaultColumnsMap);
//             setSyncedWithStable(true);
//         } else {
//             if (!currentProfile || !currentProfile.icpPublicKey) {
//                 console.error("No current profile or ICP public address found");
//                 return;
//             }
//             try {
//                 const { vaultTableData, vaultColumns } = await getAllVaultsData(currentProfile.icpPublicKey);
//                 setVaultsData(vaultTableData);
//                 setVaultsColumns(vaultColumns);
//                 setSyncedWithStable(true);
//             } catch (error) {
//                 console.error(error);
//                 return;
//             }
//         }
//     };

//     const getAllVaultsData = async (userIcpPublicAddress: string): Promise<{ vaultTableData: VaultDataMap, vaultColumns: TableVaultColumnDataMap }> => {
//         // if (!currentProfile || !currentProfile.icpPublicKey) {
//         //     throw new Error("No current profile or ICP public address found");
//         // }

//         // const vaults = await zero_proof_vault_backend.get_all_vaults_for_user(userIcpPublicAddress);
//         // const vaultDataMap: VaultDataMap = new Map();
//         // const vaultDataColumns: TableVaultColumnDataMap = new Map();

//         // vaults.forEach(async ([vaultId, vaultData]) => {
//         //     const vaultMap: TableVaultData = new Map();
//         //     const vaultColumns: VaultColumns = new Map();

//         //     const vaultSignature = await deriveSignatureFromPublicKey(vaultId);
//         //     vaultData.rows.forEach(async (row) => {
//         //         row.values.forEach(async (value, index) => {
//         //             const coordinates: TableCoordinates = { columnId: vaultData.columns[index].id, rowId: parseInt(row.id) };
//         //             const decryptedValue = await decryptPasswordBlob(value, vaultSignature);
//         //             vaultMap.set(coordinates, decryptedValue);
//         //         });
//         //     });
//         //     vaultData.columns.forEach((col) => {
//         //         vaultColumns.set(col.id, { id: col.id, name: col.name, hidden: false });
//         //     });
//         //     vaultDataMap.set(vaultId, vaultMap);
//         //     vaultDataColumns.set(vaultId, vaultColumns);
//         // });

//         // return { vaultTableData: vaultDataMap, vaultColumns: vaultDataColumns };
//         const vaultTableData: VaultDataMap = new Map();
//         const vaultColumns: TableVaultColumnDataMap = new Map();
//         return {vaultTableData, vaultColumns}
//     }

//     const syncVaultsWithBackend = async () => {

//         /**
//          * 1) Check if we currently have derive_vetkd_encrypted_key
//          * 1.1) If yes -> use it
//          * 1.2) If not -> call query endpoint to get existing key
//          * 1.3) If response YES -> use it
//          * 1.4) If response NO -> call update derive_vetkd_encrypted_key endpoint -> use it
//          * 
//          * 2) Generate public key from offline address
//          */

//         if (!currentProfile) {
//             console.error("Cannot sync: no current profile");
//             return;
//         }

//         const updates: [string, string, VaultData][] = [];

//         for (const [vaultId, dataMap] of vaultsData.entries()) {
//             const vaultSignature = await deriveSignatureFromPublicKey(vaultId);
//             const columns = vaultsColumns.get(vaultId);
//             if (!columns) continue;
//             const columnsArray = Array.from(columns.values());
//             const rowMap: Map<number, Row> = new Map();

//             for (const [{ rowId, columnId }, value] of dataMap.entries()) {
//                 const col = columns.get(columnId);
//                 if (!col) continue;
//                 const row = rowMap.get(rowId) || { id: rowId.toString(), values: [] };

//                 // encrypt value using derived signature from vault public key
//                 const hashedValue = await encryptPasswordBlob(value, vaultSignature);
//                 row.values[parseInt(col.id)] = hashedValue;
//                 rowMap.set(rowId, row);
//             }
//             const rows: Row[] = Array.from(rowMap.values()).map((r) => {
//                 const filled = columnsArray.map((col) => r.values[parseInt(col.id)] ?? "");
//                 return { id: r.id, values: filled };
//             });

//             updates.push([currentProfile.icpPublicKey, vaultId, { name: vaultId, columns: columnsArray, rows }]);
//         }
//     };


//     const setAllVaultsData = (vaultData: VaultDataMap, vaultColumns: TableVaultColumnDataMap) => {
//         if (!db.current) throw new Error("DB not initialized");
//         const tx = db.current.transaction(VAULTS_STORE_VAULTS, "readwrite");
//         const store = tx.objectStore(VAULTS_STORE_VAULTS);
//         const storedData = {
//             all_vaults: "all_vaults",
//             vaultDataMap: serializeVaultDataMap(vaultData),
//             tableVaultColumnDataMap: serializeVaultColumnsMap(vaultColumns),
//         };
//         store.put(storedData);
//     }

//     const contextValue: VaultProviderContext = {
//         setSyncedWithStable,
//         syncedWithStable,
//         // setVaultData,
//         // getVaultData,
//         syncVaultsWithBackend,
//         setAllVaultsData,
//         getAllVaultsData,
//         vaultsColumns,
//         vaultsData,
//     };

//     if (!isReady) return <LoadingAnimation />;
//     return <VaultContext.Provider value={contextValue}>{children}</VaultContext.Provider>;
// };

// export function useVaultProvider() {
//     const ctx = useContext(VaultContext);
//     if (!ctx) throw new Error("useVaultProvider must be inside provider");
//     return ctx;
// }
