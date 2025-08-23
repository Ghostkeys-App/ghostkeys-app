// // Offline-first vault storage for Ghostkeys (IndexedDB, no external deps)
//
// import {DB_NAME, PROFILES_STORE, SYNC_STATE_STORE} from "../utility/identity/constants.ts";
//
//
//
// export type VaultRow = {
//   userId: string;
//   vaultId: string;
//   updatedAt: number; // epoch ms
//   data: VaultData;
// };
//
// export type ServerVault = { vault_id: string; data: VaultData };
// export type ServerVaultList = Array<ServerVault>; // from get_all_vaults_for_user
//
// /////////////////////////////
// // 2) Constants
// /////////////////////////////
//
// const CRINGE_DB_NAME = "ghostkeys";
// const DB_VERSION = 1;
// const STORE_VAULTS = "vaults";
// // compound key: [userId, vaultId]
// // indexes: byUser (userId)
//
// /////////////////////////////
// // 3) Minimal IndexedDB helpers
// /////////////////////////////
//
// function openDB(): Promise<IDBDatabase> {
//   return new Promise((resolve, reject) => {
//     const req = indexedDB.open(CRINGE_DB_NAME, DB_VERSION);
//     req.onupgradeneeded = () => {
//       const db = req.result;
//
//       if (!db.objectStoreNames.contains(STORE_VAULTS)) {
//         const store = db.createObjectStore(STORE_VAULTS, {
//           keyPath: ["userId", "vaultId"],
//         });
//         store.createIndex("byUser", "userId", { unique: false });
//       }
//       // Future migrations: bump DB_VERSION and add new stores/indices here.
//     };
//     req.onsuccess = () => resolve(req.result);
//     req.onerror = () => reject(req.error);
//     req.onblocked = () => console.warn("IndexedDB open blocked (another tab upgrading?)");
//   });
// }
//
// function tx<T = unknown>(
//     db: IDBDatabase,
//     storeName: string,
//     mode: IDBTransactionMode,
//     run: (store: IDBObjectStore) => Promise<T> | T
// ): Promise<T> {
//   return new Promise<T>((resolve, reject) => {
//     const transaction = db.transaction(storeName, mode);
//     const store = transaction.objectStore(storeName);
//     let done = false;
//
//     const finish = (val: T) => {
//       if (done) return;
//       done = true;
//       resolve(val);
//     };
//     const fail = (err: any) => {
//       if (done) return;
//       done = true;
//       reject(err);
//     };
//
//     Promise.resolve(run(store)).then(
//         (res) => {
//           transaction.oncomplete = () => finish(res as T);
//           transaction.onerror = () => fail(transaction.error);
//           transaction.onabort = () => fail(transaction.error ?? new Error("IDB aborted"));
//         },
//         (err) => fail(err)
//     );
//   });
// }
//
// /////////////////////////////
// // 4) Public API
// /////////////////////////////
//
// export const ghostkeysStorage = {
//   // Get sync status
//   async getTemplateSyncStatus(template: 'spreadsheet' | 'logins' | 'notes'): Promise<boolean> {
//     return new Promise<boolean>((resolve, reject) => {
//       const req = indexedDB.open(DB_NAME, DB_VERSION);
//
//       req.onerror = () => reject(req.error);
//       req.onsuccess = () => {
//         const db = req.result;
//         const tx = db.transaction(SYNC_STATE_STORE, "readonly");
//         const store = tx.objectStore(SYNC_STATE_STORE);
//         const getReq = store.get(template);
//
//         getReq.onerror = () => reject(getReq.error);
//         getReq.onsuccess = () => {
//           const row = getReq.result;
//           resolve(row?.synced);
//         };
//       };
//     });
//   },
//
//   // Update sync status
//   async putSyncStatus(template: 'spreadsheet' | 'logins' | 'notes', synced: boolean): Promise<void> {
//     const req = indexedDB.open(DB_NAME, DB_VERSION);
//
//     req.onsuccess = () => {
//       const db = req.result;
//       const tx = db.transaction(SYNC_STATE_STORE, "readwrite");
//       const store = tx.objectStore(SYNC_STATE_STORE);
//       store.put({ id: template, synced });
//     };
//   },
//
//   // Write/replace one full vault
//   async putVault(row: Omit<VaultRow, "updatedAt"> & { updatedAt?: number }): Promise<void> {
//     const db = await openDB();
//     const now = row.updatedAt ?? Date.now();
//     const toPut: VaultRow = { ...row, updatedAt: now };
//     await tx(db, STORE_VAULTS, "readwrite", (store) => store.put(toPut));
//   },
//
//   // Read one full vault
//   async getVault(userId: string, vaultId: string): Promise<VaultRow | undefined> {
//     const db = await openDB();
//     return tx(db, STORE_VAULTS, "readonly", (store) => {
//       return new Promise<VaultRow | undefined>((resolve, reject) => {
//         const req = store.get([userId, vaultId]);
//         req.onsuccess = () => resolve(req.result as VaultRow | undefined);
//         req.onerror = () => reject(req.error);
//       });
//     });
//   },
//
//   // List all vaults for a user
//   async listVaults(userId: string): Promise<VaultRow[]> {
//     const db = await openDB();
//     return tx(db, STORE_VAULTS, "readonly", (store) => {
//       return new Promise<VaultRow[]>((resolve, reject) => {
//         const idx = store.index("byUser");
//         const req = idx.getAll(IDBKeyRange.only(userId));
//         req.onsuccess = () => resolve((req.result as VaultRow[]) || []);
//         req.onerror = () => reject(req.error);
//       });
//     });
//   },
//
//   // Delete one vault
//   async deleteVault(userId: string, vaultId: string): Promise<void> {
//     const db = await openDB();
//     await tx(db, STORE_VAULTS, "readwrite", (store) => store.delete([userId, vaultId]));
//   },
//
//   // Wipe everything for a user (local)
//   async clearUser(userId: string): Promise<void> {
//     const db = await openDB();
//     const rows = await ghostkeysStorage.listVaults(userId);
//     await tx(db, STORE_VAULTS, "readwrite", (store) => {
//       rows.forEach((r) => store.delete([userId, r.vaultId]));
//     });
//   },
//
//   /////////////////////////////
//   // 5) Per-template helpers
//   /////////////////////////////
//
//   async getWebsiteLogins(userId: string, vaultId: string) {
//     const v = await this.getVault(userId, vaultId);
//     return v?.data.website_logins ?? [];
//   },
//   async setWebsiteLogins(userId: string, vaultId: string, website_logins: VaultData["website_logins"]) {
//     console.log('zxc', userId, vaultId, website_logins)
//     const v = (await this.getVault(userId, vaultId)) ?? defaultVaultRow(userId, vaultId);
//     v.data.website_logins = website_logins;
//     v.updatedAt = Date.now();
//     await this.putVault(v);
//   },
//
//   async getSecureNotes(userId: string, vaultId: string) {
//     const v = await this.getVault(userId, vaultId);
//     return v?.data.secure_notes ?? [];
//   },
//   async setSecureNotes(userId: string, vaultId: string, secure_notes: VaultData["secure_notes"]) {
//     const v = (await this.getVault(userId, vaultId)) ?? defaultVaultRow(userId, vaultId);
//     v.data.secure_notes = secure_notes;
//     v.updatedAt = Date.now();
//     await this.putVault(v);
//   },
//
//   async getFlexGrid(userId: string, vaultId: string) {
//     const v = await this.getVault(userId, vaultId);
//     return {
//       columns: v?.data.flexible_grid_columns ?? [],
//       cells: v?.data.flexible_grid ?? [],
//     };
//   },
//   async setFlexGrid(
//       userId: string,
//       vaultId: string,
//       payload: { columns: VaultData["flexible_grid_columns"]; cells: VaultData["flexible_grid"] }
//   ) {
//     const v = (await this.getVault(userId, vaultId)) ?? defaultVaultRow(userId, vaultId);
//     v.data.flexible_grid_columns = payload.columns;
//     v.data.flexible_grid = payload.cells;
//     v.updatedAt = Date.now();
//     await this.putVault(v);
//   },
//
//   /////////////////////////////
//   // 6) Server <-> IDB sync
//   /////////////////////////////
//
//   // Apply full server list to IDB (e.g., after login or refresh)
//   // Equivalent to BE: get_all_vaults_for_user -> (vec record { text; VaultData })
//   async applyServerPayload(userId: string, serverVaults: ServerVaultList): Promise<void> {
//     const db = await openDB();
//     await tx(db, STORE_VAULTS, "readwrite", async (store) => {
//       // Option A: upsert each vault; keep local extras (if any)
//       const now = Date.now();
//       for (const sv of serverVaults) {
//         const row: VaultRow = {
//           userId,
//           vaultId: sv.vault_id,
//           data: normalizeVaultData(sv.data),
//           updatedAt: now,
//         };
//         store.put(row);
//       }
//     });
//   },
//
//   // Export all user vaults from IDB to send upstream (e.g., for add_or_update_vault/apply_config_changes)
//   async exportForServer(userId: string): Promise<ServerVaultList> {
//     const rows = await this.listVaults(userId);
//     return rows.map((r) => ({
//       vault_id: r.vaultId,
//       data: normalizeVaultData(r.data), // ensure schema stable
//     }));
//   },
// };
//
// /////////////////////////////
// // 7) Helpers
// /////////////////////////////
//
// function defaultVaultData(): VaultData {
//   return {
//     flexible_grid_columns: [],
//     secure_notes: [],
//     flexible_grid: [],
//     website_logins: [],
//   };
// }
//
// function defaultVaultRow(userId: string, vaultId: string): VaultRow {
//   return {
//     userId,
//     vaultId,
//     updatedAt: Date.now(),
//     data: defaultVaultData(),
//   };
// }
//
// // Normalizer keeps future migrations in one place
// function normalizeVaultData(data: VaultData): VaultData {
//   return {
//     flexible_grid_columns: data.flexible_grid_columns?.map((c, i) => ({
//       name: c.name ?? `Col ${i + 1}`,
//       meta: {
//         index: typeof c.meta?.index === "number" ? c.meta.index : i,
//         hidden: !!c.meta?.hidden,
//       },
//     })) ?? [],
//     secure_notes: data.secure_notes?.map((n) => ({
//       id: n.id ?? crypto.randomUUID(),
//       content: n.content ?? "",
//     })) ?? [],
//     flexible_grid: data.flexible_grid?.map((cell) => ({
//       key: { col: cell.key.col >>> 0, row: cell.key.row >>> 0 },
//       value: cell.value ?? "",
//     })) ?? [],
//     website_logins:
//       (data.website_logins ?? []).map((w) => ({
//         name: (w?.name ?? "").toString(),
//         entries: (w?.entries ?? []).map((e) => ({
//           login: (e?.login ?? "").toString(),
//           password: (e?.password ?? "").toString(),
//         })),
//       })),
//   };
// }
